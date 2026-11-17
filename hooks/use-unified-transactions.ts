"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useAuth } from "@/components/auth-provider"
import {
  cryptoBackendClient,
  cryptoQueryKeys,
  isCryptoBackendEnabled,
} from "@/lib/crypto-backend"
import type { CryptoTransactionRecord } from "@/lib/crypto-backend"
import { describeLedgerRecord } from "@/lib/ledger-rows"
import { cleanSymbol, shortAddress, tokenLabel, walletTokensFrom, type ResolvedToken, type WalletTokens } from "@/lib/token-resolver"
import { useCryptoBalances } from "@/hooks/crypto/useCryptoBalances"
import { TRANSACTIONS_MOCKS_ENABLED } from "@/lib/transactions-mocks"
import { useSpotRegistry } from "@/hooks/useSpotRegistry"
import { useUsdIndex } from "@/hooks/crypto/useUsdIndex"
import type {
  TokenInfo,
  UnifiedTransaction,
  TransactionStats,
  TransactionFilters,
} from "@/types/transactions"

type DemoLedger = { records: CryptoTransactionRecord[]; wallet: ReturnType<typeof walletTokensFrom> }

/* Dev sample data (lib/transactions-mocks.ts). The import sits behind
   NODE_ENV, a build-time literal, so production bundles never contain it. */
const loadDemoLedger: () => Promise<DemoLedger> =
  process.env.NODE_ENV === "development"
    ? () =>
        import("@/lib/transactions-mock").then((m) => ({
          records: m.mockLedgerRecords(Date.now()),
          wallet: walletTokensFrom(m.mockWalletBalances()),
        }))
    : () => Promise.reject(new Error("Sample data is only available in development"))

/** True while the transactions page is showing dev sample data. */
export const TRANSACTIONS_DEMO = TRANSACTIONS_MOCKS_ENABLED

interface UseUnifiedTransactionsOptions {
  pollInterval?: number
}

interface UseUnifiedTransactionsReturn {
  transactions: UnifiedTransaction[]
  stats: TransactionStats | null
  isLoading: boolean
  isLoadingMore: boolean
  error: string | null
  hasMore: boolean
  filters: TransactionFilters
  setFilters: (filters: Partial<TransactionFilters>) => void
  loadMore: () => void
  refresh: () => void
  sentinelRef: (node: HTMLElement | null) => void
}

const DEFAULT_STATS: TransactionStats = {
  totalDeposits: 0,
  totalWithdrawals: 0,
  totalTrades: 0,
  totalSwaps: 0,
  totalTransfers: 0,
  depositVolume: 0,
  withdrawalVolume: 0,
  netVolume: 0,
}

function mapCryptoStatus(status: string): UnifiedTransaction["status"] {
  if (status === "confirmed") return "completed"
  if (status === "failed") return "failed"
  if (status === "submitted") return "processing"
  return "pending"
}

function fallbackUsdPrice(token: string): number | undefined {
  return ["USDC", "USDT", "DAI", "USDC.E", "USDT0"].includes(
    token.toUpperCase()
  )
    ? 1
    : undefined
}

/** The resolver's token, trimmed to what a row carries. */
function infoOf(t: ResolvedToken | undefined): TokenInfo | undefined {
  if (!t) return undefined
  return { networkId: t.networkId, address: t.address, symbol: t.symbol, name: t.name, icon: t.icon, listed: t.listed, role: t.role }
}

function mapCryptoTransaction(
  transaction: CryptoTransactionRecord,
  registry: ReturnType<typeof useSpotRegistry>,
  usdPrices: Record<string, number> | null,
  wallet: WalletTokens
): UnifiedTransaction {
  const described = describeLedgerRecord(transaction, registry, wallet)
  const summary = transaction.summary ?? {}
  const action =
    typeof summary.action === "string" ? summary.action : "transfer"
  const isSwap = action === "spot-swap" || action === "jupiter-swap"
  const asset = transaction.assetSummary
  // Never render an intent's base-unit amount while token precision is still
  // loading. That was the source of the huge value/P&L flash on first paint.
  const amountKnown = described ? described.amount !== null : false
  const amount = described?.amount ?? 0
  /* A swap's amount is the RECEIVED leg (the only one on record), so the row's
     token is the received token's label; the side and subject ride on
     subType and tokenInfo. Addresses never reach the screen as symbols. */
  const token = isSwap
    ? (described?.unit ?? shortAddress(String(summary.buyToken ?? asset?.identifier ?? "")))
    : (described?.symbol || cleanSymbol(asset?.identifier) || shortAddress(asset?.identifier ?? null))
  const indexedPrice =
    usdPrices?.[token] ??
    usdPrices?.[token.toUpperCase()] ??
    usdPrices?.[token.toLowerCase()] ??
    fallbackUsdPrice(token)
  const explicitUsd = [summary.usdValue, summary.valueUsd]
    .map((value) => (typeof value === "number" ? value : Number(value)))
    .find((value) => Number.isFinite(value) && value >= 0)
  const valueUsd =
    described?.valueUsd ??
    explicitUsd ??
    (amountKnown &&
    amount > 0 &&
    typeof indexedPrice === "number" &&
    indexedPrice > 0
      ? amount * indexedPrice
      : undefined)
  const summaryText = Object.values(summary)
    .filter((value) => typeof value === "string")
    .join(" ")
  const location: UnifiedTransaction["location"] =
    /futures|perp|hyperliquid/i.test(`${action} ${summaryText}`)
      ? "futures"
      : /fiat|onramp|offramp|payout/i.test(`${action} ${summaryText}`)
        ? "fiat"
        : isSwap || /spot/i.test(`${action} ${summaryText}`)
          ? "spot"
          : "wallet"
  const paid = described?.paid
  const received = described?.received
  return {
    id: transaction.id,
    type: isSwap
      ? "swap"
      : transaction.direction === "incoming"
        ? "deposit"
        : "transfer",
    subType: isSwap
      ? (described?.side ?? "swap")
      : transaction.direction === "incoming"
        ? "receive"
        : transaction.direction === "internal"
          ? "internal"
          : "send",
    amount,
    amountKnown,
    token,
    tokenInfo: infoOf(described?.token),
    chain: transaction.networkId ?? transaction.chainFamily,
    status: mapCryptoStatus(transaction.status),
    fromAddress: transaction.fromAddress,
    toAddress: transaction.toAddress,
    txHash: transaction.txHash,
    direction: transaction.direction ?? "outgoing",
    location,
    valueUsd: valueUsd ?? undefined,
    ...(isSwap
      ? {
          fromToken: paid ? tokenLabel(paid) : undefined,
          toToken: received ? tokenLabel(received) : undefined,
          fromInfo: infoOf(paid),
          toInfo: infoOf(received),
          // `amount` above is already the received leg; the pay leg's amount
          // isn't on the record, so nothing is shown for it.
          toAmount: amountKnown ? amount : undefined,
          fromChain: transaction.networkId ?? transaction.chainFamily,
          toChain:
            typeof summary.destinationNetworkId === "string"
              ? summary.destinationNetworkId
              : (transaction.networkId ?? transaction.chainFamily),
        }
      : {}),
    createdAt:
      transaction.createdAt ??
      transaction.submittedAt ??
      new Date(0).toISOString(),
    completedAt: transaction.confirmedAt,
  }
}

function matchesCryptoFilters(
  transaction: UnifiedTransaction,
  filters: TransactionFilters
) {
  if (filters.type && transaction.type !== filters.type) return false
  if (filters.status && transaction.status !== filters.status) return false
  if (filters.search) {
    const search = filters.search.toLowerCase()
    const haystack = [
      transaction.id,
      transaction.type,
      transaction.subType,
      transaction.token,
      transaction.fromToken,
      transaction.toToken,
      transaction.pair,
      transaction.chain,
      transaction.location,
      transaction.txHash,
      transaction.fromAddress,
      transaction.toAddress,
      transaction.status,
      transaction.direction,
      String(transaction.amount),
      transaction.valueUsd == null ? undefined : String(transaction.valueUsd),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
    if (!haystack.includes(search)) return false
  }
  if (filters.dateFrom && transaction.createdAt < filters.dateFrom) return false
  if (filters.dateTo && transaction.createdAt > filters.dateTo) return false
  return true
}

function getCryptoStats(transactions: UnifiedTransaction[]): TransactionStats {
  const deposits = transactions.filter(
    (transaction) => transaction.type === "deposit"
  )
  const outgoing = transactions.filter(
    (transaction) =>
      transaction.direction === "outgoing" && transaction.type !== "swap"
  )
  const knownDepositVolume = deposits.reduce(
    (total, transaction) => total + (transaction.valueUsd ?? 0),
    0
  )
  const knownWithdrawalVolume = outgoing.reduce(
    (total, transaction) => total + (transaction.valueUsd ?? 0),
    0
  )
  const depositValuationMissing = deposits.filter(
    (transaction) => transaction.valueUsd === undefined
  ).length
  const withdrawalValuationMissing = outgoing.filter(
    (transaction) => transaction.valueUsd === undefined
  ).length
  const depositValuationComplete = depositValuationMissing === 0
  const withdrawalValuationComplete = withdrawalValuationMissing === 0
  const valuationComplete =
    depositValuationComplete && withdrawalValuationComplete
  return {
    ...DEFAULT_STATS,
    totalDeposits: deposits.length,
    totalWithdrawals: outgoing.length,
    // `spot_trade` was never counted, so "Moved" reported swaps and transfers
    // only and silently dropped every executed spot trade from the figure.
    totalTrades: transactions.filter(
      (transaction) => transaction.type === "spot_trade"
    ).length,
    totalSwaps: transactions.filter(
      (transaction) => transaction.type === "swap"
    ).length,
    totalTransfers: transactions.filter(
      (transaction) => transaction.type === "transfer"
    ).length,
    depositVolume: knownDepositVolume,
    withdrawalVolume: knownWithdrawalVolume,
    netVolume: knownDepositVolume - knownWithdrawalVolume,
    valuationComplete,
    depositValuationComplete,
    withdrawalValuationComplete,
    depositValuationMissing,
    withdrawalValuationMissing,
  }
}

export function useUnifiedTransactions(
  options: UseUnifiedTransactionsOptions = {}
): UseUnifiedTransactionsReturn {
  const { pollInterval = 30000 } = options
  const { user, isLoaded, isSignedIn } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.userId ?? "anonymous"
  // Transaction history belongs to the modern wallet ledger regardless of
  // which wallet UI the user last opened. Legacy outgoing activity is never
  // mixed into this page; legacy -> modern arrives as a modern deposit.
  const backendEnabled = isCryptoBackendEnabled && isLoaded && isSignedIn
  // In demo mode the ledger is sample data: nothing is fetched or synced.
  const demo = TRANSACTIONS_MOCKS_ENABLED
  const [demoLedger, setDemoLedger] = useState<DemoLedger | null>(null)
  useEffect(() => {
    if (!demo) return
    let live = true
    void loadDemoLedger().then((d) => live && setDemoLedger(d))
    return () => {
      live = false
    }
  }, [demo])
  const registry = useSpotRegistry(backendEnabled)
  const usdPrices = useUsdIndex()
  // Held tokens the registry doesn't list still have a name, logo and
  // precision in the balance feed: the same cached snapshot the wallet reads.
  const { balances } = useCryptoBalances()
  const walletTokens = useMemo(() => {
    const real = walletTokensFrom(balances)
    return demoLedger ? new Map([...real, ...demoLedger.wallet]) : real
  }, [balances, demoLedger])

  const [transactions, setTransactions] = useState<UnifiedTransaction[]>([])
  const [stats, setStats] = useState<TransactionStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | undefined>()

  const [filters, setFiltersState] = useState<TransactionFilters>({ limit: 30 })
  const observerRef = useRef<IntersectionObserver | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const cryptoQuery = useQuery({
    queryKey: cryptoQueryKeys.transactions(userId, filters),
    queryFn: ({ signal }) =>
      cryptoBackendClient.listTransactions(filters.limit || 30, signal),
    enabled: backendEnabled && !demo,
    staleTime: 15_000,
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  })

  const syncMutation = useMutation({
    mutationFn: () => cryptoBackendClient.syncTransactions(),
    onSuccess: () => {
      window.setTimeout(() => {
        void queryClient.invalidateQueries({
          queryKey: [...cryptoQueryKeys.all, "transactions", userId],
        })
      }, 5_000)
    },
  })

  useEffect(() => {
    if (!backendEnabled || demo || syncMutation.isPending) return
    syncMutation.mutate()
    // The backend has its own per-user lock and 15-second cooldown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendEnabled, userId])

  const buildUrl = useCallback(
    (cursor?: string) => {
      const params = new URLSearchParams()
      if (filters.type) params.set("type", filters.type)
      if (filters.status) params.set("status", filters.status)
      if (filters.search) params.set("search", filters.search)
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom)
      if (filters.dateTo) params.set("dateTo", filters.dateTo)
      if (cursor) params.set("cursor", cursor)
      params.set("limit", String(filters.limit || 30))
      return `/api/transactions/unified?${params.toString()}`
    },
    [filters]
  )

  const fetchTransactions = useCallback(
    async (append = false) => {
      if (backendEnabled) return
      try {
        if (append) {
          setIsLoadingMore(true)
        } else {
          setIsLoading(true)
        }
        setError(null)

        const url = buildUrl(append ? nextCursor : undefined)
        const res = await fetch(url)
        const data = await res.json()

        if (!data.success) {
          throw new Error(data.message || "Failed to fetch transactions")
        }

        if (append) {
          setTransactions((prev) => [...prev, ...data.transactions])
        } else {
          setTransactions(data.transactions)
        }

        setStats(data.stats || DEFAULT_STATS)
        setHasMore(data.pagination?.hasMore ?? false)
        setNextCursor(data.pagination?.nextCursor)
      } catch (err) {
        console.error("Fetch transactions error:", err)
        setError(
          err instanceof Error ? err.message : "Failed to load transactions"
        )
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
      }
    },
    [backendEnabled, buildUrl, nextCursor]
  )

  useEffect(() => {
    if (backendEnabled) return
    setNextCursor(undefined)
    fetchTransactions(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    backendEnabled,
    filters.type,
    filters.status,
    filters.search,
    filters.dateFrom,
    filters.dateTo,
  ])

  useEffect(() => {
    if (backendEnabled || pollInterval <= 0) return

    pollRef.current = setInterval(() => {
      fetchTransactions(false)
    }, pollInterval)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendEnabled, pollInterval, filters])

  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore && nextCursor) {
      fetchTransactions(true)
    }
  }, [isLoadingMore, hasMore, nextCursor, fetchTransactions])

  const sentinelRef = useCallback(
    (node: HTMLElement | null) => {
      if (observerRef.current) observerRef.current.disconnect()
      if (!node) return

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
            loadMore()
          }
        },
        { rootMargin: "200px" }
      )
      observerRef.current.observe(node)
    },
    [hasMore, isLoadingMore, loadMore]
  )

  const setFilters = useCallback((partial: Partial<TransactionFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...partial }))
  }, [])

  const refresh = useCallback(() => {
    if (backendEnabled) {
      void cryptoQuery.refetch()
      return
    }
    setNextCursor(undefined)
    fetchTransactions(false)
  }, [backendEnabled, cryptoQuery, fetchTransactions])

  const backendTransactions = (demo ? (demoLedger?.records ?? []) : (cryptoQuery.data ?? []))
    .map((transaction) =>
      mapCryptoTransaction(transaction, registry, usdPrices, walletTokens)
    )
    .filter((transaction) => matchesCryptoFilters(transaction, filters))
  const visibleTransactions = backendEnabled || demo
    ? backendTransactions
    : transactions

  return {
    transactions: visibleTransactions,
    // Do not print a false $0 while the valuation index is still loading.
    stats: backendEnabled || demo
      ? usdPrices === null
        ? null
        : getCryptoStats(visibleTransactions)
      : stats,
    isLoading: demo ? !demoLedger : backendEnabled ? cryptoQuery.isLoading : isLoading,
    isLoadingMore: backendEnabled ? false : isLoadingMore,
    error: backendEnabled
      ? cryptoQuery.error instanceof Error
        ? cryptoQuery.error.message
        : cryptoQuery.error
          ? "Failed to load transactions"
          : null
      : error,
    hasMore: backendEnabled ? false : hasMore,
    filters,
    setFilters,
    loadMore,
    refresh,
    sentinelRef,
  }
}

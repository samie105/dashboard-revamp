"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@/components/auth-provider"
import { useWalletMode } from "@/components/wallet-mode-provider"
import {
  cryptoBackendClient,
  cryptoQueryKeys,
  isCryptoBackendEnabled,
} from "@/lib/crypto-backend"
import type { CryptoTransactionRecord } from "@/lib/crypto-backend"
import { describeLedgerRecord } from "@/lib/ledger-rows"
import { useSpotRegistry } from "@/hooks/useSpotRegistry"
import { modernDataEnabled } from "@/lib/wallet-mode"
import type {
  UnifiedTransaction,
  TransactionStats,
  TransactionFilters,
} from "@/types/transactions"

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

function mapCryptoTransaction(transaction: CryptoTransactionRecord, registry: ReturnType<typeof useSpotRegistry>): UnifiedTransaction {
  const described = describeLedgerRecord(transaction, registry)
  const summary = transaction.summary ?? {}
  const action = typeof summary.action === "string" ? summary.action : "transfer"
  const isSwap = action === "spot-swap" || action === "jupiter-swap"
  const asset = transaction.assetSummary
  const fallbackAmount = Number(summary.amount ?? transaction.amount ?? 0)
  const amount = described?.amountText ? Number(described.amountText.split(" ")[0].replaceAll(",", "")) : (Number.isFinite(fallbackAmount) ? fallbackAmount : 0)
  const token = described?.symbol || (isSwap ? String(summary.buyToken ?? asset?.identifier ?? "Unknown") : asset?.identifier ?? "Unknown")
  return {
    id: transaction.id,
    type: isSwap ? "swap" : "transfer",
    subType: isSwap ? "spot" : "send",
    amount,
    token,
    chain: transaction.networkId ?? transaction.chainFamily,
    status: mapCryptoStatus(transaction.status),
    fromAddress: transaction.fromAddress,
    toAddress: transaction.toAddress,
    txHash: transaction.txHash,
    direction: "outgoing",
    ...(isSwap ? {
      fromToken: typeof summary.sellToken === "string" ? summary.sellToken : undefined,
      toToken: typeof summary.buyToken === "string" ? summary.buyToken : undefined,
      // The backend stores this as the received token's base units. Keep the
      // row honest until both sides have independently known precision.
      toAmount: undefined,
      fromChain: transaction.networkId ?? transaction.chainFamily,
      toChain: typeof summary.destinationNetworkId === "string" ? summary.destinationNetworkId : transaction.networkId ?? transaction.chainFamily,
    } : {}),
    createdAt: transaction.createdAt ?? transaction.submittedAt ?? new Date(0).toISOString(),
    completedAt: transaction.confirmedAt,
  }
}

function matchesCryptoFilters(transaction: UnifiedTransaction, filters: TransactionFilters) {
  if (filters.type && transaction.type !== filters.type) return false
  if (filters.status && transaction.status !== filters.status) return false
  if (filters.search) {
    const search = filters.search.toLowerCase()
    const haystack = `${transaction.id} ${transaction.token} ${transaction.chain ?? ""} ${transaction.txHash ?? ""}`.toLowerCase()
    if (!haystack.includes(search)) return false
  }
  if (filters.dateFrom && transaction.createdAt < filters.dateFrom) return false
  if (filters.dateTo && transaction.createdAt > filters.dateTo) return false
  return true
}

function getCryptoStats(transactions: UnifiedTransaction[]): TransactionStats {
  return {
    ...DEFAULT_STATS,
    totalTransfers: transactions.length,
    netVolume: transactions.reduce((total, transaction) => total + transaction.amount, 0),
  }
}

export function useUnifiedTransactions(
  options: UseUnifiedTransactionsOptions = {},
): UseUnifiedTransactionsReturn {
  const { pollInterval = 30000 } = options
  const { user, isLoaded, isSignedIn } = useAuth()
  const { mode } = useWalletMode()
  const userId = user?.userId ?? "anonymous"
  const backendEnabled =
    modernDataEnabled({ modernEnabled: isCryptoBackendEnabled, mode }) && isLoaded && isSignedIn
  const registry = useSpotRegistry(backendEnabled)

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
    queryFn: ({ signal }) => cryptoBackendClient.listTransactions(filters.limit || 30, signal),
    enabled: backendEnabled,
  })

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
    [filters],
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
        setError(err instanceof Error ? err.message : "Failed to load transactions")
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
      }
    },
    [backendEnabled, buildUrl, nextCursor],
  )

  useEffect(() => {
    if (backendEnabled) return
    setNextCursor(undefined)
    fetchTransactions(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendEnabled, filters.type, filters.status, filters.search, filters.dateFrom, filters.dateTo])

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
        { rootMargin: "200px" },
      )
      observerRef.current.observe(node)
    },
    [hasMore, isLoadingMore, loadMore],
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

  const backendTransactions = (cryptoQuery.data ?? [])
    .map((transaction) => mapCryptoTransaction(transaction, registry))
    .filter((transaction) => matchesCryptoFilters(transaction, filters))
  const visibleTransactions = backendEnabled ? backendTransactions : transactions

  return {
    transactions: visibleTransactions,
    stats: backendEnabled ? getCryptoStats(visibleTransactions) : stats,
    isLoading: backendEnabled ? cryptoQuery.isLoading : isLoading,
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

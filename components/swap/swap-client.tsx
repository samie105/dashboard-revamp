"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { CardShell, CardHeader, EmptyState, SkeletonRows } from "@/components/ui/system"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { num, qty } from "@/lib/num"
import { PageHeader } from "@/components/ui/system"
import {
  CoinsSwapIcon,
  ArrowDown01Icon,
  Clock01Icon,
  Exchange01Icon,
  Search01Icon,
  Settings01Icon,
  InformationCircleIcon,
  Cancel01Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"
import type { CoinData } from "@/lib/actions"
import { ErrorState } from "@/components/error-state"
import { Skeleton } from "@/components/ui/skeleton"
import { useCryptoBalances, formatCryptoAmount } from "@/hooks/crypto/useCryptoBalances"
import { useCryptoWalletState } from "@/hooks/crypto/useCryptoWallet"
import { useAuth } from "@/components/auth-provider"
import { cryptoBackendClient, cryptoQueryKeys, isCryptoBackendEnabled } from "@/lib/crypto-backend"
import { signEvmIntent, signSolanaIntent, signSuiIntent } from "@/lib/crypto-wallet"
import { getUnlockedWalletState } from "@/lib/crypto-wallet/unlock-state"
import { toBaseUnits } from "@/lib/crypto-wallet/address-validation"

/* ── Token Select Modal ── */
function TokenSelectModal({
  open,
  onClose,
  coins,
  onSelect,
  exclude,
}: {
  open: boolean
  onClose: () => void
  coins: CoinData[]
  onSelect: (coin: CoinData) => void
  exclude?: string
}) {
  const [search, setSearch] = React.useState("")
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    if (open) document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open, onClose])

  React.useEffect(() => {
    if (open) setSearch("")
  }, [open])

  if (!open) return null

  const filtered = coins.filter((c) => {
    if (c.symbol === exclude) return false
    if (!search) return true
    const q = search.toLowerCase()
    return c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
  })

  const popular = ["BTC", "ETH", "SOL", "USDT", "USDC", "XRP"]

  return (
    <div className="ws-backdrop-in fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-md">
      <div ref={ref} className="ws-modal-in ws-glass ws-glass-edge relative w-full max-w-md rounded-2xl shadow-2xl ring-1 ring-foreground/10">
        <div className="flex items-center justify-between border-b border-border/30 p-4">
          <h3 className="text-sm font-semibold">Select Token</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">
          <div className="relative mb-3">
            <HugeiconsIcon icon={Search01Icon} className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or symbol..."
              className="w-full rounded-xl bg-accent/50 py-2.5 pl-9 pr-3 text-sm outline-none focus:bg-accent"
            />
          </div>

          {/* Popular tokens */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            {popular.map((sym) => {
              const coin = coins.find((c) => c.symbol === sym)
              if (!coin || coin.symbol === exclude) return null
              return (
                <button
                  key={sym}
                  onClick={() => { onSelect(coin); onClose() }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-surface-sunken px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
                >
                  {coin.image && <img src={coin.image} alt={sym} className="h-4 w-4 rounded-full" />}
                  {sym}
                </button>
              )
            })}
          </div>

          {/* Token list */}
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No tokens found</p>
            ) : (
              filtered.map((coin) => (
                <button
                  key={coin.symbol}
                  onClick={() => { onSelect(coin); onClose() }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent/50"
                >
                  {coin.image ? (
                    <img src={coin.image} alt={coin.symbol} className="h-8 w-8 rounded-full" />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {coin.symbol.slice(0, 2)}
                    </span>
                  )}
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm font-medium">{coin.name}</span>
                    <span className="text-xs text-muted-foreground">{coin.symbol}</span>
                  </div>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    ${coin.price.toLocaleString(undefined, { maximumFractionDigits: coin.price < 1 ? 4 : 2 })}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Swap Settings ── */
function SwapSettings({
  slippage,
  onSlippageChange,
  open,
  onToggle,
}: {
  slippage: number
  onSlippageChange: (v: number) => void
  open: boolean
  onToggle: () => void
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const presets = [0.1, 0.5, 1.0]

  React.useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onToggle()
    }
    if (open) document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open, onToggle])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={onToggle}
        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <HugeiconsIcon icon={Settings01Icon} className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl bg-card p-4 shadow-xl">
          <h4 className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Slippage Tolerance</h4>
          <div className="flex items-center gap-2">
            {presets.map((v) => (
              <button
                key={v}
                onClick={() => onSlippageChange(v)}
                className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                  slippage === v ? "bg-primary text-primary-foreground" : "bg-accent/50 hover:bg-accent"
                }`}
              >
                {v}%
              </button>
            ))}
            <div className="relative flex-1">
              <input
                type="text"
                inputMode="decimal"
                value={slippage}
                onChange={(e) => {
                  const val = parseFloat(e.target.value)
                  if (!isNaN(val) && val >= 0 && val <= 50) onSlippageChange(val)
                }}
                className="w-full rounded-lg bg-accent/50 px-2 py-1.5 text-center text-xs font-medium outline-none focus:bg-accent"
              />
              <span className="absolute right-2 top-1.5 text-xs text-muted-foreground">%</span>
            </div>
          </div>
          {slippage > 5 && (
            <p className="mt-2 text-xs text-warning">High slippage may result in unfavorable rates</p>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Quote Card ── */
function QuoteCard({
  fromSymbol,
  toSymbol,
  fromAmount,
  toAmount,
  fromPrice,
  toPrice,
  slippage,
  quoteData,
}: {
  fromSymbol: string
  toSymbol: string
  fromAmount: number
  toAmount: number
  fromPrice: number
  toPrice: number
  slippage: number
  quoteData?: QuoteData | null
}) {
  const rate = fromPrice / toPrice
  const minReceived = toAmount * (1 - slippage / 100)
  const priceImpact = quoteData?.priceImpact ?? (fromAmount * fromPrice > 100000 ? 0.15 : fromAmount * fromPrice > 10000 ? 0.05 : 0.01)

  return (
    <div className="rounded-xl bg-surface-sunken/70 p-3 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Exchange Rate</span>
        <span className="font-medium tabular-nums">
          1 {fromSymbol} = {rate.toLocaleString(undefined, { maximumFractionDigits: 6 })} {toSymbol}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Price Impact</span>
        <span className={`font-medium ${priceImpact > 1 ? "text-debit" : "text-credit"}`}>
          ~{priceImpact.toFixed(2)}%
        </span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Min. Received</span>
        <span className="font-medium tabular-nums">
          {minReceived.toLocaleString(undefined, { maximumFractionDigits: 6 })} {toSymbol}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Slippage</span>
        <span className="font-medium">{slippage}%</span>
      </div>

      {quoteData?.tool && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Route</span>
          <span className="font-medium">{quoteData.tool}</span>
        </div>
      )}
    </div>
  )
}

/* ── Swap History ── */
interface SwapTx {
  id: string
  /** Always present on a unified row — the asset the movement is denominated
   *  in. The from/to pair below is swap-specific and often missing. */
  token?: string
  fromToken?: string
  toToken?: string
  amount: number
  toAmount?: string
  fromChain?: string
  toChain?: string
  status: string
  txHash?: string
  createdAt: string
}

function SwapHistory() {
  const [swaps, setSwaps] = React.useState<SwapTx[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch("/api/transactions/unified?type=swap&limit=10")
        if (!res.ok) throw new Error("Failed to fetch")
        const data = await res.json()
        if (!cancelled) setSwaps(data.transactions ?? [])
      } catch {
        // silent — show empty state
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  /* Status washes match the transactions page: one vocabulary for state across
     the product, rather than a per-screen palette. */
  const statusChip = (st: string) => {
    switch (st) {
      case "completed": return "bg-credit-chip text-credit"
      case "failed": return "bg-debit-chip text-debit"
      case "cancelled":
      case "expired": return "bg-foreground/[0.06] text-muted-foreground"
      default: return "bg-warning-chip text-warning"
    }
  }

  const statusLabel = (st: string) => {
    switch (st) {
      case "completed": return "Completed"
      case "failed": return "Failed"
      case "pending": return "Pending"
      case "cancelled": return "Cancelled"
      default: return "Processing"
    }
  }

  /* The unified transaction row always carries `token`; `fromToken`/`toToken`
     are swap-specific and frequently absent. Reading only the optional pair
     rendered every row as a literal "? → ?" — a question mark is not a token,
     and printing one tells the reader their swap history is broken when it
     isn't. Fall back to what the row does carry, and say nothing about the
     half we genuinely don't know. */
  const pairOf = (tx: SwapTx) => {
    const from = tx.fromToken ?? tx.token
    const to = tx.toToken
    if (from && to) return `${from} → ${to}`
    if (from) return `${from} swap`
    return "Swap"
  }

  return (
    <CardShell>
      <CardHeader title="Recent swaps" subtitle="Your last ten conversions" />

      {loading ? (
        <SkeletonRows rows={3} label="Loading swap history" />
      ) : swaps.length === 0 ? (
        <EmptyState
          icon={({ className }) => <HugeiconsIcon icon={Exchange01Icon} className={className} />}
          title="No swaps yet"
          description="Conversions you make here will be listed with their status."
        />
      ) : (
        <div className="flex flex-col divide-y divide-border/10">
          {swaps.map((tx) => {
            const from = tx.fromToken ?? tx.token
            const received = tx.toAmount != null ? num(tx.toAmount) : null
            return (
              <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                {from ? (
                  <CoinAvatar symbol={from} size="lg" />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground/[0.06]">
                    <HugeiconsIcon icon={Exchange01Icon} className="h-4 w-4 text-muted-foreground" />
                  </span>
                )}

                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[14px] font-semibold">{pairOf(tx)}</span>
                  <span className="truncate text-[12.5px] text-muted-foreground">
                    {[
                      tx.fromChain && tx.toChain ? `${tx.fromChain} → ${tx.toChain}` : tx.fromChain,
                      new Date(tx.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[13px] font-semibold tabular-nums">
                    {qty(tx.amount)}
                    {received !== null ? ` → ${qty(received)}` : ""}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${statusChip(tx.status)}`}
                  >
                    {statusLabel(tx.status)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </CardShell>
  )
}

/* ── Chains ── */
const CHAINS = [
    { id: "ethereum", label: "Ethereum", icon: "https://coin-images.coingecko.com/coins/images/279/small/ethereum.png" },
    { id: "arbitrum", label: "Arbitrum", icon: "https://coin-images.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg" },
    { id: "solana", label: "Solana", icon: "https://coin-images.coingecko.com/coins/images/4128/small/solana.png" },
    { id: "sui", label: "Sui", icon: "https://coin-images.coingecko.com/coins/images/26375/small/sui_asset.jpeg" },
    { id: "ton", label: "Ton", icon: "https://coin-images.coingecko.com/coins/images/17980/small/toncoin.png" },
    { id: "tron", label: "Tron", icon: "https://coin-images.coingecko.com/coins/images/1094/small/tron-logo.png" },
]

// Map swap chain id → balance API chain names
const CHAIN_BALANCE_MAP: Record<string, string[]> = {
  ethereum: ["ethereum"],
  arbitrum: ["arbitrum"],
  solana: ["solana"],
  sui: ["sui"],
  ton: ["ton"],
  tron: ["tron"],
}

// Supported tokens per chain for LI.FI quotes
const SUPPORTED_SWAP_TOKENS: Record<string, string[]> = {
  ethereum: ["ETH", "USDT", "USDC"],
  arbitrum: ["ETH", "USDT", "USDC"],
  solana: ["SOL", "USDC", "USDT"],
  sui: ["SUI", "USDC", "USDT"],
  ton: ["TON", "USDT", "USDC"],
  tron: ["TRX", "USDT", "USDC"],
}

interface QuoteData {
  toAmount: string
  toAmountMin: string
  toAmountUSD: string
  fromAmountUSD: string
  priceImpact: number
  gasCostUSD: string
  tool: string
  toolLogoURI?: string
  executionData: { to: string; data: string; value: string; chainId: number; gasLimit?: string } | null
  fromToken: { chainId: number; address: string; symbol: string; decimals: number }
  toToken: { chainId: number; address: string; symbol: string; decimals: number }
}

/* ── Main SwapClient ── */
interface SwapClientProps {
  coins: CoinData[]
  prices: Record<string, number>
  error?: string
  compact?: boolean
}

export function SwapClient({ coins, prices, error, compact }: SwapClientProps) {
  const available = coins.filter((c) => c.price > 0)
  const { user } = useAuth()
  const { balances: modernBalances } = useCryptoBalances()
  const modernWallet = useCryptoWalletState()
  const modernPackage = useQuery({
    queryKey: cryptoQueryKeys.walletPackage(user?.userId ?? "anonymous"),
    queryFn: () => cryptoBackendClient.getWalletPackage(),
    enabled: isCryptoBackendEnabled && Boolean(modernWallet.data),
    staleTime: 3 * 60_000,
  })

  // URL params
  const [searchParams, setSearchParams] = React.useState<URLSearchParams | null>(null)
  React.useEffect(() => {
    setSearchParams(new URLSearchParams(window.location.search))
  }, [])

  const initFrom = searchParams?.get("from") || "USDT"
  const initTo = searchParams?.get("to") || "ETH"
  const initAmount = searchParams?.get("amount") || ""

  // State
  const [fromCoin, setFromCoin] = React.useState<CoinData | null>(null)
  const [toCoin, setToCoin] = React.useState<CoinData | null>(null)
  const [fromAmount, setFromAmount] = React.useState(initAmount)
  const [slippage, setSlippage] = React.useState(0.5)
  const [showSettings, setShowSettings] = React.useState(false)
  const [showFromModal, setShowFromModal] = React.useState(false)
  const [showToModal, setShowToModal] = React.useState(false)
  const [fromChain, setFromChain] = React.useState("ethereum")
  const [toChain, setToChain] = React.useState("ethereum")
  const [quoteLoading, setQuoteLoading] = React.useState(false)
  const [isDollarMode, setIsDollarMode] = React.useState(false)

  // Initialize from URL / defaults
  React.useEffect(() => {
    if (available.length > 0) {
      if (!fromCoin) {
        const fc = available.find((c) => c.symbol === initFrom) || available[0]
        setFromCoin(fc)
      }
      if (!toCoin) {
        const tc = available.find((c) => c.symbol === initTo) || available[1]
        setToCoin(tc)
      }
    }
  }, [available, initFrom, initTo, fromCoin, toCoin])

  // Real quote from LI.FI
  const [quoteData, setQuoteData] = React.useState<QuoteData | null>(null)
  const [quoteError, setQuoteError] = React.useState<string | null>(null)
  const [swapLoading, setSwapLoading] = React.useState(false)
  const [swapResult, setSwapResult] = React.useState<{ success: boolean; txHash?: string; error?: string; status?: string } | null>(null)

  const fromPrice = fromCoin ? (prices[fromCoin.symbol] ?? fromCoin.price) : 0
  const toPrice = toCoin ? (prices[toCoin.symbol] ?? toCoin.price) : 0

  // In dollar mode, fromAmount is USD; convert to token quantity for calculations
  const tokenAmount = isDollarMode && fromPrice > 0
    ? (parseFloat(fromAmount) || 0) / fromPrice
    : parseFloat(fromAmount) || 0
  const numericFrom = tokenAmount
  // Use real LI.FI quote output when available, fall back to price-based estimate
  const estimatedToFallback = toPrice > 0 ? (numericFrom * fromPrice) / toPrice : 0
  const estimatedTo = quoteData?.toAmount
    ? parseFloat(quoteData.toAmount) / Math.pow(10, quoteData.toToken.decimals)
    : estimatedToFallback
  const usdValue = numericFrom * fromPrice

  // Look up on-chain balance for the "from" coin (chain-aware)
  const fromCoinBalance = React.useMemo(() => {
    if (!fromCoin) return 0
    const chainNames = CHAIN_BALANCE_MAP[fromChain] ?? [fromChain]
    const networkIds = new Set(chainNames.map((chain) => ({ ethereum: "ethereum-mainnet", arbitrum: "arbitrum-one", solana: "solana-mainnet-beta", sui: "sui-mainnet", ton: "ton-mainnet", tron: "tron-mainnet" } as Record<string, string>)[chain]).filter(Boolean))
    return modernBalances
      .filter((b) => b.symbol.toUpperCase() === fromCoin.symbol.toUpperCase() && networkIds.has(b.networkId))
      .reduce((sum, b) => sum + Number(formatCryptoAmount(b.amountBaseUnits, b.decimals, 12)), 0)
  }, [modernBalances, fromCoin, fromChain])

  // Check if the from/to tokens are supported for real swap
  const fromSupported = SUPPORTED_SWAP_TOKENS[fromChain]?.includes(fromCoin?.symbol ?? "") ?? false
  const toSupported = SUPPORTED_SWAP_TOKENS[toChain]?.includes(toCoin?.symbol ?? "") ?? false
  const modernRouterAvailable = ["ethereum", "arbitrum", "solana", "sui"].includes(fromChain) && ["ethereum", "arbitrum", "solana", "sui"].includes(toChain)
  const canQuote = fromSupported && toSupported && modernRouterAvailable && isCryptoBackendEnabled

  // Fetch real LI.FI quote on amount/token/chain change
  React.useEffect(() => {
    if (numericFrom <= 0 || !fromCoin || !toCoin || !canQuote) {
      setQuoteData(null)
      setQuoteError(null)
      setQuoteLoading(false)
      return
    }
    setQuoteLoading(true)
    setQuoteError(null)
    const controller = new AbortController()
    const timeout = setTimeout(() => {
      const qs = new URLSearchParams({
        fromChain,
        toChain,
        fromToken: fromCoin.symbol,
        toToken: toCoin.symbol,
        amount: numericFrom.toString(),
        slippage: (slippage / 100).toString(),
      })
      fetch(`/api/crypto/trading/spot/lifi/quote?${qs}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.quote) {
            setQuoteData(data.quote)
            setQuoteError(null)
          } else {
            setQuoteData(null)
            setQuoteError(data.error || "Failed to get quote")
          }
        })
        .catch((err) => {
          if (err.name !== "AbortError") setQuoteError("Quote request failed")
        })
        .finally(() => setQuoteLoading(false))
    }, 600) // debounce
    return () => { clearTimeout(timeout); controller.abort() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromAmount, fromCoin?.symbol, toCoin?.symbol, fromChain, toChain, slippage, numericFrom, canQuote])

  // For non-supported pairs, fall back to client-side estimate
  React.useEffect(() => {
    if (!canQuote && numericFrom > 0 && fromCoin && toCoin) {
      setQuoteLoading(true)
      const t = setTimeout(() => setQuoteLoading(false), 300)
      return () => clearTimeout(t)
    }
  }, [canQuote, numericFrom, fromCoin, toCoin, fromAmount])

  // Execute swap through a modern unsigned intent. The quote is only routing
  // data; it never authorizes a server-side signature.
  const handleSwap = React.useCallback(async () => {
    if (!quoteData?.executionData || swapLoading) return
    setSwapLoading(true)
    setSwapResult(null)
    try {
      if (!user?.userId || !modernWallet.data?.id || !modernPackage.data) throw new Error("Set up and unlock the modern wallet before swapping")
      if (!getUnlockedWalletState(user.userId, modernWallet.data.id)) throw new Error("Unlock the modern wallet locally before swapping")
      const sourceFamily = fromChain === "solana" ? "solana" : fromChain === "sui" ? "sui" : "evm"
      const account = modernWallet.data.accounts.find((item) => item.chainFamily === sourceFamily && item.state === "active")
      if (!account?.id) throw new Error("Your modern wallet account for this network is not ready")
      const amountBaseUnits = toBaseUnits(String(numericFrom), quoteData.fromToken.decimals)
      if (!amountBaseUnits || amountBaseUnits === "0") throw new Error("The amount is too small for this token")
      const networkId = (chain: string) => chain === "ethereum" ? "ethereum-mainnet" : chain === "arbitrum" ? "arbitrum-one" : chain === "solana" ? "solana-mainnet-beta" : "sui-mainnet" as const
      const intent = await cryptoBackendClient.createModernLifiSwapIntent({ sourceNetworkId: networkId(fromChain), destinationNetworkId: networkId(toChain), sellToken: quoteData.fromToken.address, buyToken: quoteData.toToken.address, sellAmountBaseUnits: amountBaseUnits, slippagePercentage: slippage / 100 })
      const signed = sourceFamily === "solana"
        ? await signSolanaIntent(user.userId, modernWallet.data.id, modernPackage.data, intent, account.id)
        : sourceFamily === "sui"
          ? await signSuiIntent(user.userId, modernWallet.data.id, modernPackage.data, intent, account.id)
          : await signEvmIntent(user.userId, modernWallet.data.id, modernPackage.data, intent, account.id)
      await cryptoBackendClient.submitIntent(intent.id, signed)
      setSwapResult({ success: true, status: "PENDING" })
      setFromAmount(""); setQuoteData(null)
    } catch (error) {
      setSwapResult({ success: false, error: error instanceof Error ? error.message : "Swap failed" })
    } finally {
      setSwapLoading(false)
    }
  }, [quoteData, swapLoading, numericFrom, slippage, user, modernWallet.data, modernPackage.data, fromChain, toChain])

  function flipPair() {
    const tmpCoin = fromCoin
    const tmpChain = fromChain
    setFromCoin(toCoin)
    setToCoin(tmpCoin)
    setFromChain(toChain)
    setToChain(tmpChain)
    setFromAmount("")
    setIsDollarMode(false)
  }

  function setPercentage(pct: number) {
    if (fromCoinBalance <= 0) return
    const tokenAmt = fromCoinBalance * pct
    if (isDollarMode && fromPrice > 0) {
      setFromAmount((tokenAmt * fromPrice).toFixed(2))
    } else {
      setFromAmount(tokenAmt.toPrecision(6).replace(/\.?0+$/, ""))
    }
  }

  const insufficientBalance = numericFrom > 0 && fromCoinBalance > 0 && numericFrom > fromCoinBalance
  // Unsupported pairs have no execution path — the button must say so, not
  // sit enabled doing nothing on click.
  const canSwap = numericFrom > 0 && !!fromCoin && !!toCoin && !quoteLoading && !swapLoading && !insufficientBalance && canQuote && !!quoteData?.executionData

  const buttonText = React.useMemo(() => {
    if (!fromCoin || !toCoin) return "Select tokens"
    if (!modernRouterAvailable) return "Router unavailable for this network"
    if (!canQuote) return "Pair not supported yet"
    if (!fromAmount || numericFrom <= 0) return "Enter amount"
    if (insufficientBalance) return "Insufficient balance"
    if (swapLoading) return "Confirming swap..."
    if (quoteLoading) return "Fetching quote..."
    if (quoteError) return "Quote unavailable"
    if (!quoteData?.executionData && numericFrom > 0) return "No route found"
    return "Swap"
  }, [fromCoin, toCoin, fromAmount, numericFrom, quoteLoading, swapLoading, insufficientBalance, quoteError, canQuote, quoteData])

  const swapCard = (
    <>
          <div className="relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl bg-card/80">
            {/* Neutral corner-light ring — same shell grammar as the other
                dashboard cards (CardShell in ui/system). */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-2xl p-px"
              style={{
                background:
                  "linear-gradient(135deg, color-mix(in oklab, var(--foreground) 14%, transparent), color-mix(in oklab, var(--foreground) 4%, transparent) 40%, transparent 65%)",
                WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                WebkitMaskComposite: "xor",
                mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                maskComposite: "exclude",
              }}
            />
            {/* Card header */}
            <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
              <div className="flex min-w-0 flex-col">
                <h2 className="text-[15px] font-semibold leading-tight">Swap</h2>
                <span className="text-[13px] text-muted-foreground">Any pair, live rates</span>
              </div>
              <SwapSettings
                slippage={slippage}
                onSlippageChange={setSlippage}
                open={showSettings}
                onToggle={() => setShowSettings(!showSettings)}
              />
            </div>

            <div className="p-4">
              {error && available.length === 0 ? (
                <ErrorState message={error} />
              ) : (
              <>
              <div className="rounded-xl bg-surface-sunken/70 p-3.5">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-medium text-muted-foreground">You pay</span>
                  <span className="text-[11px] text-muted-foreground">Balance: {fromCoinBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setIsDollarMode(!isDollarMode)
                      // Convert current amount when toggling
                      const raw = parseFloat(fromAmount) || 0
                      if (raw > 0 && fromPrice > 0) {
                        if (!isDollarMode) {
                          // switching TO dollar mode: token → USD
                          setFromAmount((raw * fromPrice).toFixed(2))
                        } else {
                          // switching TO token mode: USD → token
                          setFromAmount((raw / fromPrice).toPrecision(6).replace(/\.?0+$/, ""))
                        }
                      }
                    }}
                    className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                      isDollarMode ? "bg-primary text-primary-foreground" : "bg-accent/50 text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                    title={isDollarMode ? "Switch to token amount" : "Switch to USD amount"}
                  >
                    $
                  </button>
                  <input
                    type="text"
                    inputMode="decimal"
                    data-vivid-target="swap-amount"
                    data-vivid-label="The amount to swap from"
                    value={fromAmount}
                    onChange={(e) => {
                      const v = e.target.value
                      if (/^[0-9]*\.?[0-9]*$/.test(v)) setFromAmount(v)
                    }}
                    placeholder={isDollarMode ? "$0.00" : "0.00"}
                    className="flex-1 min-w-0 bg-transparent text-xl font-semibold outline-none tabular-nums placeholder:text-muted-foreground/40"
                  />
                  <button
                    onClick={() => setShowFromModal(true)}
                    className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-2.5 py-1.5 transition-colors hover:bg-accent/70"
                  >
                    {fromCoin ? (
                      <>
                        {fromCoin.image && <img src={fromCoin.image} alt={fromCoin.symbol} className="h-5 w-5 rounded-full" />}
                        <span className="text-xs font-semibold">{fromCoin.symbol}</span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Select</span>
                    )}
                    <HugeiconsIcon icon={ArrowDown01Icon} className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
                {/* Percentage buttons */}
                <div className="flex items-center gap-1.5 mt-2.5">
                  {[0.25, 0.5, 0.75, 1].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => setPercentage(pct)}
                      className="flex-1 rounded-full bg-background/60 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      {pct === 1 ? "MAX" : `${pct * 100}%`}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-border/20">
                  {isDollarMode ? (
                    numericFrom > 0 ? (
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        ≈ {numericFrom.toLocaleString(undefined, { maximumFractionDigits: 6 })} {fromCoin?.symbol}
                      </p>
                    ) : <span />
                  ) : (
                    usdValue > 0 ? (
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        ≈ ${usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </p>
                    ) : <span />
                  )}
                  <button
                    onClick={() => { const idx = CHAINS.findIndex((c) => c.id === fromChain); setFromChain(CHAINS[(idx + 1) % CHAINS.length].id) }}
                    className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <img src={CHAINS.find((c) => c.id === fromChain)!.icon} alt="" className="h-3.5 w-3.5 rounded-full" />
                    {CHAINS.find((c) => c.id === fromChain)!.label}
                    <HugeiconsIcon icon={ArrowDown01Icon} className="h-2.5 w-2.5" />
                  </button>
                </div>
              </div>

              {/* ── Flip ── */}
              <div className="flex justify-center -my-2.5 relative z-10">
                <button
                  onClick={flipPair}
                  className="rounded-full border-4 border-card bg-accent p-1.5 text-muted-foreground shadow-sm transition-all hover:bg-primary hover:text-primary-foreground hover:scale-110"
                >
                  <HugeiconsIcon icon={Exchange01Icon} className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* ── To ── */}
              <div className="rounded-xl bg-surface-sunken/70 p-3.5">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-medium text-muted-foreground">You receive</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0 text-xl font-semibold tabular-nums">
                    {quoteLoading ? (
                      <Skeleton className="h-7 w-28" />
                    ) : estimatedTo > 0 ? (
                      estimatedTo.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })
                    ) : (
                      <span className="text-muted-foreground/40">0.00</span>
                    )}
                  </div>
                  <button
                    onClick={() => setShowToModal(true)}
                    className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-2.5 py-1.5 transition-colors hover:bg-accent/70"
                  >
                    {toCoin ? (
                      <>
                        {toCoin.image && <img src={toCoin.image} alt={toCoin.symbol} className="h-5 w-5 rounded-full" />}
                        <span className="text-xs font-semibold">{toCoin.symbol}</span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Select</span>
                    )}
                    <HugeiconsIcon icon={ArrowDown01Icon} className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-border/20">
                  {estimatedTo > 0 && toPrice > 0 && !quoteLoading ? (
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      ≈ ${(estimatedTo * toPrice).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                  ) : <span />}
                  <button
                    onClick={() => { const idx = CHAINS.findIndex((c) => c.id === toChain); setToChain(CHAINS[(idx + 1) % CHAINS.length].id) }}
                    className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <img src={CHAINS.find((c) => c.id === toChain)!.icon} alt="" className="h-3.5 w-3.5 rounded-full" />
                    {CHAINS.find((c) => c.id === toChain)!.label}
                    <HugeiconsIcon icon={ArrowDown01Icon} className="h-2.5 w-2.5" />
                  </button>
                </div>
              </div>

              {/* ── Quote Details ── */}
              {numericFrom > 0 && fromCoin && toCoin && !quoteLoading && (
                <div className="mt-3">
                  <QuoteCard
                    fromSymbol={fromCoin.symbol}
                    toSymbol={toCoin.symbol}
                    fromAmount={numericFrom}
                    toAmount={estimatedTo}
                    fromPrice={fromPrice}
                    toPrice={toPrice}
                    slippage={slippage}
                    quoteData={quoteData}
                  />
                </div>
              )}

              {/* ── Exchange rate inline ── */}
              {fromCoin && toCoin && toPrice > 0 && (
                <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                  <HugeiconsIcon icon={Exchange01Icon} className="h-3 w-3" />
                  <span className="tabular-nums">
                    1 {fromCoin.symbol} = {(fromPrice / toPrice).toLocaleString(undefined, { maximumFractionDigits: 6 })} {toCoin.symbol}
                  </span>
                </div>
              )}

              {/* Swap result banner */}
              {swapResult && (
                <div className={`mt-3 rounded-xl p-3 text-xs font-medium ${
                  swapResult.success && swapResult.status === "DONE"
                    ? "bg-credit-chip text-credit"
                    : swapResult.success && swapResult.status === "PENDING"
                    ? "bg-warning-chip text-warning"
                    : "bg-debit-chip text-debit"
                }`}>
                  {swapResult.success && swapResult.status === "DONE"
                    ? `Swap confirmed — ${swapResult.txHash?.slice(0, 10)}…${swapResult.txHash?.slice(-6)}. It will appear in your history shortly.`
                    : swapResult.success && swapResult.status === "PENDING"
                    ? `Swap submitted — waiting for the chain to confirm (${swapResult.txHash?.slice(0, 10)}…${swapResult.txHash?.slice(-6)}). Safe to leave this page.`
                    : swapResult.error}
                </div>
              )}

              {/* Quote error */}
              {quoteError && !quoteLoading && numericFrom > 0 && (
                <p className="mt-2 text-xs text-warning">{quoteError}</p>
              )}

              {/* ── Swap button ── */}
              <button
                disabled={!canSwap}
                onClick={handleSwap}
                data-vivid-target="swap-submit"
                data-vivid-guard=""
                aria-label="Execute swap"
                data-vivid-label="Execute the swap. Moves real money."
                className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {(quoteLoading || swapLoading) && <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" />}
                {buttonText}
              </button>
              </>
              )}
            </div>
          </div>

      {/* Token Modals */}
      <TokenSelectModal
        open={showFromModal}
        onClose={() => setShowFromModal(false)}
        coins={available}
        onSelect={setFromCoin}
        exclude={toCoin?.symbol}
      />
      <TokenSelectModal
        open={showToModal}
        onClose={() => setShowToModal(false)}
        coins={available}
        onSelect={setToCoin}
        exclude={fromCoin?.symbol}
      />
    </>
  )

  if (compact) return swapCard

  return (
    <>
      {/* Page header */}
      <div className="flex items-center justify-between mb-5">
        <PageHeader title="Swap" subtitle="Swap tokens across chains with the best rates" back="/" />
        {/* Six chain pills don't fit beside the title until well past `sm`,
            so the row scrolls rather than widening the page. */}
        <div className="hidden min-w-0 shrink items-center gap-2 overflow-x-auto sm:flex scrollbar-none">
          {CHAINS.map((chain) => (
            <div key={chain.id} className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent/30 px-2.5 py-1">
              <img src={chain.icon} alt={chain.label} className="h-3.5 w-3.5 rounded-full" />
              <span className="text-[10px] font-medium">{chain.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tight 2-column grid: swap card left, info stacked right */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px]">
        {/* LEFT — Swap card */}
        <div>
          {swapCard}
        </div>

        {/* RIGHT — Info cards stacked */}
        <div className="flex flex-col gap-4">
          {/* "How it works" — four generic steps that narrated the form beside
              them — is gone, the same call made on Portfolio. Guidance next to
              the thing beats guidance about the thing, and the swap card's own
              subtitle already says what it does. */}
          <SwapHistory />
        </div>
      </div>
    </>
  )
}

"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
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
import { useWalletBalances } from "@/hooks/useWalletBalances"

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div ref={ref} className="w-full max-w-md rounded-2xl bg-card shadow-2xl">
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
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border/40 px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
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
        <div className="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl border border-border/40 bg-card p-4 shadow-xl">
          <h4 className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Slippage Tolerance</h4>
          <div className="flex items-center gap-2">
            {presets.map((v) => (
              <button
                key={v}
                onClick={() => onSlippageChange(v)}
                className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                  slippage === v ? "bg-primary text-white" : "bg-accent/50 hover:bg-accent"
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
            <p className="mt-2 text-xs text-amber-500">High slippage may result in unfavorable rates</p>
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
}: {
  fromSymbol: string
  toSymbol: string
  fromAmount: number
  toAmount: number
  fromPrice: number
  toPrice: number
  slippage: number
}) {
  const rate = fromPrice / toPrice
  const minReceived = toAmount * (1 - slippage / 100)
  const priceImpact = fromAmount * fromPrice > 100000 ? 0.15 : fromAmount * fromPrice > 10000 ? 0.05 : 0.01

  return (
    <div className="rounded-xl border border-border/30 bg-accent/20 p-3 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Exchange Rate</span>
        <span className="font-medium tabular-nums">
          1 {fromSymbol} = {rate.toLocaleString(undefined, { maximumFractionDigits: 6 })} {toSymbol}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Price Impact</span>
        <span className={`font-medium ${priceImpact > 1 ? "text-red-500" : "text-emerald-500"}`}>
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
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Network Fee</span>
        <span className="font-medium text-muted-foreground">~$0.50</span>
      </div>
    </div>
  )
}

/* ── Swap History (Empty state — no mock data) ── */
function SwapHistory() {
  return (
    <div className="rounded-2xl border border-border/40 bg-card">
      <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={Clock01Icon} className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-xs font-semibold">Recent Swaps</h3>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center gap-2 px-4 py-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/50">
          <HugeiconsIcon icon={Exchange01Icon} className="h-5 w-5 text-muted-foreground/40" />
        </div>
        <p className="text-xs font-medium text-muted-foreground">No swap history yet</p>
        <p className="text-[10px] text-muted-foreground/60">Your completed swaps will appear here</p>
      </div>
    </div>
  )
}

/* ── How It Works Timeline ── */
const STEPS = [
  { title: "Select tokens", desc: "Choose tokens and networks" },
  { title: "Review quote", desc: "Check rates, fees & slippage" },
  { title: "Confirm swap", desc: "Sign in your wallet" },
  { title: "Track progress", desc: "Monitor until complete" },
]

function HowItWorks() {
  return (
    <div className="rounded-2xl border border-border/40 bg-card">
      <div className="flex items-center gap-2 border-b border-border/30 px-4 py-3">
        <HugeiconsIcon icon={InformationCircleIcon} className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-xs font-semibold">How it works</h3>
      </div>
      <div className="px-4 py-4">
        <div className="relative pl-5">
          {/* Timeline line */}
          <div className="absolute left-1.75 top-1 bottom-1 w-px bg-border/50" />
          <div className="space-y-4">
            {STEPS.map((item, i) => (
              <div key={i} className="relative flex items-start gap-3">
                {/* Timeline dot */}
                <div className="absolute -left-5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-primary/40 bg-card">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium leading-tight">{item.title}</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Chains ── */
const CHAINS = [
  { id: "solana", label: "Solana", icon: "https://coin-images.coingecko.com/coins/images/4128/small/solana.png" },
  { id: "ethereum", label: "Ethereum", icon: "https://coin-images.coingecko.com/coins/images/279/small/ethereum.png" },
]

/* ── Main SwapClient ── */
interface SwapClientProps {
  coins: CoinData[]
  prices: Record<string, number>
  error?: string
  compact?: boolean
}

export function SwapClient({ coins, prices, error, compact }: SwapClientProps) {
  const available = coins.filter((c) => c.price > 0)
  const { balances } = useWalletBalances()

  // URL params
  const [searchParams, setSearchParams] = React.useState<URLSearchParams | null>(null)
  React.useEffect(() => {
    setSearchParams(new URLSearchParams(window.location.search))
  }, [])

  const initFrom = searchParams?.get("from") || "SOL"
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
  const [fromChain, setFromChain] = React.useState("solana")
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

  const fromPrice = fromCoin ? (prices[fromCoin.symbol] ?? fromCoin.price) : 0
  const toPrice = toCoin ? (prices[toCoin.symbol] ?? toCoin.price) : 0

  // In dollar mode, fromAmount is USD; convert to token quantity for calculations
  const tokenAmount = isDollarMode && fromPrice > 0
    ? (parseFloat(fromAmount) || 0) / fromPrice
    : parseFloat(fromAmount) || 0
  const numericFrom = tokenAmount
  const estimatedTo = toPrice > 0 ? (numericFrom * fromPrice) / toPrice : 0
  const usdValue = numericFrom * fromPrice

  // Look up on-chain balance for the "from" coin
  const fromCoinBalance = React.useMemo(() => {
    if (!fromCoin) return 0
    const match = balances.find((b) => b.symbol.toUpperCase() === fromCoin.symbol.toUpperCase())
    return match?.balance ?? 0
  }, [balances, fromCoin])

  // Simulate quote loading on amount change
  React.useEffect(() => {
    if (numericFrom > 0 && fromCoin && toCoin) {
      setQuoteLoading(true)
      const t = setTimeout(() => setQuoteLoading(false), 400)
      return () => clearTimeout(t)
    }
  }, [fromAmount, fromCoin?.symbol, toCoin?.symbol, numericFrom])

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

  const canSwap = numericFrom > 0 && fromCoin && toCoin && !quoteLoading

  const buttonText = React.useMemo(() => {
    if (!fromCoin || !toCoin) return "Select tokens"
    if (!fromAmount || numericFrom <= 0) return "Enter amount"
    if (quoteLoading) return "Fetching quote..."
    return "Swap"
  }, [fromCoin, toCoin, fromAmount, numericFrom, quoteLoading])

  const swapCard = (
    <>
          <div className="rounded-2xl border border-border/40 bg-card shadow-sm">
            {/* Card header */}
            <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
              <div className="flex items-center gap-2">
                <HugeiconsIcon icon={CoinsSwapIcon} className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Swap</h2>
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
              <div className="rounded-xl border border-border/30 bg-accent/20 p-3.5">
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
                      isDollarMode ? "bg-primary text-white" : "bg-accent/50 text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                    title={isDollarMode ? "Switch to token amount" : "Switch to USD amount"}
                  >
                    $
                  </button>
                  <input
                    type="text"
                    inputMode="decimal"
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
                    className="flex shrink-0 items-center gap-1.5 rounded-full bg-card border border-border/40 px-2.5 py-1.5 transition-colors hover:bg-accent"
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
                      className="flex-1 rounded-lg bg-accent/50 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
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
                    onClick={() => setFromChain(fromChain === "solana" ? "ethereum" : "solana")}
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
                  className="rounded-full border-4 border-card bg-accent p-1.5 text-muted-foreground shadow-sm transition-all hover:bg-primary hover:text-white hover:scale-110"
                >
                  <HugeiconsIcon icon={Exchange01Icon} className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* ── To ── */}
              <div className="rounded-xl border border-border/30 bg-accent/20 p-3.5">
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
                    className="flex shrink-0 items-center gap-1.5 rounded-full bg-card border border-border/40 px-2.5 py-1.5 transition-colors hover:bg-accent"
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
                    onClick={() => setToChain(toChain === "solana" ? "ethereum" : "solana")}
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

              {/* ── Swap button ── */}
              <button
                disabled={!canSwap}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-all hover:bg-primary/90 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {quoteLoading && <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" />}
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
      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-bold tracking-tight">Swap</h1>
          <p className="text-xs text-muted-foreground">
            Swap tokens across chains with the best rates
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          {CHAINS.map((chain) => (
            <div key={chain.id} className="flex items-center gap-1.5 rounded-full border border-border/40 bg-accent/30 px-2.5 py-1">
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
          <SwapHistory />
          <HowItWorks />
        </div>
      </div>
    </>
  )
}

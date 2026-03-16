"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowUp01Icon,
  ArrowDown01Icon,
  Search01Icon,
  Chart01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons"
import type {
  FuturesMarket,
  OrderBookLevel,
} from "@/lib/actions"
import {
  getOrderBook,
  getFuturesMarkets,
} from "@/lib/actions"
import { useAuth } from "@/components/auth-provider"
import { useWallet } from "@/components/wallet-provider"
import { useProfile } from "@/components/profile-provider"
import { executeTrade } from "@/lib/actions"
import { markOnboardingComplete } from "@/lib/profile-actions"
import { Navbar } from "@/components/navbar"
import { OnboardingFlow, type OnboardingStep } from "@/components/onboarding-flow"
import { FuturesChart } from "./futures-chart"
import { usePanelLayout } from "@/hooks/usePanelLayout"

// ── Types ──────────────────────────────────────────────────────────────────

interface FuturesClientProps {
  markets: FuturesMarket[]
  prices: Record<string, number>
  initialOrderBook?: { asks: OrderBookLevel[]; bids: OrderBookLevel[] }
  error?: string
}

type Side = "long" | "short"
type FuturesOrderType = "market" | "limit"
type MobileTab = "chart" | "book" | "markets"

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtVol(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return n.toFixed(0)
}

function fmtPrice(p: number) {
  if (p >= 1000) return p.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (p >= 1) return p.toFixed(4)
  return p.toPrecision(4)
}

function fmtFunding(r: number) {
  return `${(r * 100).toFixed(4)}%`
}

// ── Market List ────────────────────────────────────────────────────────────

function MarketList({
  markets,
  selected,
  onSelect,
}: {
  markets: FuturesMarket[]
  selected: string
  onSelect: (s: string) => void
}) {
  const [search, setSearch] = React.useState("")
  const filtered = React.useMemo(() => {
    if (!search) return markets
    const q = search.toLowerCase()
    return markets.filter((m) => m.symbol.toLowerCase().includes(q))
  }, [markets, search])

  return (
    <div className="flex h-full flex-col rounded-xl bg-card overflow-hidden">
      <div className="border-b border-border/20 px-2 py-2">
        <div className="relative">
          <HugeiconsIcon icon={Search01Icon} className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full rounded-lg bg-accent/40 py-1.5 pl-7 pr-2 text-[11px] outline-none focus:bg-accent"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.map((m) => (
          <button
            key={m.symbol}
            onClick={() => onSelect(m.symbol)}
            className={`flex w-full items-center justify-between px-2 py-1.5 text-[11px] transition-colors ${
              selected === m.symbol ? "bg-accent/50" : "hover:bg-accent/30"
            }`}
          >
            <div className="flex flex-col items-start">
              <span className="font-medium">{m.symbol}-PERP</span>
              <span className="text-[9px] text-muted-foreground">{fmtVol(m.volume24h)}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="tabular-nums font-medium">${fmtPrice(m.markPrice)}</span>
              <span
                className={`text-[9px] tabular-nums font-medium ${
                  m.change24h >= 0 ? "text-emerald-500" : "text-red-500"
                }`}
              >
                {m.change24h >= 0 ? "+" : ""}{m.change24h.toFixed(2)}%
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Order Book (compact) ───────────────────────────────────────────────────

function FuturesOrderBook({
  asks,
  bids,
  markPrice,
}: {
  asks: OrderBookLevel[]
  bids: OrderBookLevel[]
  markPrice: number
}) {
  const topAsks = asks.slice(0, 12)
  const topBids = bids.slice(0, 12)
  const maxAskTotal = topAsks.length > 0 ? Math.max(...topAsks.map((a) => a.total)) : 1
  const maxBidTotal = topBids.length > 0 ? Math.max(...topBids.map((b) => b.total)) : 1

  return (
    <div className="flex h-full flex-col rounded-xl bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/20 px-3 py-2">
        <span className="text-[11px] font-semibold">Order Book</span>
      </div>
      <div className="flex-1 overflow-hidden flex flex-col text-[10px] tabular-nums">
        {/* Header */}
        <div className="flex items-center justify-between px-2 py-1 text-muted-foreground">
          <span>Price</span>
          <span>Size</span>
        </div>
        {/* Asks (reversed so lowest is at bottom) */}
        <div className="flex-1 flex flex-col justify-end overflow-hidden">
          {[...topAsks].reverse().map((a, i) => (
            <div key={`a-${i}`} className="relative flex items-center justify-between px-2 py-[2px]">
              <div
                className="absolute inset-y-0 right-0 bg-red-500/8"
                style={{ width: `${(a.total / maxAskTotal) * 100}%` }}
              />
              <span className="relative text-red-400">{fmtPrice(a.price)}</span>
              <span className="relative text-muted-foreground">{a.amount.toFixed(4)}</span>
            </div>
          ))}
        </div>
        {/* Spread */}
        <div className="flex items-center justify-center py-1.5 border-y border-border/20">
          <span className="font-bold text-xs">${fmtPrice(markPrice)}</span>
        </div>
        {/* Bids */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {topBids.map((b, i) => (
            <div key={`b-${i}`} className="relative flex items-center justify-between px-2 py-[2px]">
              <div
                className="absolute inset-y-0 right-0 bg-emerald-500/8"
                style={{ width: `${(b.total / maxBidTotal) * 100}%` }}
              />
              <span className="relative text-emerald-400">{fmtPrice(b.price)}</span>
              <span className="relative text-muted-foreground">{b.amount.toFixed(4)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Order Form ─────────────────────────────────────────────────────────────

function FuturesOrderForm({
  market,
}: {
  market: FuturesMarket
}) {
  const { user, isSignedIn } = useAuth()
  const { walletsGenerated } = useWallet()

  const [side, setSide] = React.useState<Side>("long")
  const [orderType, setOrderType] = React.useState<FuturesOrderType>("market")
  const [leverage, setLeverage] = React.useState(10)
  const [sizeUsd, setSizeUsd] = React.useState("")
  const [limitPrice, setLimitPrice] = React.useState("")
  const [isExecuting, setIsExecuting] = React.useState(false)
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; message: string } | null>(null)

  const numSize = parseFloat(sizeUsd) || 0
  const effectivePrice = orderType === "market" ? market.markPrice : (parseFloat(limitPrice) || market.markPrice)
  const margin = numSize / leverage
  const estLiquidation = side === "long"
    ? effectivePrice * (1 - 1 / leverage * 0.9)
    : effectivePrice * (1 + 1 / leverage * 0.9)
  const canTrade = isSignedIn && walletsGenerated && numSize > 0 && !isExecuting

  React.useEffect(() => {
    if (!feedback) return
    const t = setTimeout(() => setFeedback(null), 4_000)
    return () => clearTimeout(t)
  }, [feedback])

  async function handleExecute() {
    if (!canTrade || !user?.userId) return
    setIsExecuting(true)
    setFeedback(null)
    try {
      const result = await executeTrade({
        userId: user.userId,
        fromChain: 1,
        tokenIn: "USDT",
        tokenOut: `${market.symbol}-PERP-${side.toUpperCase()}`,
        amountIn: sizeUsd,
        slippage: 0.005,
      })
      if (result.success) {
        setFeedback({ type: "success", message: result.txHash ? `Opened • ${result.txHash.slice(0, 10)}…` : "Position opened" })
        setSizeUsd("")
      } else {
        setFeedback({ type: "error", message: result.error || "Failed" })
      }
    } catch {
      setFeedback({ type: "error", message: "Network error" })
    } finally {
      setIsExecuting(false)
    }
  }

  return (
    <div className="flex h-full flex-col rounded-xl bg-card overflow-hidden">
      <div className="border-b border-border/20 px-3 py-2">
        <span className="text-[11px] font-semibold">Place Order</span>
      </div>
      <div className="flex flex-col gap-2 p-3 text-[11px]">
        {/* Long / Short toggle */}
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-accent/30 p-0.5">
          <button
            onClick={() => setSide("long")}
            className={`rounded-md py-1.5 text-xs font-bold transition-colors ${
              side === "long" ? "bg-emerald-500 text-white" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Long
          </button>
          <button
            onClick={() => setSide("short")}
            className={`rounded-md py-1.5 text-xs font-bold transition-colors ${
              side === "short" ? "bg-red-500 text-white" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Short
          </button>
        </div>

        {/* Order type */}
        <div className="flex gap-1 rounded-md bg-accent/30 p-0.5">
          {(["market", "limit"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setOrderType(t)}
              className={`flex-1 rounded-md px-2 py-1 text-[10px] font-medium capitalize transition-colors ${
                orderType === t ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Price (limit only) */}
        {orderType === "limit" && (
          <div>
            <label className="mb-0.5 block text-[10px] text-muted-foreground">Price</label>
            <input
              type="text"
              inputMode="decimal"
              value={limitPrice}
              onChange={(e) => { if (/^[0-9]*\.?[0-9]*$/.test(e.target.value)) setLimitPrice(e.target.value) }}
              placeholder={fmtPrice(market.markPrice)}
              className="w-full rounded-lg bg-accent/40 py-1.5 px-3 text-sm tabular-nums outline-none focus:bg-accent"
            />
          </div>
        )}

        {/* Size */}
        <div>
          <label className="mb-0.5 block text-[10px] text-muted-foreground">Size (USD)</label>
          <input
            type="text"
            inputMode="decimal"
            value={sizeUsd}
            onChange={(e) => { if (/^[0-9]*\.?[0-9]*$/.test(e.target.value)) setSizeUsd(e.target.value) }}
            placeholder="0.00"
            className="w-full rounded-lg bg-accent/40 py-1.5 px-3 text-sm tabular-nums outline-none focus:bg-accent"
          />
        </div>

        {/* Leverage slider */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] text-muted-foreground">Leverage</label>
            <span className="text-xs font-bold tabular-nums">{leverage}x</span>
          </div>
          <input
            type="range"
            min={1}
            max={Math.min(market.maxLeverage, 100)}
            value={leverage}
            onChange={(e) => setLeverage(Number(e.target.value))}
            className="w-full accent-primary h-1.5"
          />
          <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
            <span>1x</span>
            <span>{Math.min(market.maxLeverage, 100)}x</span>
          </div>
        </div>

        {/* Quick size % */}
        <div className="flex gap-1">
          {[25, 50, 75, 100].map((p) => (
            <button
              key={p}
              onClick={() => setSizeUsd(String(p))}
              className="flex-1 rounded-md py-1 bg-accent/30 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              ${p}
            </button>
          ))}
        </div>

        {/* Summary */}
        <div className="space-y-1 rounded-lg bg-accent/20 px-2.5 py-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Margin</span>
            <span className="tabular-nums">${margin > 0 ? margin.toFixed(2) : "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Est. Liq. Price</span>
            <span className="tabular-nums">{numSize > 0 ? `$${fmtPrice(estLiquidation)}` : "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fee (0.05%)</span>
            <span className="tabular-nums">${numSize > 0 ? (numSize * 0.0005).toFixed(2) : "—"}</span>
          </div>
        </div>

        {feedback && (
          <div className={`rounded-lg px-3 py-1.5 text-[10px] font-medium ${
            feedback.type === "success" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
          }`}>
            {feedback.message}
          </div>
        )}

        <button
          disabled={!canTrade}
          onClick={handleExecute}
          className={`w-full rounded-lg py-2.5 text-xs font-bold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            side === "long" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-red-500 hover:bg-red-600"
          }`}
        >
          {isExecuting
            ? "Executing…"
            : !isSignedIn
              ? "Sign in to trade"
              : !walletsGenerated
                ? "Setting up wallet…"
                : `${side === "long" ? "Long" : "Short"} ${market.symbol}`}
        </button>
      </div>
    </div>
  )
}

// ── Positions Panel ────────────────────────────────────────────────────────

function PositionsPanel() {
  return (
    <div data-onboarding="futures-positions" className="flex h-full flex-col rounded-xl bg-card overflow-hidden">
      <div className="flex items-center gap-4 border-b border-border/20 px-3 py-2">
        <span className="text-xs font-semibold text-foreground">Positions</span>
        <span className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
          Open Orders
        </span>
        <span className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
          Trade History
        </span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/40">
          <HugeiconsIcon icon={Chart01Icon} className="h-4 w-4 text-muted-foreground/40" />
        </div>
        <p className="text-xs text-muted-foreground">No open positions</p>
      </div>
    </div>
  )
}

// ── Onboarding Steps ───────────────────────────────────────────────────────

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    target: '[data-onboarding="futures-topbar"]',
    title: "Market Overview",
    description: "See the current price, 24h change, volume, open interest, and funding rate for the selected perpetual contract.",
    placement: "bottom",
  },
  {
    target: '[data-onboarding="futures-markets"]',
    title: "Markets List",
    description: "Browse and search all available futures markets. Click any pair to switch. Panels are resizable — drag the edges to adjust.",
    placement: "right",
  },
  {
    target: '[data-onboarding="futures-chart"]',
    title: "Price Chart",
    description: "Interactive candlestick chart powered by TradingView's lightweight-charts. Switch timeframes using the toolbar above.",
    placement: "bottom",
  },
  {
    target: '[data-onboarding="futures-orderbook"]',
    title: "Order Book",
    description: "Real-time order book showing bid and ask depth. The spread and mark price are shown in the center.",
    placement: "left",
  },
  {
    target: '[data-onboarding="futures-order"]',
    title: "Place Orders",
    description: "Open long or short positions with market or limit orders. Set your leverage, size, and review margin before executing.",
    placement: "left",
  },
  {
    target: '[data-onboarding="futures-positions"]',
    title: "Positions & History",
    description: "Track your open positions, pending orders, and trade history here. Manage and close positions in real-time.",
    placement: "top",
  },
]

// ── Main Client ────────────────────────────────────────────────────────────

export function FuturesClient({ markets, prices, initialOrderBook }: FuturesClientProps) {
  const router = useRouter()
  const { profile } = useProfile()
  const [selected, setSelected] = React.useState(markets[0]?.symbol ?? "BTC")
  const [mobileTab, setMobileTab] = React.useState<MobileTab>("chart")
  const [liveMarkets, setLiveMarkets] = React.useState(markets)

  const [orderBookAsks, setOrderBookAsks] = React.useState<OrderBookLevel[]>(initialOrderBook?.asks ?? [])
  const [orderBookBids, setOrderBookBids] = React.useState<OrderBookLevel[]>(initialOrderBook?.bids ?? [])

  const market = liveMarkets.find((m) => m.symbol === selected) ?? liveMarkets[0]
  const isOnboardingDone = profile?.onboardingCompleted?.includes("futures")
  const { collapsed, toggle } = usePanelLayout()

  // Poll futures markets every 10s
  React.useEffect(() => {
    let cancelled = false
    async function poll() {
      try {
        const r = await getFuturesMarkets()
        if (!cancelled && r.success) setLiveMarkets(r.markets)
      } catch { /* ignore */ }
    }
    const id = setInterval(poll, 10_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  // Poll order book every 3s
  React.useEffect(() => {
    let cancelled = false
    async function poll() {
      try {
        const pair = `${selected}USDT`
        const r = await getOrderBook(pair, 20)
        if (!cancelled && r.success) {
          setOrderBookAsks(r.asks)
          setOrderBookBids(r.bids)
        }
      } catch { /* ignore */ }
    }
    poll()
    const id = setInterval(poll, 3_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [selected])

  if (!market) return null

  const mobileTabs: { id: MobileTab; label: string }[] = [
    { id: "chart", label: "Chart" },
    { id: "book", label: "Book" },
    { id: "markets", label: "Markets" },
  ]

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Navbar */}
      <Navbar hideDiscover />
      {/* ── Top Bar ── */}
      <div data-onboarding="futures-topbar" className="flex items-center gap-3 border-b border-border/10 px-3 py-2">
        <button onClick={() => router.push("/")} className="text-muted-foreground hover:text-foreground">
          <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">{market.symbol}-PERP</span>
          <span className={`text-xs font-semibold ${market.change24h >= 0 ? "text-emerald-500" : "text-red-500"}`}>
            {market.change24h >= 0 ? "+" : ""}{market.change24h.toFixed(2)}%
          </span>
        </div>
        <span className="text-lg font-bold tabular-nums ml-2">${fmtPrice(market.markPrice)}</span>
        <div className="ml-auto hidden sm:flex items-center gap-4 text-[10px] text-muted-foreground">
          <span>Vol <span className="text-foreground font-medium">{fmtVol(market.volume24h)}</span></span>
          <span>OI <span className="text-foreground font-medium">{fmtVol(market.openInterest)}</span></span>
          <span>Funding <span className="text-foreground font-medium">{fmtFunding(market.fundingRate)}</span></span>
          <span>Max <span className="text-foreground font-medium">{market.maxLeverage}x</span></span>
        </div>
      </div>

      {/* ═══ DESKTOP: 3-column grid layout ═══ */}
      <div className="hidden lg:flex flex-1 flex-col overflow-hidden p-1 gap-1">
        {/* MAIN ROW */}
        <div className="flex-1 min-h-0 flex gap-1 overflow-hidden">
          {/* LEFT — Market list */}
          {collapsed.left ? (
            <button
              onClick={() => toggle("left")}
              className="shrink-0 w-6 flex flex-col items-center justify-center rounded-xl bg-card border border-border/20 hover:bg-accent/50 transition-colors group"
              title="Expand markets"
            >
              <HugeiconsIcon icon={ArrowRight01Icon} className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
              <span className="text-[9px] text-muted-foreground [writing-mode:vertical-lr] mt-1">Markets</span>
            </button>
          ) : (
            <div data-onboarding="futures-markets" className="shrink-0 w-[260px] xl:w-[300px] overflow-hidden relative">
              <button
                onClick={() => toggle("left")}
                className="absolute top-1 right-1 z-10 rounded-md p-0.5 bg-card/80 border border-border/20 hover:bg-accent transition-colors"
                title="Collapse markets"
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} className="h-3 w-3 text-muted-foreground" />
              </button>
              <MarketList markets={liveMarkets} selected={selected} onSelect={setSelected} />
            </div>
          )}

          {/* CENTER — Chart + Order Form */}
          <div className="flex-1 min-w-0 flex flex-col gap-1 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-hidden">
              <FuturesChart
                symbol={selected}
                markPrice={market.markPrice}
                change24h={market.change24h}
              />
            </div>
            <div data-onboarding="futures-order" className="shrink-0 overflow-hidden">
              <FuturesOrderForm market={market} />
            </div>
          </div>

          {/* RIGHT — Order Book */}
          {collapsed.right ? (
            <button
              onClick={() => toggle("right")}
              className="shrink-0 w-6 flex flex-col items-center justify-center rounded-xl bg-card border border-border/20 hover:bg-accent/50 transition-colors group"
              title="Expand order book"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
              <span className="text-[9px] text-muted-foreground [writing-mode:vertical-lr] mt-1">Book</span>
            </button>
          ) : (
            <div data-onboarding="futures-orderbook" className="shrink-0 w-[260px] xl:w-[300px] overflow-hidden relative">
              <button
                onClick={() => toggle("right")}
                className="absolute top-1 right-1 z-10 rounded-md p-0.5 bg-card/80 border border-border/20 hover:bg-accent transition-colors"
                title="Collapse order book"
              >
                <HugeiconsIcon icon={ArrowRight01Icon} className="h-3 w-3 text-muted-foreground" />
              </button>
              <FuturesOrderBook asks={orderBookAsks} bids={orderBookBids} markPrice={market.markPrice} />
            </div>
          )}
        </div>

        {/* BOTTOM ROW — Positions (standalone) */}
        {collapsed.bottom ? (
          <button
            onClick={() => toggle("bottom")}
            className="shrink-0 h-6 flex items-center justify-center gap-1.5 rounded-xl bg-card border border-border/20 hover:bg-accent/50 transition-colors group"
            title="Expand positions"
          >
            <HugeiconsIcon icon={ArrowUp01Icon} className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
            <span className="text-[9px] text-muted-foreground">Positions</span>
          </button>
        ) : (
          <div className="shrink-0 h-[200px] relative">
            <button
              onClick={() => toggle("bottom")}
              className="absolute top-1 right-1 z-10 rounded-md p-0.5 bg-card/80 border border-border/20 hover:bg-accent transition-colors"
              title="Collapse positions"
            >
              <HugeiconsIcon icon={ArrowDown01Icon} className="h-3 w-3 text-muted-foreground" />
            </button>
            <PositionsPanel />
          </div>
        )}
      </div>

      {/* ═══ MOBILE layout ═══ */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pt-2 pb-4 lg:hidden">
        {/* Mobile stats bar */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span>Vol <span className="text-foreground">{fmtVol(market.volume24h)}</span></span>
          <span>OI <span className="text-foreground">{fmtVol(market.openInterest)}</span></span>
          <span>Fund <span className="text-foreground">{fmtFunding(market.fundingRate)}</span></span>
        </div>

        {/* Tab selector */}
        <div className="flex items-center gap-1 rounded-xl bg-accent/30 p-0.5 shrink-0">
          {mobileTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMobileTab(tab.id)}
              className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${
                mobileTab === tab.id ? "bg-card shadow-sm" : "text-muted-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="min-h-[360px]">
          {mobileTab === "chart" && (
            <div className="h-[360px] rounded-xl bg-card overflow-hidden">
              <FuturesChart
                symbol={selected}
                markPrice={market.markPrice}
                change24h={market.change24h}
              />
            </div>
          )}
          {mobileTab === "book" && (
            <FuturesOrderBook asks={orderBookAsks} bids={orderBookBids} markPrice={market.markPrice} />
          )}
          {mobileTab === "markets" && (
            <MarketList markets={liveMarkets} selected={selected} onSelect={(s) => { setSelected(s); setMobileTab("chart") }} />
          )}
        </div>

        <FuturesOrderForm market={market} />
        <PositionsPanel />
      </div>

      {/* Onboarding */}
      <OnboardingFlow
        steps={ONBOARDING_STEPS}
        storageKey="futures"
        completed={isOnboardingDone}
        onComplete={() => markOnboardingComplete("futures")}
      />
    </div>
  )
}

"use client"

import * as React from "react"
import {
  createChart,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type Time,
} from "lightweight-charts"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowUp01Icon,
  ArrowDown01Icon,
  Search01Icon,
  Activity01Icon,
  StarIcon,
  Exchange01Icon,
  Loading03Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons"
import { getForexKlines } from "@/lib/actions"
import type { ForexPair, Kline } from "@/lib/actions"
import { ErrorState } from "@/components/error-state"
import { TradingHeader } from "@/components/trading-header"
import { cn } from "@/lib/utils"
import { usePanelLayout } from "@/hooks/usePanelLayout"

// ── Helpers ──────────────────────────────────────────────────────────────

function fmtRate(n: number, quote: string): string {
  if (quote === "JPY") return n.toFixed(3)
  return n.toFixed(5)
}

const FOREX_INTERVALS = [
  { label: "1D", days: 30 },
  { label: "1W", days: 90 },
  { label: "1M", days: 180 },
  { label: "3M", days: 365 },
  { label: "1Y", days: 730 },
] as const

// ── Currency flag emojis ──────────────────────────────────────────────────

const CURRENCY_FLAGS: Record<string, string> = {
  USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", JPY: "🇯🇵", AUD: "🇦🇺",
  CAD: "🇨🇦", CHF: "🇨🇭", NZD: "🇳🇿", CNY: "🇨🇳", HKD: "🇭🇰",
  SGD: "🇸🇬", SEK: "🇸🇪", NOK: "🇳🇴", DKK: "🇩🇰", ZAR: "🇿🇦",
  TRY: "🇹🇷", MXN: "🇲🇽", BRL: "🇧🇷", INR: "🇮🇳", PLN: "🇵🇱",
}

function PairFlags({ base, quote, size = "sm" }: { base: string; quote: string; size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? "h-7 w-7 text-base" : size === "md" ? "h-5 w-5 text-sm" : "h-4 w-4 text-[10px]"
  const offset = size === "lg" ? "-ml-2.5" : size === "md" ? "-ml-2" : "-ml-1.5"
  return (
    <div className="flex items-center">
      <span className={cn("flex items-center justify-center rounded-full bg-accent ring-2 ring-card", dim)}>
        {CURRENCY_FLAGS[base] ?? base.slice(0, 2)}
      </span>
      <span className={cn("flex items-center justify-center rounded-full bg-accent ring-2 ring-card", dim, offset)}>
        {CURRENCY_FLAGS[quote] ?? quote.slice(0, 2)}
      </span>
    </div>
  )
}

// ── Forex Chart ──────────────────────────────────────────────────────────

function ForexChart({
  pair,
  isDark,
}: {
  pair: ForexPair
  isDark: boolean
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const chartRef = React.useRef<IChartApi | null>(null)
  const seriesRef = React.useRef<ISeriesApi<"Candlestick"> | null>(null)
  const [activeInterval, setActiveInterval] = React.useState<(typeof FOREX_INTERVALS)[number]["label"]>("1W")
  const [isLoading, setIsLoading] = React.useState(true)

  // Theme colors
  const bg = isDark ? "rgba(0,0,0,0)" : "rgba(0,0,0,0)"
  const text = isDark ? "#888888" : "#6b7280"
  const grid = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)"
  const up = "#10b981"
  const down = "#ef4444"

  // Init chart
  React.useEffect(() => {
    if (!containerRef.current) return
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: { background: { type: ColorType.Solid, color: bg }, textColor: text, fontSize: 11 },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderVisible: false, textColor: text },
      timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true },
      handleScroll: true,
      handleScale: true,
    })
    const series = chart.addSeries(CandlestickSeries, {
      upColor: up,
      downColor: down,
      borderUpColor: up,
      borderDownColor: down,
      wickUpColor: up,
      wickDownColor: down,
    })
    chartRef.current = chart
    seriesRef.current = series

    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect
      if (width > 0 && height > 0) chart.resize(width, height)
    })
    ro.observe(containerRef.current)

    return () => { ro.disconnect(); chart.remove() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update theme on change
  React.useEffect(() => {
    chartRef.current?.applyOptions({
      layout: { background: { type: ColorType.Solid, color: bg }, textColor: text },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
    })
  }, [isDark]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch data
  React.useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    const interval = FOREX_INTERVALS.find((i) => i.label === activeInterval)
    const days = interval?.days ?? 90
    getForexKlines(pair.base, pair.quote, days).then((res) => {
      if (cancelled || !seriesRef.current) return
      if (res.success && res.data.length > 0) {
        const candles: CandlestickData[] = res.data.map((k: Kline) => ({
          time: k.time as Time,
          open: k.open,
          high: k.high,
          low: k.low,
          close: k.close,
        }))
        seriesRef.current.setData(candles)
        chartRef.current?.timeScale().fitContent()
      }
      setIsLoading(false)
    })
    return () => { cancelled = true }
  }, [pair.base, pair.quote, activeInterval])

  return (
    <div className="flex flex-col h-full">
      {/* Interval buttons */}
      <div className="flex items-center gap-1 border-b border-border/50 px-3 py-2">
        {FOREX_INTERVALS.map((iv) => (
          <button
            key={iv.label}
            onClick={() => setActiveInterval(iv.label)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              activeInterval === iv.label
                ? "bg-primary text-white"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {iv.label}
          </button>
        ))}
      </div>
      {/* Chart */}
      <div className="relative flex-1 min-h-0">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/50 backdrop-blur-sm">
            <HugeiconsIcon icon={Loading03Icon} className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  )
}

// ── Pair Select ───────────────────────────────────────────────────────────

function PairSelect({
  pairs,
  selected,
  onSelect,
}: {
  pairs: ForexPair[]
  selected: string
  onSelect: (p: ForexPair) => void
}) {
  const [search, setSearch] = React.useState("")
  const [favorites, setFavorites] = React.useState<Set<string>>(new Set(["EUR/USD", "GBP/USD"]))

  const filtered = React.useMemo(() => {
    if (!search) return pairs
    const q = search.toLowerCase()
    return pairs.filter(
      (p) =>
        p.symbol.toLowerCase().includes(q) ||
        p.base.toLowerCase().includes(q) ||
        p.quote.toLowerCase().includes(q),
    )
  }, [pairs, search])

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border/50 bg-card">
      <div className="flex flex-col gap-2 border-b border-border/50 p-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Forex Pairs</span>
        <div className="relative">
          <HugeiconsIcon
            icon={Search01Icon}
            className="absolute left-2 top-[7px] h-3.5 w-3.5 text-muted-foreground"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pairs..."
            className="w-full rounded-lg bg-accent/50 py-1.5 pl-7 pr-2 text-xs outline-none focus:bg-accent"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.map((pair) => {
          const isActive = pair.symbol === selected
          const isUp = pair.change24h >= 0
          const isFav = favorites.has(pair.symbol)
          return (
            <button
              key={pair.symbol}
              onClick={() => onSelect(pair)}
              className={cn(
                "group flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors",
                isActive ? "bg-accent/60" : "hover:bg-accent/30",
              )}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setFavorites((prev) => {
                    const n = new Set(prev)
                    if (n.has(pair.symbol)) n.delete(pair.symbol)
                    else n.add(pair.symbol)
                    return n
                  })
                }}
                className={cn(
                  "shrink-0 transition-colors",
                  isFav ? "text-amber-400" : "text-muted-foreground/20 group-hover:text-muted-foreground/40",
                )}
              >
                <HugeiconsIcon icon={StarIcon} className="h-3 w-3" />
              </button>
              <PairFlags base={pair.base} quote={pair.quote} size="md" />
              <div className="flex flex-1 min-w-0 flex-col gap-0.5">
                <span className={cn("text-sm font-bold", isActive && "text-primary")}>
                  {pair.symbol}
                </span>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {fmtRate(pair.rate, pair.quote)}
                </span>
              </div>
              <span
                className={cn(
                  "text-[10px] font-semibold shrink-0",
                  isUp ? "text-emerald-500" : "text-red-500",
                )}
              >
                {isUp ? "+" : ""}
                {pair.change24h.toFixed(2)}%
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Top Bar (pair info fragment — rendered inside TradingHeader) ──────

function ForexPairInfo({ pair }: { pair: ForexPair }) {
  const isUp = pair.change24h >= 0
  return (
    <>
      <div className="flex items-center gap-2 shrink-0">
        <PairFlags base={pair.base} quote={pair.quote} size="lg" />
        <span className="text-base font-bold">{pair.symbol}</span>
      </div>
      <span className="text-sm font-bold tabular-nums">
        {fmtRate(pair.rate, pair.quote)}
      </span>
      <span
        className={cn(
          "text-xs font-medium tabular-nums",
          isUp ? "text-emerald-500" : "text-red-500",
        )}
      >
        {isUp ? "+" : ""}
        {pair.change24h.toFixed(3)}%
      </span>
      <div className="hidden md:flex items-center gap-4 text-[11px] text-muted-foreground ml-2">
        <div className="flex flex-col">
          <span>High</span>
          <span className="font-medium text-foreground tabular-nums">{fmtRate(pair.high, pair.quote)}</span>
        </div>
        <div className="flex flex-col">
          <span>Low</span>
          <span className="font-medium text-foreground tabular-nums">{fmtRate(pair.low, pair.quote)}</span>
        </div>
        <div className="hidden lg:flex flex-col">
          <span>Spread</span>
          <span className="font-medium text-foreground tabular-nums">{pair.spread.toFixed(1)} pips</span>
        </div>
      </div>
    </>
  )
}

// ── Price Depth (Bid/Ask) ─────────────────────────────────────────────────

function PriceDepth({ pair }: { pair: ForexPair }) {
  const spreadUnit = pair.quote === "JPY" ? 0.001 : 0.00001
  const pipValue = spreadUnit
  const levels = 20
  const [tick, setTick] = React.useState(0)

  // Re-render every 800ms for animated depth updates
  React.useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 800)
    return () => clearInterval(id)
  }, [])

  // Seeded random for deterministic but visually changing values
  const rng = React.useCallback((seed: number) => {
    const x = Math.sin(seed * 12345.6789) * 43758.5453
    return x - Math.floor(x)
  }, [])

  const asks = React.useMemo(
    () =>
      Array.from({ length: levels }, (_, i) => {
        const jitter = (rng(tick * 100 + i + 1) - 0.5) * pipValue * 0.3
        return {
          price: pair.rate + (i + 1) * pipValue * pair.spread * 0.6 + jitter,
          size: +(20 + rng(tick * 200 + i) * 120 + i * 5).toFixed(1),
          cumSize: 0,
        }
      }).reverse(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pair.rate, tick],
  )

  const bids = React.useMemo(
    () =>
      Array.from({ length: levels }, (_, i) => {
        const jitter = (rng(tick * 300 + i + 50) - 0.5) * pipValue * 0.3
        return {
          price: pair.rate - (i + 1) * pipValue * pair.spread * 0.6 + jitter,
          size: +(20 + rng(tick * 400 + i + 50) * 120 + i * 5).toFixed(1),
          cumSize: 0,
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pair.rate, tick],
  )

  // Compute cumulative sizes
  let cumAsk = 0
  for (let i = asks.length - 1; i >= 0; i--) { cumAsk += asks[i].size; asks[i].cumSize = cumAsk }
  let cumBid = 0
  for (let i = 0; i < bids.length; i++) { cumBid += bids[i].size; bids[i].cumSize = cumBid }

  const maxCum = Math.max(cumAsk, cumBid)

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border/50 bg-card">
      <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2.5">
        <HugeiconsIcon icon={Activity01Icon} className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold">Order Book</span>
        <span className="ml-auto text-[9px] text-muted-foreground/50 tabular-nums">{levels} levels</span>
      </div>
      {/* Column headers */}
      <div className="grid grid-cols-[1fr_auto_auto] border-b border-border/30 px-3 py-1 text-[10px] text-muted-foreground">
        <span>Price</span>
        <span className="text-right w-14">Size</span>
        <span className="text-right w-14">Total</span>
      </div>
      {/* Asks (sell side) */}
      <div className="flex flex-col-reverse overflow-y-auto flex-1">
        {asks.map((a, i) => (
          <div key={i} className="group relative grid grid-cols-[1fr_auto_auto] items-center px-3 py-[1.5px]">
            <div
              className="absolute right-0 top-0 h-full bg-red-500/8 transition-[width] duration-300"
              style={{ width: `${(a.cumSize / maxCum) * 70}%` }}
            />
            <span className="relative z-10 text-[11px] font-mono text-red-500 tabular-nums">
              {fmtRate(a.price, pair.quote)}
            </span>
            <span className="relative z-10 text-right text-[11px] text-muted-foreground tabular-nums w-14">
              {a.size}
            </span>
            <span className="relative z-10 text-right text-[10px] text-muted-foreground/60 tabular-nums w-14">
              {a.cumSize.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
      {/* Spread indicator */}
      <div className="flex items-center justify-between border-y border-border/30 px-3 py-1.5">
        <span className="text-[11px] font-bold tabular-nums text-foreground">
          {fmtRate(pair.rate, pair.quote)}
        </span>
        <span className="text-[10px] font-medium text-muted-foreground">
          Spread {pair.spread.toFixed(1)}
        </span>
      </div>
      {/* Bids (buy side) */}
      <div className="flex flex-col overflow-y-auto flex-1">
        {bids.map((b, i) => (
          <div key={i} className="group relative grid grid-cols-[1fr_auto_auto] items-center px-3 py-[1.5px]">
            <div
              className="absolute right-0 top-0 h-full bg-emerald-500/8 transition-[width] duration-300"
              style={{ width: `${(b.cumSize / maxCum) * 70}%` }}
            />
            <span className="relative z-10 text-[11px] font-mono text-emerald-500 tabular-nums">
              {fmtRate(b.price, pair.quote)}
            </span>
            <span className="relative z-10 text-right text-[11px] text-muted-foreground tabular-nums w-14">
              {b.size}
            </span>
            <span className="relative z-10 text-right text-[10px] text-muted-foreground/60 tabular-nums w-14">
              {b.cumSize.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Order Panel ───────────────────────────────────────────────────────────

const LOT_SIZES = ["0.01", "0.05", "0.1", "0.5", "1.0", "5.0"] as const
const LEVERAGES = [1, 10, 25, 50, 100, 200] as const

function ForexOrderPanel({ pair, defaultSide = "buy" }: { pair: ForexPair; defaultSide?: "buy" | "sell" }) {
  const [side] = React.useState<"buy" | "sell">(defaultSide)
  const [lots, setLots] = React.useState("0.1")
  const [leverage, setLeverage] = React.useState(50)
  const [sl, setSl] = React.useState("")
  const [tp, setTp] = React.useState("")

  const lotsNum = parseFloat(lots) || 0
  const contractSize = 100_000
  const notional = lotsNum * contractSize * pair.rate
  const margin = notional / leverage
  const isBuy = side === "buy"
  const execPrice = isBuy
    ? pair.rate + (pair.spread * 0.00001)
    : pair.rate - (pair.spread * 0.00001)

  return (
    <div className="rounded-xl border border-border/50 bg-card p-3">
      {/* Side header */}
      <div className={cn(
        "mb-3 rounded-lg py-1.5 text-center text-xs font-bold text-white",
        isBuy ? "bg-emerald-500" : "bg-red-500",
      )}>
        {isBuy ? "Buy" : "Sell"} {pair.symbol}
      </div>

      {/* Lot size */}
      <div className="mb-3">
        <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Lot Size
        </label>
        <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-accent/20 px-3 py-2">
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={lots}
            onChange={(e) => setLots(e.target.value)}
            className="flex-1 bg-transparent text-sm font-medium outline-none [appearance:textfield]"
          />
          <span className="text-xs text-muted-foreground">lots</span>
        </div>
        <div className="mt-1.5 flex gap-1 flex-wrap">
          {LOT_SIZES.map((s) => (
            <button
              key={s}
              onClick={() => setLots(s)}
              className={cn(
                "rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors",
                lots === s
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Leverage */}
      <div className="mb-3">
        <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Leverage
        </label>
        <div className="flex gap-1 flex-wrap">
          {LEVERAGES.map((lv) => (
            <button
              key={lv}
              onClick={() => setLeverage(lv)}
              className={cn(
                "rounded-md px-2 py-1 text-[10px] font-medium transition-colors",
                leverage === lv
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {lv}×
            </button>
          ))}
        </div>
      </div>

      {/* SL / TP */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Stop Loss
          </label>
          <input
            type="number"
            placeholder={fmtRate(isBuy ? pair.rate * 0.998 : pair.rate * 1.002, pair.quote)}
            value={sl}
            onChange={(e) => setSl(e.target.value)}
            className="w-full rounded-lg border border-border/50 bg-accent/20 px-2.5 py-1.5 text-xs outline-none focus:border-red-500/50 focus:bg-accent/40"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Take Profit
          </label>
          <input
            type="number"
            placeholder={fmtRate(isBuy ? pair.rate * 1.003 : pair.rate * 0.997, pair.quote)}
            value={tp}
            onChange={(e) => setTp(e.target.value)}
            className="w-full rounded-lg border border-border/50 bg-accent/20 px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500/50 focus:bg-accent/40"
          />
        </div>
      </div>

      {/* Summary */}
      <div className="mb-3 space-y-1 rounded-lg bg-accent/20 px-3 py-2.5 text-xs">
        <div className="flex justify-between text-muted-foreground">
          <span>Execution Price</span>
          <span className="font-mono font-medium text-foreground">{fmtRate(execPrice, pair.quote)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Notional</span>
          <span className="font-mono font-medium text-foreground">
            ${notional.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Required Margin</span>
          <span className="font-mono font-medium text-foreground">
            ${margin.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Place Order */}
      <button
        className={cn(
          "w-full rounded-xl py-2.5 text-sm font-bold text-white transition-colors",
          isBuy
            ? "bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700"
            : "bg-red-500 hover:bg-red-600 active:bg-red-700",
        )}
      >
        {isBuy ? "Buy" : "Sell"} {pair.symbol}
      </button>
    </div>
  )
}

// ── Open Positions Placeholder ────────────────────────────────────────────

function OpenPositions({ pair }: { pair: ForexPair }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card">
      <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3">
        <HugeiconsIcon icon={Exchange01Icon} className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold">Open Positions</span>
      </div>
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <HugeiconsIcon icon={Activity01Icon} className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground">No open positions</p>
        <p className="text-[10px] text-muted-foreground/60">
          Place a trade on {pair.symbol} to see it here
        </p>
      </div>
    </div>
  )
}

// ── Mobile Tabs ───────────────────────────────────────────────────────────

type MobileTab = "chart" | "pairs" | "depth" | "order"

// ── Main ForexClient ─────────────────────────────────────────────────────

interface ForexClientProps {
  initialPairs: ForexPair[]
  error?: string
}

export function ForexClient({ initialPairs, error }: ForexClientProps) {
  const [pairs] = React.useState(initialPairs)
  const [selectedPair, setSelectedPair] = React.useState<ForexPair>(
    initialPairs[0] ?? { base: "EUR", quote: "USD", symbol: "EUR/USD", rate: 1.08, prevRate: 1.079, change24h: 0.07, high: 1.082, low: 1.077, spread: 0.8 },
  )
  const [isDark, setIsDark] = React.useState(true)
  const [mobileTab, setMobileTab] = React.useState<MobileTab>("chart")
  const { collapsed, toggle } = usePanelLayout()

  // Sync dark mode with document class
  React.useEffect(() => {
    const update = () => setIsDark(document.documentElement.classList.contains("dark"))
    update()
    const obs = new MutationObserver(update)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => obs.disconnect()
  }, [])

  if (error && pairs.length === 0) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">Forex</h1>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card">
          <ErrorState message={error} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* ── TOP BAR ── */}
      <TradingHeader>
        <ForexPairInfo pair={selectedPair} />
      </TradingHeader>

      {/* ═══ DESKTOP: 3-column main + standalone bottom ═══ */}
      <div className="hidden lg:flex flex-1 flex-col overflow-hidden p-1 gap-1">
        {/* MAIN ROW */}
        <div className="flex-1 min-h-0 flex gap-1 overflow-hidden">
          {/* LEFT — Pair List */}
          {collapsed.left ? (
            <button
              onClick={() => toggle("left")}
              className="shrink-0 w-6 flex flex-col items-center justify-center rounded-xl bg-card border border-border/20 hover:bg-accent/50 transition-colors group"
              title="Expand pairs"
            >
              <HugeiconsIcon icon={ArrowRight01Icon} className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
              <span className="text-[9px] text-muted-foreground [writing-mode:vertical-lr] mt-1">Pairs</span>
            </button>
          ) : (
            <div className="shrink-0 w-[260px] xl:w-[300px] overflow-hidden relative">
              <button
                onClick={() => toggle("left")}
                className="absolute top-1 right-1 z-10 rounded-md p-0.5 bg-card/80 border border-border/20 hover:bg-accent transition-colors"
                title="Collapse pairs"
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} className="h-3 w-3 text-muted-foreground" />
              </button>
              <PairSelect pairs={pairs} selected={selectedPair.symbol} onSelect={setSelectedPair} />
            </div>
          )}

          {/* CENTER — Chart + Buy/Sell stacked */}
          <div className="flex-1 min-w-0 flex flex-col gap-1 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-hidden rounded-xl border border-border/50 bg-card">
              <ForexChart pair={selectedPair} isDark={isDark} />
            </div>
            <div className="shrink-0 overflow-hidden">
              <div className="grid grid-cols-2 gap-1">
                <ForexOrderPanel pair={selectedPair} defaultSide="buy" />
                <ForexOrderPanel pair={selectedPair} defaultSide="sell" />
              </div>
            </div>
          </div>

          {/* RIGHT — Bid/Ask Depth */}
          {collapsed.right ? (
            <button
              onClick={() => toggle("right")}
              className="shrink-0 w-6 flex flex-col items-center justify-center rounded-xl bg-card border border-border/20 hover:bg-accent/50 transition-colors group"
              title="Expand depth"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
              <span className="text-[9px] text-muted-foreground [writing-mode:vertical-lr] mt-1">Depth</span>
            </button>
          ) : (
            <div className="shrink-0 w-[260px] xl:w-[300px] flex flex-col overflow-hidden relative">
              <button
                onClick={() => toggle("right")}
                className="absolute top-1 right-1 z-10 rounded-md p-0.5 bg-card/80 border border-border/20 hover:bg-accent transition-colors"
                title="Collapse depth"
              >
                <HugeiconsIcon icon={ArrowRight01Icon} className="h-3 w-3 text-muted-foreground" />
              </button>
              <div className="flex-1 min-h-0">
                <PriceDepth pair={selectedPair} />
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM ROW — Open Positions */}
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
            <OpenPositions pair={selectedPair} />
          </div>
        )}
      </div>

      {/* ═══ MOBILE layout ═══ */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto slim-scroll px-2 pt-2 pb-4 lg:hidden">
        <div className="flex items-center gap-1 rounded-xl bg-accent/30 p-0.5 shrink-0">
          {(["chart", "pairs", "depth"] as MobileTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setMobileTab(t)}
              className={cn(
                "flex-1 rounded-lg py-2 text-xs font-medium transition-colors",
                mobileTab === t ? "bg-card shadow-sm" : "text-muted-foreground",
              )}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="min-h-[360px]">
          {mobileTab === "chart" && (
            <div className="h-full overflow-hidden rounded-xl border border-border/50 bg-card">
              <ForexChart pair={selectedPair} isDark={isDark} />
            </div>
          )}
          {mobileTab === "pairs" && (
            <PairSelect pairs={pairs} selected={selectedPair.symbol} onSelect={(p) => { setSelectedPair(p); setMobileTab("chart") }} />
          )}
          {mobileTab === "depth" && (
            <PriceDepth pair={selectedPair} />
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 shrink-0">
          <ForexOrderPanel pair={selectedPair} defaultSide="buy" />
          <ForexOrderPanel pair={selectedPair} defaultSide="sell" />
        </div>

        <OpenPositions pair={selectedPair} />
      </div>
    </div>
  )
}

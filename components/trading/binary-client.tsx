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
  Clock01Icon,
  Loading03Icon,
  CheckmarkCircle01Icon,
  Cancel01Icon,
  Target02Icon,
  AlertDiamondIcon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons"
import { TradingHeader } from "@/components/trading-header"
import { cn } from "@/lib/utils"
import { usePanelLayout } from "@/hooks/usePanelLayout"

// ── Pair Image Maps ────────────────────────────────────────────────────────

const CRYPTO_IMAGES: Record<string, string> = {
  BTC: "https://coin-images.coingecko.com/coins/images/1/small/bitcoin.png",
  ETH: "https://coin-images.coingecko.com/coins/images/279/small/ethereum.png",
  SOL: "https://coin-images.coingecko.com/coins/images/4128/small/solana.png",
  BNB: "https://coin-images.coingecko.com/coins/images/825/small/bnb-icon2_2x.png",
  XRP: "https://coin-images.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png",
  ADA: "https://coin-images.coingecko.com/coins/images/975/small/cardano.png",
  DOGE: "https://coin-images.coingecko.com/coins/images/5/small/dogecoin.png",
  AVAX: "https://coin-images.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png",
  USD: "https://coin-images.coingecko.com/coins/images/325/small/Tether.png",
}

const CURRENCY_FLAGS: Record<string, string> = {
  USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", JPY: "🇯🇵", AUD: "🇦🇺", CAD: "🇨🇦",
  CHF: "🇨🇭", NZD: "🇳🇿", CNY: "🇨🇳", HKD: "🇭🇰",
}

const COMMODITY_IMAGES: Record<string, string> = {
  XAU: "https://coin-images.coingecko.com/coins/images/25741/small/gold.png",
  XAG: "https://coin-images.coingecko.com/coins/images/28165/small/silver.png",
  WTI: "",
}

function PairImages({ symbol, category, size = "md" }: { symbol: string; category: string; size?: "sm" | "md" | "lg" }) {
  const [base, quote] = symbol.split("/")
  const dim = size === "sm" ? "h-5 w-5" : size === "lg" ? "h-8 w-8" : "h-6 w-6"
  const offset = size === "sm" ? "-ml-1.5" : size === "lg" ? "-ml-3" : "-ml-2"
  const flagDim = size === "sm" ? "text-sm" : size === "lg" ? "text-2xl" : "text-lg"

  if (category === "crypto") {
    const baseImg = CRYPTO_IMAGES[base]
    const quoteImg = CRYPTO_IMAGES[quote]
    return (
      <div className="flex items-center">
        {baseImg ? (
          <img src={baseImg} alt={base} className={cn(dim, "rounded-full ring-2 ring-card relative z-[2]")} />
        ) : (
          <div className={cn(dim, "rounded-full bg-primary/20 ring-2 ring-card flex items-center justify-center text-[8px] font-bold text-primary relative z-[2]")}>{base}</div>
        )}
        {quoteImg ? (
          <img src={quoteImg} alt={quote} className={cn(dim, "rounded-full ring-2 ring-card relative z-[1]", offset)} />
        ) : (
          <div className={cn(dim, "rounded-full bg-accent ring-2 ring-card flex items-center justify-center text-[8px] font-bold relative z-[1]", offset)}>{quote}</div>
        )}
      </div>
    )
  }

  if (category === "forex") {
    return (
      <div className="flex items-center">
        <span className={cn(flagDim, "relative z-[2]")}>{CURRENCY_FLAGS[base] ?? "🏳️"}</span>
        <span className={cn(flagDim, "relative z-[1]", size === "sm" ? "-ml-1" : "-ml-1.5")}>{CURRENCY_FLAGS[quote] ?? "🏳️"}</span>
      </div>
    )
  }

  // Commodities
  const baseImg = COMMODITY_IMAGES[base]
  return (
    <div className="flex items-center">
      {baseImg ? (
        <img src={baseImg} alt={base} className={cn(dim, "rounded-full ring-2 ring-card relative z-[2]")} />
      ) : (
        <div className={cn(dim, "rounded-full bg-amber-500/20 ring-2 ring-card flex items-center justify-center text-[8px] font-bold text-amber-600 relative z-[2]")}>{base}</div>
      )}
      <div className={cn(dim, "rounded-full bg-accent ring-2 ring-card flex items-center justify-center text-[8px] font-bold relative z-[1]", offset)}>{quote}</div>
    </div>
  )
}

// ── Types ──────────────────────────────────────────────────────────────────

interface BinaryAsset {
  symbol: string
  name: string
  price: number
  change24h: number
  high: number
  low: number
  payout: number
  category: "crypto" | "forex" | "commodities"
}

type ExpiryOption = "30s" | "1m" | "5m" | "15m" | "1h" | "4h"
type Direction = "up" | "down"
type MobileTab = "chart" | "assets" | "history"

interface BinaryTrade {
  id: string
  symbol: string
  direction: Direction
  amount: number
  payout: number
  entryPrice: number
  expiresAt: number
  status: "active" | "won" | "lost"
}

// ── Mock Data ──────────────────────────────────────────────────────────────

const BINARY_ASSETS: BinaryAsset[] = [
  // Crypto
  { symbol: "BTC/USD", name: "Bitcoin", price: 67234.50, change24h: 2.34, high: 68102.0, low: 65890.0, payout: 85, category: "crypto" },
  { symbol: "ETH/USD", name: "Ethereum", price: 3456.78, change24h: 1.56, high: 3520.0, low: 3380.0, payout: 82, category: "crypto" },
  { symbol: "SOL/USD", name: "Solana", price: 178.45, change24h: -0.89, high: 185.0, low: 174.20, payout: 80, category: "crypto" },
  { symbol: "BNB/USD", name: "BNB", price: 612.30, change24h: 0.45, high: 620.0, low: 605.0, payout: 78, category: "crypto" },
  { symbol: "XRP/USD", name: "Ripple", price: 0.6234, change24h: -1.23, high: 0.64, low: 0.61, payout: 76, category: "crypto" },
  { symbol: "ADA/USD", name: "Cardano", price: 0.4567, change24h: 3.12, high: 0.47, low: 0.44, payout: 78, category: "crypto" },
  { symbol: "DOGE/USD", name: "Dogecoin", price: 0.1234, change24h: -2.45, high: 0.128, low: 0.12, payout: 75, category: "crypto" },
  { symbol: "AVAX/USD", name: "Avalanche", price: 38.90, change24h: 1.89, high: 39.80, low: 37.50, payout: 79, category: "crypto" },
  // Forex
  { symbol: "EUR/USD", name: "Euro Dollar", price: 1.08234, change24h: 0.12, high: 1.084, low: 1.080, payout: 88, category: "forex" },
  { symbol: "GBP/USD", name: "Pound Dollar", price: 1.26780, change24h: -0.08, high: 1.270, low: 1.265, payout: 87, category: "forex" },
  { symbol: "USD/JPY", name: "Dollar Yen", price: 151.234, change24h: 0.23, high: 151.80, low: 150.60, payout: 86, category: "forex" },
  { symbol: "AUD/USD", name: "Aussie Dollar", price: 0.65430, change24h: -0.34, high: 0.658, low: 0.652, payout: 84, category: "forex" },
  { symbol: "USD/CAD", name: "Dollar Loonie", price: 1.36120, change24h: 0.15, high: 1.365, low: 1.358, payout: 85, category: "forex" },
  // Commodities
  { symbol: "XAU/USD", name: "Gold", price: 2345.60, change24h: 0.67, high: 2360.0, low: 2330.0, payout: 82, category: "commodities" },
  { symbol: "XAG/USD", name: "Silver", price: 28.45, change24h: -0.45, high: 28.90, low: 28.10, payout: 80, category: "commodities" },
  { symbol: "WTI/USD", name: "Crude Oil", price: 78.90, change24h: 1.23, high: 80.10, low: 77.50, payout: 78, category: "commodities" },
]

const EXPIRY_OPTIONS: { label: ExpiryOption; seconds: number }[] = [
  { label: "30s", seconds: 30 },
  { label: "1m", seconds: 60 },
  { label: "5m", seconds: 300 },
  { label: "15m", seconds: 900 },
  { label: "1h", seconds: 3600 },
  { label: "4h", seconds: 14400 },
]

const STAKE_PRESETS = [5, 10, 25, 50, 100, 250]

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtPrice(p: number) {
  if (p >= 1000) return p.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (p >= 1) return p.toFixed(4)
  return p.toPrecision(4)
}

function generateCandles(asset: BinaryAsset, count = 200): CandlestickData[] {
  const now = Math.floor(Date.now() / 1000)
  const interval = 300 // 5 min candles
  const seed = asset.symbol.split("").reduce((a, c, i) => a + c.charCodeAt(0) * (i + 1) * 37, 0)
  const rng = (i: number) => {
    const x = Math.sin(seed + i * 9301 + 49297) * 233280
    return (x - Math.floor(x))
  }

  const candles: CandlestickData[] = []
  let close = asset.price * (1 - asset.change24h / 200)

  for (let i = 0; i < count; i++) {
    const time = (now - (count - i) * interval) as Time
    const r = rng(i)
    const volatility = asset.price * 0.002
    const drift = (asset.change24h / 100 / count) * asset.price
    const open = close
    close = open + drift + (r - 0.5) * volatility * 2
    const high = Math.max(open, close) + r * volatility * 0.5
    const low = Math.min(open, close) - (1 - r) * volatility * 0.5
    candles.push({ time, open, high, low, close })
  }
  return candles
}

function formatCountdown(seconds: number) {
  if (seconds <= 0) return "00:00"
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

// ── Binary Chart ───────────────────────────────────────────────────────────

function BinaryChart({
  asset,
  isDark,
}: {
  asset: BinaryAsset
  isDark: boolean
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const chartRef = React.useRef<IChartApi | null>(null)
  const seriesRef = React.useRef<ISeriesApi<"Candlestick"> | null>(null)

  const bg = "rgba(0,0,0,0)"
  const text = isDark ? "#888888" : "#6b7280"
  const grid = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)"
  const up = "#10b981"
  const down = "#ef4444"

  React.useEffect(() => {
    if (!containerRef.current) return
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: { background: { type: ColorType.Solid, color: bg }, textColor: text, fontSize: 11 },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderVisible: false, textColor: text },
      timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true, timeVisible: true, secondsVisible: true },
      handleScroll: true,
      handleScale: true,
    })
    const series = chart.addSeries(CandlestickSeries, {
      upColor: up, downColor: down,
      borderUpColor: up, borderDownColor: down,
      wickUpColor: up, wickDownColor: down,
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

  React.useEffect(() => {
    chartRef.current?.applyOptions({
      layout: { background: { type: ColorType.Solid, color: bg }, textColor: text },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
    })
  }, [isDark]) // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (!seriesRef.current) return
    const candles = generateCandles(asset)
    seriesRef.current.setData(candles)
    chartRef.current?.timeScale().fitContent()
  }, [asset.symbol]) // eslint-disable-line react-hooks/exhaustive-deps

  // Simulate live price updates
  React.useEffect(() => {
    const id = setInterval(() => {
      if (!seriesRef.current) return
      const now = Math.floor(Date.now() / 1000) as Time
      const r = Math.random()
      const vol = asset.price * 0.0005
      const open = asset.price
      const close = open + (r - 0.5) * vol * 2
      const high = Math.max(open, close) + r * vol * 0.3
      const low = Math.min(open, close) - (1 - r) * vol * 0.3
      seriesRef.current.update({ time: now, open, high, low, close })
    }, 2000)
    return () => clearInterval(id)
  }, [asset.symbol, asset.price])

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  )
}

// ── Asset List ─────────────────────────────────────────────────────────────

function AssetList({
  assets,
  selected,
  onSelect,
}: {
  assets: BinaryAsset[]
  selected: string
  onSelect: (a: BinaryAsset) => void
}) {
  const [search, setSearch] = React.useState("")
  const [category, setCategory] = React.useState<"all" | "crypto" | "forex" | "commodities">("all")

  const filtered = React.useMemo(() => {
    let list = assets
    if (category !== "all") list = list.filter((a) => a.category === category)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((a) => a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q))
    }
    return list
  }, [assets, search, category])

  const categories = ["all", "crypto", "forex", "commodities"] as const

  return (
    <div className="flex h-full flex-col overflow-hidden bg-card">
      <div className="border-b border-border/20 px-2 py-2 space-y-2">
        <div className="relative">
          <HugeiconsIcon icon={Search01Icon} className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assets..."
            className="w-full rounded-lg bg-accent/40 py-1.5 pl-7 pr-2 text-[11px] outline-none focus:bg-accent"
          />
        </div>
        <div className="flex gap-0.5">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "flex-1 rounded-md py-1 text-[10px] font-medium capitalize transition-colors",
                category === c ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.map((a) => {
          const isUp = a.change24h >= 0
          return (
            <button
              key={a.symbol}
              onClick={() => onSelect(a)}
              className={cn(
                "flex w-full items-center gap-2.5 px-2.5 py-2.5 transition-colors",
                selected === a.symbol ? "bg-accent/50" : "hover:bg-accent/30",
              )}
            >
              <PairImages symbol={a.symbol} category={a.category} size="md" />
              <div className="flex flex-1 min-w-0 flex-col items-start">
                <span className="text-sm font-bold">{a.symbol}</span>
                <span className="text-[10px] text-muted-foreground">{a.name} · {a.payout}%</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-sm tabular-nums font-semibold">{fmtPrice(a.price)}</span>
                <span className={cn("text-[10px] tabular-nums font-semibold", isUp ? "text-emerald-500" : "text-red-500")}>
                  {isUp ? "+" : ""}{a.change24h.toFixed(2)}%
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Asset Info (TradingHeader children) ────────────────────────────────

function BinaryAssetInfo({ asset }: { asset: BinaryAsset }) {
  const isUp = asset.change24h >= 0
  return (
    <>
      <div className="hidden md:flex items-center gap-2.5">
        <PairImages symbol={asset.symbol} category={asset.category} size="lg" />
        <div className="flex flex-col">
          <span className="text-base font-bold leading-tight">{asset.symbol}</span>
          <span className="text-[10px] text-muted-foreground">{asset.name}</span>
        </div>
        <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400">
          {asset.payout}% PAYOUT
        </span>
      </div>
      <div className="hidden md:flex items-baseline gap-1.5">
        <span className="text-base font-bold tabular-nums">{fmtPrice(asset.price)}</span>
        <span className={cn("flex items-center gap-0.5 text-xs font-semibold", isUp ? "text-emerald-500" : "text-red-500")}>
          <HugeiconsIcon icon={isUp ? ArrowUp01Icon : ArrowDown01Icon} className="h-3 w-3" />
          {isUp ? "+" : ""}{asset.change24h.toFixed(3)}%
        </span>
      </div>
      <div className="hidden lg:flex items-center gap-6">
        {[
          { label: "High", value: fmtPrice(asset.high) },
          { label: "Low", value: fmtPrice(asset.low) },
          { label: "Category", value: asset.category.charAt(0).toUpperCase() + asset.category.slice(1) },
        ].map((s) => (
          <div key={s.label} className="flex flex-col">
            <span className="text-[10px] text-muted-foreground">{s.label}</span>
            <span className="text-xs font-medium tabular-nums">{s.value}</span>
          </div>
        ))}
      </div>
    </>
  )
}

// ── Order Panel ────────────────────────────────────────────────────────────

function BinaryOrderPanel({
  asset,
  onPlaceTrade,
}: {
  asset: BinaryAsset
  onPlaceTrade: (trade: BinaryTrade) => void
}) {
  const [direction, setDirection] = React.useState<Direction>("up")
  const [expiry, setExpiry] = React.useState<ExpiryOption>("1m")
  const [amount, setAmount] = React.useState("25")
  const [stopLoss, setStopLoss] = React.useState("")
  const [takeProfit, setTakeProfit] = React.useState("")
  const [isPlacing, setIsPlacing] = React.useState(false)

  const amountNum = parseFloat(amount) || 0
  const potentialProfit = amountNum * (asset.payout / 100)
  const expirySeconds = EXPIRY_OPTIONS.find((e) => e.label === expiry)?.seconds ?? 60

  function handleTrade() {
    if (amountNum <= 0) return
    setIsPlacing(true)
    setTimeout(() => {
      const trade: BinaryTrade = {
        id: `t-${Date.now()}`,
        symbol: asset.symbol,
        direction,
        amount: amountNum,
        payout: asset.payout,
        entryPrice: asset.price,
        expiresAt: Date.now() + expirySeconds * 1000,
        status: "active",
      }
      onPlaceTrade(trade)
      setIsPlacing(false)
    }, 400)
  }

  return (
    <div className="flex flex-col gap-3 border border-border/50 bg-card p-4">
      {/* Direction */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-accent/30 p-1">
        <button
          onClick={() => setDirection("up")}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold transition-colors",
            direction === "up" ? "bg-emerald-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <HugeiconsIcon icon={ArrowUp01Icon} className="h-4 w-4" />
          Up
        </button>
        <button
          onClick={() => setDirection("down")}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold transition-colors",
            direction === "down" ? "bg-red-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <HugeiconsIcon icon={ArrowDown01Icon} className="h-4 w-4" />
          Down
        </button>
      </div>

      {/* Expiry */}
      <div>
        <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Expiry Time
        </label>
        <div className="flex gap-1 flex-wrap">
          {EXPIRY_OPTIONS.map((e) => (
            <button
              key={e.label}
              onClick={() => setExpiry(e.label)}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                expiry === e.label ? "bg-primary text-white" : "bg-accent/40 text-muted-foreground hover:text-foreground",
              )}
            >
              {e.label}
            </button>
          ))}
        </div>
      </div>

      {/* Amount */}
      <div>
        <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Stake Amount
        </label>
        <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-accent/20 px-3 py-2">
          <span className="text-sm font-medium text-muted-foreground">$</span>
          <input
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 bg-transparent text-sm font-medium outline-none [appearance:textfield]"
          />
        </div>
        <div className="mt-1.5 flex gap-1 flex-wrap">
          {STAKE_PRESETS.map((s) => (
            <button
              key={s}
              onClick={() => setAmount(String(s))}
              className={cn(
                "rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors",
                amount === String(s)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              ${s}
            </button>
          ))}
        </div>
      </div>

      {/* Stop Loss / Take Profit */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <HugeiconsIcon icon={AlertDiamondIcon} className="h-3 w-3 text-red-500" />
            Stop Loss
          </label>
          <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-accent/20 px-2 py-1.5">
            <span className="text-[10px] text-muted-foreground">$</span>
            <input
              type="number"
              min="0"
              placeholder={String(Math.max(0, amountNum * 0.5).toFixed(0))}
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              className="flex-1 bg-transparent text-xs font-medium outline-none [appearance:textfield]"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <HugeiconsIcon icon={Target02Icon} className="h-3 w-3 text-emerald-500" />
            Take Profit
          </label>
          <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-accent/20 px-2 py-1.5">
            <span className="text-[10px] text-muted-foreground">$</span>
            <input
              type="number"
              min="0"
              placeholder={String((potentialProfit * 0.8).toFixed(0))}
              value={takeProfit}
              onChange={(e) => setTakeProfit(e.target.value)}
              className="flex-1 bg-transparent text-xs font-medium outline-none [appearance:textfield]"
            />
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="space-y-1 rounded-lg bg-accent/20 px-3 py-2.5 text-xs">
        <div className="flex justify-between text-muted-foreground">
          <span>Entry Price</span>
          <span className="font-mono font-medium text-foreground">{fmtPrice(asset.price)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Payout</span>
          <span className="font-mono font-medium text-emerald-500">{asset.payout}%</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Potential Profit</span>
          <span className="font-mono font-medium text-emerald-500">+${potentialProfit.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Expiry</span>
          <span className="font-mono font-medium text-foreground">{expiry}</span>
        </div>
      </div>

      {/* Place Trade */}
      <button
        onClick={handleTrade}
        disabled={amountNum <= 0 || isPlacing}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white transition-colors disabled:opacity-50",
          direction === "up"
            ? "bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700"
            : "bg-red-500 hover:bg-red-600 active:bg-red-700",
        )}
      >
        {isPlacing ? (
          <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <HugeiconsIcon icon={direction === "up" ? ArrowUp01Icon : ArrowDown01Icon} className="h-4 w-4" />
            {direction === "up" ? "Call (Up)" : "Put (Down)"} — ${amountNum}
          </>
        )}
      </button>
    </div>
  )
}

// ── Active Trades ──────────────────────────────────────────────────────────

function ActiveTrades({ trades }: { trades: BinaryTrade[] }) {
  const [, forceUpdate] = React.useState(0)

  React.useEffect(() => {
    const id = setInterval(() => forceUpdate((v) => v + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const activeTrades = trades.filter((t) => t.status === "active")
  const recentTrades = trades.filter((t) => t.status !== "active").slice(0, 10)

  return (
    <div className="flex flex-col overflow-hidden border border-border/50 bg-card">
      <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2.5">
        <HugeiconsIcon icon={Clock01Icon} className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold">Trades</span>
        {activeTrades.length > 0 && (
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
            {activeTrades.length}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {trades.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <HugeiconsIcon icon={Activity01Icon} className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">No trades yet</p>
            <p className="text-[10px] text-muted-foreground/60">Place a trade to see it here</p>
          </div>
        ) : (
          <>
            {activeTrades.map((t) => {
              const remaining = Math.max(0, Math.floor((t.expiresAt - Date.now()) / 1000))
              const isExpired = remaining <= 0
              return (
                <div key={t.id} className="flex items-center justify-between border-b border-border/20 px-3 py-2">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-medium">{t.symbol}</span>
                      <span className={cn(
                        "rounded px-1 py-0.5 text-[8px] font-bold",
                        t.direction === "up" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500",
                      )}>
                        <HugeiconsIcon icon={t.direction === "up" ? ArrowUp01Icon : ArrowDown01Icon} className="h-2.5 w-2.5" />
                        {t.direction === "up" ? "UP" : "DOWN"}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">${t.amount} · {t.payout}%</span>
                  </div>
                  <div className="text-right">
                    {isExpired ? (
                      <span className="text-[10px] font-medium text-amber-500">Settling...</span>
                    ) : (
                      <span className="text-xs font-mono font-bold tabular-nums text-primary">{formatCountdown(remaining)}</span>
                    )}
                  </div>
                </div>
              )
            })}
            {recentTrades.map((t) => (
              <div key={t.id} className="flex items-center justify-between border-b border-border/20 px-3 py-2 opacity-70">
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium">{t.symbol}</span>
                    <span className={cn(
                      "rounded px-1 py-0.5 text-[8px] font-bold",
                      t.direction === "up" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500",
                    )}>
                      <HugeiconsIcon icon={t.direction === "up" ? ArrowUp01Icon : ArrowDown01Icon} className="h-2.5 w-2.5" />
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">${t.amount}</span>
                </div>
                <span className={cn(
                  "text-[11px] font-semibold",
                  t.status === "won" ? "text-emerald-500" : "text-red-500",
                )}>
                  {t.status === "won" ? `+$${(t.amount * t.payout / 100).toFixed(2)}` : `-$${t.amount.toFixed(2)}`}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// ── Main BinaryClient ──────────────────────────────────────────────────────

export function BinaryClient() {
  const [selectedAsset, setSelectedAsset] = React.useState(BINARY_ASSETS[0])
  const [trades, setTrades] = React.useState<BinaryTrade[]>([])
  const [isDark, setIsDark] = React.useState(true)
  const [mobileTab, setMobileTab] = React.useState<MobileTab>("chart")
  const { collapsed, toggle } = usePanelLayout()

  React.useEffect(() => {
    const update = () => setIsDark(document.documentElement.classList.contains("dark"))
    update()
    const obs = new MutationObserver(update)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => obs.disconnect()
  }, [])

  // Auto-resolve trades when they expire
  React.useEffect(() => {
    const id = setInterval(() => {
      setTrades((prev) =>
        prev.map((t) => {
          if (t.status !== "active") return t
          if (Date.now() < t.expiresAt) return t
          // Simulate win/loss (60% win rate for demo)
          const won = Math.random() > 0.4
          return { ...t, status: won ? "won" : "lost" }
        }),
      )
    }, 1000)
    return () => clearInterval(id)
  }, [])

  function handlePlaceTrade(trade: BinaryTrade) {
    setTrades((prev) => [trade, ...prev])
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* ── TOP BAR ── */}
      <TradingHeader>
        <BinaryAssetInfo asset={selectedAsset} />
      </TradingHeader>

      {/* ═══ DESKTOP: 3-column main + standalone bottom ═══ */}
      <div className="hidden lg:flex flex-1 flex-col overflow-hidden p-1 gap-1">
        {/* MAIN ROW */}
        <div className="flex-1 min-h-0 flex gap-1 overflow-hidden">
          {/* LEFT — Asset List */}
          {collapsed.left ? (
            <button
              onClick={() => toggle("left")}
              className="shrink-0 w-6 flex flex-col items-center justify-center rounded-xl bg-card border border-border/20 hover:bg-accent/50 transition-colors group"
              title="Expand assets"
            >
              <HugeiconsIcon icon={ArrowRight01Icon} className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
              <span className="text-[9px] text-muted-foreground [writing-mode:vertical-lr] mt-1">Assets</span>
            </button>
          ) : (
            <div className="shrink-0 w-[260px] xl:w-[300px] overflow-hidden relative">
              <button
                onClick={() => toggle("left")}
                className="absolute top-1 right-1 z-10 rounded-md p-0.5 bg-card/80 border border-border/20 hover:bg-accent transition-colors"
                title="Collapse assets"
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} className="h-3 w-3 text-muted-foreground" />
              </button>
              <AssetList
                assets={BINARY_ASSETS}
                selected={selectedAsset.symbol}
                onSelect={setSelectedAsset}
              />
            </div>
          )}

          {/* CENTER — Chart + Order Panel */}
          <div className="flex-1 min-w-0 flex flex-col gap-1 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-hidden border border-border/50 bg-card">
              <BinaryChart asset={selectedAsset} isDark={isDark} />
            </div>
            <div className="shrink-0 overflow-hidden">
              <BinaryOrderPanel asset={selectedAsset} onPlaceTrade={handlePlaceTrade} />
            </div>
          </div>

          {/* RIGHT — Active Trades */}
          {collapsed.right ? (
            <button
              onClick={() => toggle("right")}
              className="shrink-0 w-6 flex flex-col items-center justify-center rounded-xl bg-card border border-border/20 hover:bg-accent/50 transition-colors group"
              title="Expand trades"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
              <span className="text-[9px] text-muted-foreground [writing-mode:vertical-lr] mt-1">Trades</span>
            </button>
          ) : (
            <div className="shrink-0 w-[260px] xl:w-[300px] flex flex-col overflow-hidden relative">
              <button
                onClick={() => toggle("right")}
                className="absolute top-1 right-1 z-10 rounded-md p-0.5 bg-card/80 border border-border/20 hover:bg-accent transition-colors"
                title="Collapse trades"
              >
                <HugeiconsIcon icon={ArrowRight01Icon} className="h-3 w-3 text-muted-foreground" />
              </button>
              <div className="flex-1 min-h-0">
                <ActiveTrades trades={trades} />
              </div>
            </div>
          )}
        </div>


      </div>

      {/* ═══ MOBILE layout ═══ */}
      <div className="flex flex-1 flex-col overflow-y-auto slim-scroll lg:hidden">
        {/* Flat tabs */}
        <div className="flex items-center border-b border-border/30 bg-card shrink-0">
          {(["chart", "assets", "history"] as MobileTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setMobileTab(t)}
              className={cn(
                "flex-1 py-2.5 text-xs font-medium transition-colors",
                mobileTab === t ? "bg-card text-foreground border-b-2 border-primary" : "text-muted-foreground",
              )}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="min-h-[360px]">
          {mobileTab === "chart" && (
            <div className="h-[360px] bg-card">
              <BinaryChart asset={selectedAsset} isDark={isDark} />
            </div>
          )}
          {mobileTab === "assets" && (
            <AssetList
              assets={BINARY_ASSETS}
              selected={selectedAsset.symbol}
              onSelect={(a) => { setSelectedAsset(a); setMobileTab("chart") }}
            />
          )}
          {mobileTab === "history" && (
            <ActiveTrades trades={trades} />
          )}
        </div>

        <div className="shrink-0">
          <BinaryOrderPanel asset={selectedAsset} onPlaceTrade={handlePlaceTrade} />
        </div>

      </div>
    </div>
  )
}

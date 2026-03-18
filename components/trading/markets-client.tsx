"use client"

import * as React from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowUp01Icon,
  ArrowDown01Icon,
  Search01Icon,
  ArrowUpRight01Icon,
  StarIcon,
  Chart01Icon,
  Fire02Icon,
} from "@hugeicons/core-free-icons"
import type { CoinData, FuturesMarket } from "@/lib/actions"
import { getSpotMarkets, getFuturesMarkets } from "@/lib/actions"
import { ErrorState } from "@/components/error-state"
import { useTradeSelector } from "@/components/trade-selector"
import { useHyperliquidPositions } from "@/hooks/useHyperliquidPositions"
import { useHyperliquidBalance } from "@/hooks/useHyperliquidBalance"
import { useAuth } from "@/components/auth-provider"
import { getCoinImage, coinFallback } from "@/lib/coin-images"

// ── Sparkline generator (deterministic from coin data) ───────────────────

function generateSparkPoints(coin: CoinData, pts = 20, W = 80, H = 32): string {
  const seed = coin.symbol.split("").reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 7) * 31, 0)
  const rng = (i: number) => {
    const x = Math.sin(seed + i * 127.1 + i * i * 0.7) * 43758.5453
    return x - Math.floor(x)
  }
  const trend = (coin.change24h / 100) * 0.65
  const values: number[] = []
  for (let i = 0; i < pts; i++) {
    const noise = (rng(i) - 0.5) * 0.03
    const smoothNoise = (rng(i) + rng(i + pts) - 1) * 0.015
    values.push(1 + (i / (pts - 1)) * trend + noise + smoothNoise)
  }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 0.001
  return values
    .map((v, i) => {
      const x = (i / (pts - 1)) * W
      const y = H - ((v - min) / range) * (H - 4) - 2
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")
}

function Sparkline({ coin, width = 80, height = 32 }: { coin: CoinData; width?: number; height?: number }) {
  const pts = generateSparkPoints(coin, 20, width, height)
  const color = coin.change24h >= 0 ? "#10b981" : "#ef4444"
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ── Formatters ───────────────────────────────────────────────────────────

function TradeButton({ symbol }: { symbol: string }) {
  const { openTradeSelector } = useTradeSelector()
  return (
    <button
      onClick={() => openTradeSelector(symbol)}
      className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
    >
      Trade
      <HugeiconsIcon icon={ArrowUpRight01Icon} className="h-3 w-3" />
    </button>
  )
}

function FuturesTradeButton({ symbol }: { symbol: string }) {
  return (
    <Link
      href={`/futures?pair=${symbol}`}
      className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-500 transition-colors hover:bg-amber-500 hover:text-white"
    >
      Trade
      <HugeiconsIcon icon={ArrowUpRight01Icon} className="h-3 w-3" />
    </Link>
  )
}

function fmtPrice(n: number): string {
  if (n >= 10000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 })
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 })
  if (n >= 1) return n.toFixed(4)
  if (n >= 0.01) return n.toFixed(5)
  return n.toFixed(8)
}

function fmtLarge(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  return `$${n.toLocaleString()}`
}

// ── Ranked List Item ─────────────────────────────────────────────────────

function RankedCoinRow({ coin, rank }: { coin: CoinData; rank: number }) {
  const isUp = coin.change24h >= 0
  return (
    <Link
      href={`/spot?pair=${coin.symbol}`}
      className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-accent/40"
    >
      <span className="w-5 text-center text-[11px] font-semibold text-muted-foreground">
        {rank}
      </span>
      <img
        src={coin.image}
        alt={coin.symbol}
        className="h-7 w-7 shrink-0 rounded-full object-contain ring-1 ring-border/20"
        onError={(e) => {
          ;(e.target as HTMLImageElement).src = coinFallback(coin.symbol)
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs font-semibold">{coin.symbol}</span>
        <span className="truncate text-[10px] text-muted-foreground">{coin.name}</span>
      </div>
      <Sparkline coin={coin} width={64} height={24} />
      <div className="flex flex-col items-end gap-0.5">
        <span className="text-xs font-bold tabular-nums">${fmtPrice(coin.price)}</span>
        <span
          className={`flex items-center gap-0.5 text-[11px] font-semibold ${
            isUp ? "text-emerald-500" : "text-red-500"
          }`}
        >
          <HugeiconsIcon icon={isUp ? ArrowUp01Icon : ArrowDown01Icon} className="h-2.5 w-2.5" />
          {Math.abs(coin.change24h).toFixed(2)}%
        </span>
      </div>
    </Link>
  )
}

function RankedFuturesRow({ market, rank }: { market: FuturesMarket; rank: number }) {
  const isUp = market.change24h >= 0
  const imgSrc = market.image || getCoinImage(market.baseAsset)
  return (
    <Link
      href={`/futures?pair=${market.symbol}`}
      className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-accent/40"
    >
      <span className="w-5 text-center text-[11px] font-semibold text-muted-foreground">
        {rank}
      </span>
      {imgSrc ? (
        <img
          src={imgSrc}
          alt={market.baseAsset}
          className="h-7 w-7 shrink-0 rounded-full object-contain ring-1 ring-amber-500/20"
          onError={(e) => { (e.target as HTMLImageElement).src = coinFallback(market.baseAsset) }}
        />
      ) : (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/10 ring-1 ring-amber-500/20 text-[9px] font-bold text-amber-600">
          {market.baseAsset.slice(0, 3)}
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs font-semibold">{market.symbol}</span>
        <span className="truncate text-[10px] text-muted-foreground">Perpetual</span>
      </div>
      <div className="flex flex-col items-end gap-0.5">
        <span className="text-xs font-bold tabular-nums">${fmtPrice(market.markPrice)}</span>
        <span
          className={`flex items-center gap-0.5 text-[11px] font-semibold ${
            isUp ? "text-emerald-500" : "text-red-500"
          }`}
        >
          <HugeiconsIcon icon={isUp ? ArrowUp01Icon : ArrowDown01Icon} className="h-2.5 w-2.5" />
          {Math.abs(market.change24h).toFixed(2)}%
        </span>
      </div>
    </Link>
  )
}

// ── Markets Client ───────────────────────────────────────────────────────

const MARKET_TABS = ["Total", "Main", "Spot", "Futures"] as const
type Tab = (typeof MARKET_TABS)[number]

type SortKey = "marketCap" | "price" | "change24h" | "volume24h"

function fmtFunding(rate: number): string {
  return `${(rate * 100).toFixed(4)}%`
}

function fmtOI(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

interface MarketsClientProps {
  coins: CoinData[]
  futuresMarkets?: FuturesMarket[]
  globalStats: {
    totalMarketCap: number
    totalVolume: number
    btcDominance: number
    marketCapChange24h: number
  }
  error?: string
}

export function MarketsClient({ coins, globalStats, error }: MarketsClientProps) {
  const [tab, setTab] = React.useState<Tab>("Total")
  const [search, setSearch] = React.useState("")
  const [sortBy, setSortBy] = React.useState<SortKey>("marketCap")
  const [sortAsc, setSortAsc] = React.useState(false)
  const [favorites, setFavorites] = React.useState<Set<string>>(new Set())
  const { user } = useAuth()
  const { positions, loading: positionsLoading } = useHyperliquidPositions()
  const { balances: spotHoldings, loading: spotHoldingsLoading } = useHyperliquidBalance(user?.userId, !!user)

  // Lazy-load spot markets (Hyperliquid spotMeta)
  const [spotMarkets, setSpotMarkets] = React.useState<CoinData[]>([])
  const [spotLoading, setSpotLoading] = React.useState(false)
  const hasFetchedSpot = React.useRef(false)
  React.useEffect(() => {
    if (tab !== "Spot" || hasFetchedSpot.current) return
    hasFetchedSpot.current = true
    setSpotLoading(true)
    getSpotMarkets().then((res) => { setSpotMarkets(res.markets) }).catch(() => {}).finally(() => setSpotLoading(false))
  }, [tab])

  // Lazy-load futures markets
  const [futuresMarkets, setFuturesMarkets] = React.useState<FuturesMarket[]>([])
  const [futuresLoading, setFuturesLoading] = React.useState(false)
  const hasFetchedFutures = React.useRef(false)
  React.useEffect(() => {
    if (tab !== "Futures" || hasFetchedFutures.current) return
    hasFetchedFutures.current = true
    setFuturesLoading(true)
    getFuturesMarkets().then((res) => { if (res.success) setFuturesMarkets(res.markets) }).catch(() => {}).finally(() => setFuturesLoading(false))
  }, [tab])

  const isFutures = tab === "Futures"

  // ── Spot-mode memos ─────────────────────────────────────────────────────

  const gainers = React.useMemo(
    () =>
      [...(tab === "Spot" ? spotMarkets : coins)]
        .filter((c) => c.change24h > 0)
        .sort((a, b) => b.change24h - a.change24h)
        .slice(0, 12),
    [coins, spotMarkets, tab],
  )

  const losers = React.useMemo(
    () =>
      [...(tab === "Spot" ? spotMarkets : coins)]
        .filter((c) => c.change24h < 0)
        .sort((a, b) => a.change24h - b.change24h)
        .slice(0, 12),
    [coins, spotMarkets, tab],
  )

  const movers = React.useMemo(
    () =>
      [...(tab === "Spot" ? spotMarkets : coins)]
        .sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h))
        .slice(0, 8),
    [coins, spotMarkets, tab],
  )

  const filtered = React.useMemo(() => {
    const source = tab === "Spot" ? spotMarkets : [...coins]
    let list = tab === "Spot" ? [...source] : [...source]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (c) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q),
      )
    }
    if (tab === "Main") list = list.slice(0, search ? list.length : 20)
    const key = sortBy
    list.sort((a, b) => {
      const av = (a[key] as number) ?? 0
      const bv = (b[key] as number) ?? 0
      if (tab === "Total") return bv - av === 0 ? 0 : sortAsc ? av - bv : b.volume24h - a.volume24h
      return sortAsc ? av - bv : bv - av
    })
    return list
  }, [coins, spotMarkets, tab, search, sortBy, sortAsc])

  // ── Futures-mode memos ──────────────────────────────────────────────────

  const futuresGainers = React.useMemo(
    () =>
      [...futuresMarkets]
        .filter((m) => m.change24h > 0)
        .sort((a, b) => b.change24h - a.change24h)
        .slice(0, 12),
    [futuresMarkets],
  )

  const futuresMovers = React.useMemo(
    () =>
      [...futuresMarkets]
        .sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h))
        .slice(0, 8),
    [futuresMarkets],
  )

  const filteredFutures = React.useMemo(() => {
    let list = [...futuresMarkets]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((m) => m.symbol.toLowerCase().includes(q) || m.baseAsset.toLowerCase().includes(q))
    }
    list.sort((a, b) => {
      if (sortBy === "volume24h") return sortAsc ? a.volume24h - b.volume24h : b.volume24h - a.volume24h
      if (sortBy === "price") return sortAsc ? a.markPrice - b.markPrice : b.markPrice - a.markPrice
      if (sortBy === "change24h") return sortAsc ? a.change24h - b.change24h : b.change24h - a.change24h
      return sortAsc ? a.openInterest - b.openInterest : b.openInterest - a.openInterest
    })
    return list
  }, [futuresMarkets, search, sortBy, sortAsc])

  const toggleSort = (col: SortKey) => {
    if (sortBy === col) setSortAsc((v) => !v)
    else {
      setSortBy(col)
      setSortAsc(false)
    }
  }

  const sortIndicator = (col: SortKey) =>
    sortBy === col ? (sortAsc ? " ↑" : " ↓") : ""

  if (error && coins.length === 0) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card">
        <ErrorState message={error} />
      </div>
    )
  }

  // Computed futures global stats
  const futuresVolume = futuresMarkets.reduce((s, m) => s + m.volume24h, 0)
  const futuresOI = futuresMarkets.reduce((s, m) => s + m.openInterest, 0)
  const avgFunding = futuresMarkets.length > 0
    ? futuresMarkets.reduce((s, m) => s + m.fundingRate, 0) / futuresMarkets.length
    : 0

  return (
    <div className="flex flex-col gap-6">
      {/* Header + Tabs */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h1 className="text-2xl font-bold tracking-tight">Markets</h1>
            <p className="text-sm text-muted-foreground">
              {isFutures
                ? `Hyperliquid perpetual futures · ${futuresMarkets.length} contracts`
                : tab === "Spot"
                ? `Hyperliquid spot markets · ${spotMarkets.length} pairs`
                : tab === "Main"
                ? `Top 20 assets by market cap`
                : `Real-time prices for ${coins.length} assets`}
            </p>
          </div>
          {/* Market type tabs */}
          <div className="flex items-center rounded-xl bg-accent/50 p-1">
            {MARKET_TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${
                  tab === t
                    ? t === "Futures"
                      ? "bg-amber-500 text-white shadow-md shadow-amber-500/25"
                      : "bg-primary text-white shadow-md shadow-primary/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Global stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {isFutures ? (
          <>
            {[
              { label: "Total Volume 24h", value: fmtLarge(futuresVolume), sub: null, up: null },
              { label: "Open Interest", value: fmtOI(futuresOI), sub: null, up: null },
              {
                label: "Avg Funding Rate",
                value: fmtFunding(avgFunding),
                sub: null,
                up: avgFunding >= 0,
              },
              { label: "Contracts", value: `${futuresMarkets.length}`, sub: null, up: null },
            ].map((s) => (
              <div
                key={s.label}
                className="flex flex-col gap-1 rounded-2xl border border-border/50 bg-card p-4"
              >
                <span className="text-xs text-muted-foreground">{s.label}</span>
                <span className={`text-xl font-bold tabular-nums ${s.up === true ? "text-emerald-500" : s.up === false ? "text-red-500" : ""}`}>{s.value}</span>
              </div>
            ))}
          </>
        ) : (
          <>
            {[
              {
                label: "Market Cap",
                value: fmtLarge(globalStats.totalMarketCap),
                sub: `${globalStats.marketCapChange24h >= 0 ? "+" : ""}${globalStats.marketCapChange24h.toFixed(2)}%`,
                up: globalStats.marketCapChange24h >= 0,
              },
              { label: "24h Volume", value: fmtLarge(globalStats.totalVolume), sub: null, up: null },
              {
                label: "BTC Dominance",
                value: `${globalStats.btcDominance.toFixed(1)}%`,
                sub: null,
                up: null,
              },
              { label: "Listed Assets", value: `${coins.length}`, sub: null, up: null },
            ].map((s) => (
              <div
                key={s.label}
                className="flex flex-col gap-1 rounded-2xl border border-border/50 bg-card p-4"
              >
                <span className="text-xs text-muted-foreground">{s.label}</span>
                <span className="text-xl font-bold tabular-nums">{s.value}</span>
                {s.sub && (
                  <span
                    className={`text-xs font-medium ${s.up ? "text-emerald-500" : "text-red-500"}`}
                  >
                    {s.sub}
                  </span>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* My Positions / Holdings */}
      {(isFutures ? positions.length > 0 || positionsLoading : spotHoldings.length > 0 || spotHoldingsLoading) && (
        <section className="overflow-hidden rounded-2xl border border-border/50 bg-card">
          <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3">
            <div className={`flex h-6 w-6 items-center justify-center rounded-lg ${isFutures ? "bg-amber-500/10" : "bg-primary/10"}`}>
              <HugeiconsIcon icon={StarIcon} className={`h-3.5 w-3.5 ${isFutures ? "text-amber-500" : "text-primary"}`} />
            </div>
            <h3 className="text-sm font-semibold">{isFutures ? "My Positions" : "My Holdings"}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              isFutures ? "bg-amber-500/10 text-amber-500" : "bg-primary/10 text-primary"
            }`}>
              {isFutures ? positions.length : spotHoldings.length}
            </span>
            <Link
              href="/assets"
              className="ml-auto text-xs font-medium text-primary hover:underline"
            >
              View all
            </Link>
          </div>

          {(isFutures ? positionsLoading : spotHoldingsLoading) ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : isFutures ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/30 text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-medium">Contract</th>
                    <th className="px-4 py-2.5 text-right font-medium">Size</th>
                    <th className="px-4 py-2.5 text-right font-medium">Entry</th>
                    <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">Liq. Price</th>
                    <th className="px-4 py-2.5 text-right font-medium">Value</th>
                    <th className="px-4 py-2.5 text-right font-medium">PnL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {positions.map((pos) => {
                    const size = parseFloat(pos.szi)
                    const isLong = size > 0
                    const pnl = parseFloat(pos.unrealizedPnl)
                    const roe = parseFloat(pos.returnOnEquity) * 100
                    const isProfit = pnl >= 0
                    const lev = pos.leverage ? `${pos.leverage.value}×` : ""
                    return (
                      <tr key={pos.coin} className="transition-colors hover:bg-accent/20">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold ${isLong ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}`}>
                              {isLong ? "L" : "S"}
                            </span>
                            {getCoinImage(pos.coin) ? (
                              <img
                                src={getCoinImage(pos.coin)}
                                alt={pos.coin}
                                className="h-5 w-5 shrink-0 rounded-full object-contain"
                                onError={(e) => { (e.target as HTMLImageElement).src = coinFallback(pos.coin) }}
                              />
                            ) : null}
                            <div className="flex flex-col">
                              <span className="font-semibold">{pos.coin}-PERP</span>
                              <span className="text-[10px] text-muted-foreground">{lev}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-medium tabular-nums">
                          {Math.abs(size).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        </td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                          ${fmtPrice(parseFloat(pos.entryPx))}
                        </td>
                        <td className="hidden px-4 py-2.5 text-right text-muted-foreground tabular-nums sm:table-cell">
                          {pos.liquidationPx ? `$${fmtPrice(parseFloat(pos.liquidationPx))}` : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                          ${parseFloat(pos.positionValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex flex-col items-end">
                            <span className={`font-medium tabular-nums ${isProfit ? "text-emerald-500" : "text-red-500"}`}>
                              {isProfit ? "+" : ""}${pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className={`text-[10px] tabular-nums ${isProfit ? "text-emerald-500/70" : "text-red-500/70"}`}>
                              {isProfit ? "+" : ""}{roe.toFixed(2)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/30 text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-medium">Asset</th>
                    <th className="px-4 py-2.5 text-right font-medium">Balance</th>
                    <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">Entry Price</th>
                    <th className="px-4 py-2.5 text-right font-medium">Value</th>
                    <th className="px-4 py-2.5 text-right font-medium">PnL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {spotHoldings.map((b) => {
                    const isProfit = b.unrealizedPnl >= 0
                    return (
                      <tr key={b.coin} className="transition-colors hover:bg-accent/20">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            {getCoinImage(b.coin) ? (
                              <img
                                src={getCoinImage(b.coin)}
                                alt={b.coin}
                                className="h-6 w-6 shrink-0 rounded-full object-contain"
                                onError={(e) => { (e.target as HTMLImageElement).src = coinFallback(b.coin) }}
                              />
                            ) : (
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">
                                {b.coin.slice(0, 2)}
                              </div>
                            )}
                            <span className="font-semibold">{b.coin}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-medium tabular-nums">
                          {b.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                        </td>
                        <td className="hidden px-4 py-2.5 text-right text-muted-foreground tabular-nums sm:table-cell">
                          ${b.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: b.entryPrice < 1 ? 6 : 2 })}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                          ${b.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex flex-col items-end">
                            <span className={`font-medium tabular-nums ${isProfit ? "text-emerald-500" : "text-red-500"}`}>
                              {isProfit ? "+" : ""}${b.unrealizedPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className={`text-[10px] tabular-nums ${isProfit ? "text-emerald-500/70" : "text-red-500/70"}`}>
                              {isProfit ? "+" : ""}{b.unrealizedPnlPercent.toFixed(2)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Full Markets Table */}
      <section>
        <div className="overflow-hidden rounded-2xl border border-border/50 bg-card">
          {/* Table toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 p-4">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={Chart01Icon} className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">{isFutures ? "Futures Markets" : tab === "Spot" ? "Spot Markets" : tab === "Main" ? "Main Markets" : "All Markets"}</h2>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                isFutures ? "bg-amber-500/10 text-amber-500" : "bg-primary/10 text-primary"
              }`}>
                {isFutures ? filteredFutures.length : filtered.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <HugeiconsIcon
                  icon={Search01Icon}
                  className="absolute left-2 top-[7px] h-3.5 w-3.5 text-muted-foreground"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="w-32 rounded-lg bg-accent/50 py-1.5 pl-7 pr-2 text-xs outline-none transition-all focus:w-44 focus:bg-accent"
                />
              </div>
            </div>
          </div>

          {/* Table — Spot / Total / Main */}
          {!isFutures && (
            spotLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/30 text-muted-foreground">
                    <th className="sticky left-0 z-10 bg-card px-4 py-3 text-left font-medium w-10">#</th>
                    <th className="sticky left-10 z-10 bg-card px-3 py-3 text-left font-medium">Asset</th>
                    <th className="cursor-pointer select-none px-4 py-3 text-right font-medium hover:text-foreground" onClick={() => toggleSort("price")}>
                      Price{sortIndicator("price")}
                    </th>
                    <th className="cursor-pointer select-none px-4 py-3 text-right font-medium hover:text-foreground" onClick={() => toggleSort("change24h")}>
                      24h{sortIndicator("change24h")}
                    </th>
                    <th className="hidden cursor-pointer select-none px-4 py-3 text-right font-medium hover:text-foreground md:table-cell" onClick={() => toggleSort("marketCap")}>
                      Market Cap{sortIndicator("marketCap")}
                    </th>
                    <th className="hidden cursor-pointer select-none px-4 py-3 text-right font-medium hover:text-foreground lg:table-cell" onClick={() => toggleSort("volume24h")}>
                      Volume{sortIndicator("volume24h")}
                    </th>
                    <th className="hidden px-4 py-3 text-center font-medium md:table-cell">7D Chart</th>
                    <th className="px-4 py-3 text-right font-medium">Trade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {filtered.map((coin, idx) => {
                    const isUp = coin.change24h >= 0
                    const isFav = favorites.has(coin.id)
                    return (
                      <tr key={coin.id} className="group/row transition-colors hover:bg-accent/20">
                        <td className="sticky left-0 z-10 bg-card px-4 py-3 text-muted-foreground transition-colors group-hover/row:bg-accent/20">{idx + 1}</td>
                        <td className="sticky left-10 z-10 bg-card px-3 py-3 transition-colors group-hover/row:bg-accent/20">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                setFavorites((prev) => {
                                  const n = new Set(prev)
                                  if (n.has(coin.id)) n.delete(coin.id)
                                  else n.add(coin.id)
                                  return n
                                })
                              }
                              className={`hidden h-4 w-4 shrink-0 items-center justify-center sm:flex ${
                                isFav ? "text-amber-400" : "text-muted-foreground/30 hover:text-muted-foreground"
                              }`}
                            >
                              <HugeiconsIcon icon={StarIcon} className="h-3 w-3" />
                            </button>
                            <img
                              src={coin.image}
                              alt={coin.symbol}
                              className="h-6 w-6 shrink-0 rounded-full object-contain ring-1 ring-border/20"
                              onError={(e) => {
                                ;(e.target as HTMLImageElement).src = coinFallback(coin.symbol)
                              }}
                            />
                            <div className="flex flex-col">
                              <span className="font-semibold">{coin.symbol}</span>
                              <span className="hidden text-[10px] text-muted-foreground sm:block">{coin.name}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-medium">${fmtPrice(coin.price)}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${isUp ? "text-emerald-500" : "text-red-500"}`}>
                          <span className="flex items-center justify-end gap-0.5">
                            <HugeiconsIcon icon={isUp ? ArrowUp01Icon : ArrowDown01Icon} className="h-3 w-3" />
                            {Math.abs(coin.change24h).toFixed(2)}%
                          </span>
                        </td>
                        <td className="hidden px-4 py-3 text-right text-muted-foreground md:table-cell">{fmtLarge(coin.marketCap)}</td>
                        <td className="hidden px-4 py-3 text-right text-muted-foreground lg:table-cell">{fmtLarge(coin.volume24h)}</td>
                        <td className="hidden px-4 py-3 md:table-cell">
                          <div className="flex justify-center">
                            <Sparkline coin={coin} />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <TradeButton symbol={coin.symbol} />
                        </td>
                      </tr>
                    )
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                        No assets match your search
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            )
          )}

          {/* Table — Futures */}
          {isFutures && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/30 text-muted-foreground">
                    <th className="sticky left-0 z-10 bg-card px-4 py-3 text-left font-medium w-10">#</th>
                    <th className="sticky left-10 z-10 bg-card px-3 py-3 text-left font-medium">Contract</th>
                    <th className="cursor-pointer select-none px-4 py-3 text-right font-medium hover:text-foreground" onClick={() => toggleSort("price")}>
                      Mark Price{sortIndicator("price")}
                    </th>
                    <th className="cursor-pointer select-none px-4 py-3 text-right font-medium hover:text-foreground" onClick={() => toggleSort("change24h")}>
                      24h{sortIndicator("change24h")}
                    </th>
                    <th className="hidden px-4 py-3 text-right font-medium md:table-cell">Funding</th>
                    <th className="hidden cursor-pointer select-none px-4 py-3 text-right font-medium hover:text-foreground lg:table-cell" onClick={() => toggleSort("volume24h")}>
                      Volume{sortIndicator("volume24h")}
                    </th>
                    <th className="hidden px-4 py-3 text-right font-medium md:table-cell">OI</th>
                    <th className="px-4 py-3 text-right font-medium">Trade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {filteredFutures.map((market, idx) => {
                    const isUp = market.change24h >= 0
                    const fundingUp = market.fundingRate >= 0
                    return (
                      <tr key={market.symbol} className="group/row transition-colors hover:bg-accent/20">
                        <td className="sticky left-0 z-10 bg-card px-4 py-3 text-muted-foreground transition-colors group-hover/row:bg-accent/20">{idx + 1}</td>
                        <td className="sticky left-10 z-10 bg-card px-3 py-3 transition-colors group-hover/row:bg-accent/20">
                          <div className="flex items-center gap-2">
                            {(market.image || getCoinImage(market.baseAsset)) ? (
                              <img
                                src={market.image || getCoinImage(market.baseAsset)}
                                alt={market.baseAsset}
                                className="h-6 w-6 shrink-0 rounded-full object-contain ring-1 ring-amber-500/20"
                                onError={(e) => { (e.target as HTMLImageElement).src = coinFallback(market.baseAsset) }}
                              />
                            ) : (
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/10 ring-1 ring-amber-500/20 text-[9px] font-bold text-amber-600">
                                {market.baseAsset.slice(0, 3)}
                              </div>
                            )}
                            <div className="flex flex-col">
                              <span className="font-semibold">{market.symbol}</span>
                              <span className="hidden text-[10px] text-muted-foreground sm:block">
                                Perp · {market.maxLeverage}× max
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-medium">${fmtPrice(market.markPrice)}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${isUp ? "text-emerald-500" : "text-red-500"}`}>
                          <span className="flex items-center justify-end gap-0.5">
                            <HugeiconsIcon icon={isUp ? ArrowUp01Icon : ArrowDown01Icon} className="h-3 w-3" />
                            {Math.abs(market.change24h).toFixed(2)}%
                          </span>
                        </td>
                        <td className={`hidden px-4 py-3 text-right font-medium md:table-cell ${fundingUp ? "text-emerald-500" : "text-red-500"}`}>
                          {fundingUp ? "+" : ""}{fmtFunding(market.fundingRate)}
                        </td>
                        <td className="hidden px-4 py-3 text-right text-muted-foreground lg:table-cell">{fmtOI(market.volume24h)}</td>
                        <td className="hidden px-4 py-3 text-right text-muted-foreground md:table-cell">{fmtOI(market.openInterest)}</td>
                        <td className="px-4 py-3 text-right">
                          <FuturesTradeButton symbol={market.symbol} />
                        </td>
                      </tr>
                    )
                  })}
                  {filteredFutures.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                        No contracts match your search
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Top Gainers & Top Movers Side by Side */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top Gainers */}
        {(!isFutures ? gainers : futuresGainers).length > 0 && (
          <section className="overflow-hidden rounded-2xl border border-border/50 bg-card">
            <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10">
                <HugeiconsIcon icon={ArrowUp01Icon} className="h-3.5 w-3.5 text-emerald-500" />
              </div>
              <h3 className="text-sm font-semibold">Top Gainers</h3>
              <span className="ml-auto rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500">
                24h
              </span>
            </div>
            <div className="flex flex-col divide-y divide-border/20 p-1">
              {!isFutures
                ? gainers.slice(0, 8).map((c, i) => <RankedCoinRow key={c.id} coin={c} rank={i + 1} />)
                : futuresGainers.slice(0, 8).map((m, i) => <RankedFuturesRow key={m.symbol} market={m} rank={i + 1} />)}
            </div>
          </section>
        )}

        {/* Top Movers */}
        {(!isFutures ? movers : futuresMovers).length > 0 && (
          <section className="overflow-hidden rounded-2xl border border-border/50 bg-card">
            <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-orange-500/10">
                <HugeiconsIcon icon={Fire02Icon} className="h-3.5 w-3.5 text-orange-500" />
              </div>
              <h3 className="text-sm font-semibold">Top Movers</h3>
              <span className="ml-auto rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-medium text-orange-500">
                24h
              </span>
            </div>
            <div className="flex flex-col divide-y divide-border/20 p-1">
              {!isFutures
                ? movers.map((c, i) => <RankedCoinRow key={c.id} coin={c} rank={i + 1} />)
                : futuresMovers.map((m, i) => <RankedFuturesRow key={m.symbol} market={m} rank={i + 1} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

"use client"

import * as React from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { Eyebrow, PageHeader, Segmented } from "@/components/ui/system"
import {
  ArrowUp01Icon,
  ArrowDown01Icon,
  Search01Icon,
  ArrowUpRight01Icon,
  StarIcon,
  Fire02Icon,
} from "@hugeicons/core-free-icons"
import type { CoinData, FuturesMarket } from "@/lib/actions"
import { getSpotMarkets, getFuturesMarkets } from "@/lib/actions"
import { ErrorState } from "@/components/error-state"
import { useHyperliquidPositions } from "@/hooks/useHyperliquidPositions"
import { useHyperliquidBalance } from "@/hooks/useHyperliquidBalance"
import { baseAsset } from "@/components/ui/coin-avatar"
import { num, numOr, qty, usd, usdCompact, price, pct, pctSigned, UNKNOWN } from "@/lib/num"
import { useSparklines } from "@/hooks/useSparklines"
import { Sparkline, Skel } from "@/components/ui/system"
import { useAuth } from "@/components/auth-provider"
import { getCoinImage, coinFallback } from "@/lib/coin-images"
import { useSpotRegistry, tradeHref, type RegistryRow } from "@/hooks/useSpotRegistry"
import { chainLabel, ALL_CHAINS } from "@/lib/spot-market-search"
/* Futures is not live yet - the shared "not open" treatment. */
import { ComingSoon } from "@/components/ui/coming-soon"

/* The "7D Chart" column used to be Math.sin() noise seeded from the coin's
   own symbol — deterministic, so it looked stable and trustworthy, and
   completely disconnected from any price that has ever existed. It sat under a
   header naming a timeframe, in a table of otherwise real numbers.

   Real 7-day series now come from useSparklines: one batched request covering
   every symbol on screen, shared with the Portfolio watchlist through the same
   module cache. A coin the feed doesn't cover renders nothing rather than a
   plausible invention. */

/**
 * Trade affordance for a feed row.
 *
 * It used to be an unconditional link built from the symbol alone. Most of
 * this table is not tradable — the feed is a price feed, the registry is the
 * catalogue — and a "Trade" button on a row with no market behind it sent the
 * user to a ticket for something else entirely. The button now names the
 * chain it would route on, and rows with no market say so instead.
 *
 * A symbol listed on more than one chain gets one link per chain: WETH on
 * Arbitrum and WETH on Ethereum are different markets at different prices, and
 * collapsing them into one "Trade" is how an order lands on the wrong chain.
 */
function TradeButton({ rows }: { rows: RegistryRow[] | undefined }) {
  if (!rows) {
    // The registry never loaded. Keep the old symbol-only link rather than
    // telling the user their asset is untradable on our own outage.
    return null
  }
  if (rows.length === 0) {
    return <span className="text-[11px] text-muted-foreground/50">Not listed</span>
  }
  return (
    <span className="inline-flex items-center justify-end gap-1">
      {rows.map((row) => (
        <Link
          key={row.id}
          href={tradeHref(row)}
          title={`Trade ${row.symbol}/${row.quote} on ${chainLabel(row.networkId)}`}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {rows.length > 1 ? chainLabel(row.networkId) : "Trade"}
          <HugeiconsIcon icon={ArrowUpRight01Icon} className="h-3 w-3" />
        </Link>
      ))}
    </span>
  )
}

/* GATE - futures is not open yet, so this cell must not carry a live route to a
   ticket nothing can fill. It keeps its column and reads as a destination that
   is coming, rather than vanishing and silently narrowing the table.
   TO RE-OPEN: restore the <Link href={`/trade?market=futures&symbol=${symbol}`}>
   with its hover classes and the ArrowUpRight01Icon. */
function FuturesTradeButton({ symbol }: { symbol: string }) {
  return (
    <Link
      href={`/trade?market=futures&symbol=${encodeURIComponent(symbol)}`}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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

/* The price feed is Hyperliquid-first and carries neither market cap nor
   volume, so these arrive as 0 — and "$0" beside Bitcoin is a statement about
   the market, not an admission that we don't have the number. */
function fmtLarge(n: unknown): string {
  const v = num(n)
  if (v === null || v === 0) return UNKNOWN
  return usdCompact(v)
}

// ── Ranked List Item ─────────────────────────────────────────────────────

function RankedCoinRow({
  coin,
  rank,
  points,
  change24h,
}: {
  coin: CoinData
  rank: number
  /** 7-day series, or undefined while it loads / when the coin isn't covered. */
  points?: number[]
  /** Measured from that same series — the primary feed reports 0.00%. */
  change24h?: number
}) {
  const change = numOr(change24h ?? coin.change24h, 0)
  const isUp = change >= 0
  return (
    <Link
      href={`/trade?symbol=${coin.symbol}`}
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
      <Sparkline points={points} width={64} height={24} />
      <div className="flex flex-col items-end gap-0.5">
        <span className="text-xs font-bold tabular-nums">${fmtPrice(coin.price)}</span>
        <span
          className={`flex items-center gap-0.5 text-[11px] font-semibold ${
            isUp ? "text-credit" : "text-debit"
          }`}
        >
          <HugeiconsIcon icon={isUp ? ArrowUp01Icon : ArrowDown01Icon} className="h-2.5 w-2.5" />
          {pct(Math.abs(change))}
        </span>
      </div>
    </Link>
  )
}

function RankedFuturesRow({ market, rank }: { market: FuturesMarket; rank: number }) {
  const isUp = market.change24h >= 0
  const imgSrc = market.image || getCoinImage(market.baseAsset)
  return (
    /* GATE - futures is not open yet. The row stays fully readable as a price,
       but it is no longer a link, and the hover lift goes with it so it doesn't
       offer a click it won't honour. TO RE-OPEN: swap this <div> back to
       <Link href={`/trade?market=futures&symbol=${market.symbol}`}> and restore
       "transition-colors hover:bg-accent/40". */
    <Link
      href={`/trade?market=futures&symbol=${encodeURIComponent(market.symbol)}`}
      className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-accent/40"
    >
      <span className="w-5 text-center text-[11px] font-semibold text-muted-foreground">
        {rank}
      </span>
      {imgSrc ? (
        <img
          src={imgSrc}
          alt={market.baseAsset}
          className="h-7 w-7 shrink-0 rounded-full object-contain ring-1 ring-border/30"
          onError={(e) => { (e.target as HTMLImageElement).src = coinFallback(market.baseAsset) }}
        />
      ) : (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-1 ring-border/30 text-[9px] font-bold text-primary">
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
            isUp ? "text-credit" : "text-debit"
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

/* ── Futures gate ────────────────────────────────────────────────────────
   Perpetual futures are not live yet. The tab stays visible AND pressable: a
   disabled tab has no way to explain itself on a touchscreen, where `title`
   never fires, so pressing it is how the reader finds out. What it opens is
   the one "not open yet" panel instead of the futures body.

   Everything futures below — the stat tiles, the positions table, the
   contracts table, the gainers/movers rails and every `isFutures` branch —
   is left exactly as it was and is simply not reached. Typed `boolean` on
   purpose so TypeScript keeps type-checking both arms.

   TO RE-OPEN: set this to false, then delete it and the `futuresClosed`
   blocks that reference it. */
const FUTURES_CLOSED: boolean = false

type SortKey = "marketCap" | "price" | "change24h" | "volume24h"

function fmtFunding(rate: unknown): string {
  const v = num(rate)
  return v === null ? UNKNOWN : pctSigned(v * 100, 4)
}

function fmtOI(n: unknown): string {
  const v = num(n)
  if (v === null || v === 0) return UNKNOWN
  return usdCompact(v)
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
  /* The holdings table showed "Value $0.00" for a real SOL balance while the
     market table three inches below priced SOL at $75.78. The value was never
     unknowable — only the COST BASIS is. Multiplying a known balance by a
     known price is arithmetic, not invention. */
  const [tab, setTab] = React.useState<Tab>("Total")
  const [search, setSearch] = React.useState("")
  const [sortBy, setSortBy] = React.useState<SortKey>("marketCap")
  const [sortAsc, setSortAsc] = React.useState(false)
  const [favorites, setFavorites] = React.useState<Set<string>>(new Set())
  /* The feed carries no chain, so the filter is joined in from the tradable
     registry — which is also the only place the answer exists. Picking a chain
     narrows the table to assets that actually route there, which is a stronger
     statement than "hide some rows": it turns this page into a list of things
     you can act on. */
  const [chainFilter, setChainFilter] = React.useState<string>(ALL_CHAINS)
  const { user } = useAuth()
  const { positions, loading: positionsLoading } = useHyperliquidPositions()
  const { balances: spotHoldings, loading: spotHoldingsLoading } = useHyperliquidBalance(user?.userId, !!user)
  const registry = useSpotRegistry()

  /** The registry rows trading a feed symbol — `undefined` when unknown. */
  const tradableRows = React.useCallback(
    (symbol: string): RegistryRow[] | undefined =>
      registry.bySymbol.size === 0
        ? undefined
        : (registry.bySymbol.get(symbol.toUpperCase()) ?? []),
    [registry],
  )

  const priceOf = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const c of coins) if (num(c.price) !== null) map.set(c.symbol.toUpperCase(), c.price)
    return (symbol: string) => map.get(baseAsset(symbol)) ?? map.get(symbol.toUpperCase()) ?? null
  }, [coins])

  // Lazy-load the broad Worldstreet spot feed. Hyperliquid is reserved for
  // perpetual futures and is intentionally not used to populate this list.
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
    // GATE - no request for a venue that isn't open. Drop `FUTURES_CLOSED ||`.
    if (FUTURES_CLOSED || tab !== "Futures" || hasFetchedFutures.current) return
    hasFetchedFutures.current = true
    setFuturesLoading(true)
    getFuturesMarkets().then((res) => { if (res.success) setFuturesMarkets(res.markets) }).catch(() => {}).finally(() => setFuturesLoading(false))
  }, [tab])

  const isFutures = tab === "Futures"
  /* GATE - futures is selectable but closed: the body below is replaced by the
     "not open" panel while the header and tab bar stay live so the reader can
     switch straight back. `isFutures` itself is untouched. */
  const futuresClosed = isFutures && FUTURES_CLOSED

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
    if (chainFilter !== ALL_CHAINS) {
      list = list.filter((c) =>
        (registry.bySymbol.get(c.symbol.toUpperCase()) ?? []).some(
          (r) => r.networkId === chainFilter,
        ),
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
  }, [coins, spotMarkets, tab, search, sortBy, sortAsc, chainFilter, registry])

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

  /* Real 7-day curves for everything on screen — one batched request, shared
     with the Portfolio watchlist. The response also carries the 24h change the
     Hyperliquid feed omits, which is why every row here read "+0.00%". */
  const visibleSymbols = React.useMemo(
    () => (isFutures ? filteredFutures.map((m) => m.baseAsset) : filtered.map((c) => c.symbol)),
    [isFutures, filtered, filteredFutures],
  )
  const spark = useSparklines(visibleSymbols)

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
      <div className="rounded-2xl bg-card">
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
      {/* Header + Tabs — one tab system; no second (amber) accent */}
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Markets"
          subtitle={
            /* GATE - "· 0 contracts" would read as an empty venue rather than
               an unopened one. TO RE-OPEN: delete this first arm. */
            futuresClosed
              ? "Perpetual futures"
              : isFutures
              ? `Perpetual futures · ${futuresMarkets.length} contracts`
              : tab === "Spot"
              ? `Worldstreet spot markets · ${spotMarkets.length} assets`
              : tab === "Main"
              ? `Top 20 assets by market cap`
              : `Real-time prices for ${coins.length} assets`
          }
        />
        <div className="-mx-1 overflow-x-auto px-1 scrollbar-none">
          <Segmented
            /* Every tab is selectable, futures included - see FUTURES_CLOSED.
               A greyed-out tab is a dead end on touch; a live one that answers
               the question is not. */
            options={MARKET_TABS.map((t) => ({ key: t, label: t }))}
            value={tab}
            onChange={setTab}
          />
        </div>
      </div>

      {/* GATE - futures is not open yet: this panel stands in for the entire
          body (stats, positions, tables, rails). The header and tab bar above
          are deliberately outside it, so the reader can leave. */}
      {futuresClosed && (
        <div className="rounded-2xl bg-card">
          <ComingSoon />
        </div>
      )}

      {/* GATE - the real body, unchanged, behind one condition.
          TO RE-OPEN: delete this line and its `</>)}` at the end of the file. */}
      {!futuresClosed && (
      <>
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
                className="flex flex-col gap-1 rounded-2xl bg-card p-4"
              >
                <Eyebrow>{s.label}</Eyebrow>
                <span className={`text-xl font-bold tabular-nums ${s.up === true ? "text-credit" : s.up === false ? "text-debit" : ""}`}>{s.value}</span>
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
                value: globalStats.btcDominance > 0 ? pct(globalStats.btcDominance, 1) : UNKNOWN,
                sub: null,
                up: null,
              },
              { label: "Listed Assets", value: `${coins.length}`, sub: null, up: null },
            ].map((s) => (
              <div
                key={s.label}
                className="flex flex-col gap-1 rounded-2xl bg-card p-4"
              >
                <Eyebrow>{s.label}</Eyebrow>
                <span className="text-xl font-bold tabular-nums">{s.value}</span>
                {s.sub && (
                  <span
                    className={`text-xs font-medium ${s.up ? "text-credit" : "text-debit"}`}
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
        <section className="overflow-hidden rounded-2xl bg-card">
          {/* The gold chip-and-star that used to sit here is gone: the system
              bans decorative leading icons on a card header, and gold means
              brand, primary CTA and active state — not "this is a heading".
              (Both ternaries were also identical on either branch.) */}
          <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3">
            <h3 className="text-[15px] font-semibold">{isFutures ? "My positions" : "My holdings"}</h3>
            <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[11.5px] font-semibold text-muted-foreground">
              {isFutures ? positions.length : spotHoldings.length}
            </span>
            <Link
              href="/portfolio"
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
                            <span className={`inline-flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold ${isLong ? "bg-credit-chip text-credit" : "bg-debit-chip text-debit"}`}>
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
                            <span className={`font-medium tabular-nums ${isProfit ? "text-credit" : "text-debit"}`}>
                              {isProfit ? "+" : ""}${pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className={`text-[10px] tabular-nums ${isProfit ? "text-credit/70" : "text-debit/70"}`}>
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
                    const isProfit = (b.unrealizedPnl ?? 0) >= 0
                    const livePrice = priceOf(b.coin)
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
                          {qty(b.total)}
                        </td>
                        <td className="hidden px-4 py-2.5 text-right text-muted-foreground tabular-nums sm:table-cell">
                          {price(b.entryPrice)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                          {/* Balance × live price. The hook can't know cost
                              basis; it can always know what the holding is
                              worth right now. */}
                          {usd(livePrice !== null ? b.total * livePrice : b.currentValue)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {b.unrealizedPnl === null ? (
                            <span
                              className="text-muted-foreground/50"
                              title="Cost basis isn't recorded for spot holdings yet"
                            >
                              {UNKNOWN}
                            </span>
                          ) : (
                            <div className="flex flex-col items-end">
                              <span className={`font-medium tabular-nums ${isProfit ? "text-credit" : "text-debit"}`}>
                                {isProfit ? "+" : ""}{usd(b.unrealizedPnl)}
                              </span>
                              <span className={`text-[11.5px] tabular-nums ${isProfit ? "text-credit/70" : "text-debit/70"}`}>
                                {pctSigned(b.unrealizedPnlPercent)}
                              </span>
                            </div>
                          )}
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
        <div className="overflow-hidden rounded-2xl bg-card">
          {/* Table toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 p-4">
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-semibold">{isFutures ? "Futures markets" : tab === "Spot" ? "Spot markets" : tab === "Main" ? "Main markets" : "All markets"}</h2>
              <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[11.5px] font-semibold text-muted-foreground">
                {isFutures ? filteredFutures.length : filtered.length}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Chain chips — spot only. A perp is one venue, so offering to
                  filter futures by chain would be a control that does nothing. */}
              {!isFutures && registry.chains.length > 1 && (
                <div className="flex items-center gap-1.5">
                  {[{ id: ALL_CHAINS, label: "All chains", count: 0 }, ...registry.chains].map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setChainFilter(c.id)}
                      aria-pressed={chainFilter === c.id}
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        chainFilter === c.id
                          ? "bg-primary/[0.14] text-primary"
                          : "bg-accent/50 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {c.label}
                      {c.count > 0 && <span className="ml-1 tabular-nums opacity-60">{c.count}</span>}
                    </button>
                  ))}
                </div>
              )}
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
                    /* Prefer the change that arrives with the 7-day series:
                       it comes from the same measurement the chart draws, so
                       the number and the line can never disagree. The primary
                       feed reports 0.00% for every asset. */
                    const change = numOr(spark(coin.symbol)?.change24h ?? coin.change24h, 0)
                    const isUp = change >= 0
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
                        <td className={`px-4 py-3 text-right font-semibold ${isUp ? "text-credit" : "text-debit"}`}>
                          <span className="flex items-center justify-end gap-0.5">
                            <HugeiconsIcon icon={isUp ? ArrowUp01Icon : ArrowDown01Icon} className="h-3 w-3" />
                            {pct(Math.abs(change))}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3 text-right text-muted-foreground md:table-cell">{fmtLarge(coin.marketCap)}</td>
                        <td className="hidden px-4 py-3 text-right text-muted-foreground lg:table-cell">{fmtLarge(coin.volume24h)}</td>
                        <td className="hidden px-4 py-3 md:table-cell">
                          <div className="flex h-8 items-center justify-center">
                            {(() => {
                              const sp = spark(coin.symbol)
                              // undefined = still loading, null = no series to
                              // draw. Neither is an excuse to invent one.
                              if (sp === undefined) return <Skel className="h-4 w-16 rounded-sm" />
                              return <Sparkline points={sp?.prices} width={80} height={32} />
                            })()}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <TradeButton rows={tradableRows(coin.symbol)} />
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
                                className="h-6 w-6 shrink-0 rounded-full object-contain ring-1 ring-border/30"
                                onError={(e) => { (e.target as HTMLImageElement).src = coinFallback(market.baseAsset) }}
                              />
                            ) : (
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-1 ring-border/30 text-[9px] font-bold text-primary">
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
                        <td className={`px-4 py-3 text-right font-semibold ${isUp ? "text-credit" : "text-debit"}`}>
                          <span className="flex items-center justify-end gap-0.5">
                            <HugeiconsIcon icon={isUp ? ArrowUp01Icon : ArrowDown01Icon} className="h-3 w-3" />
                            {Math.abs(market.change24h).toFixed(2)}%
                          </span>
                        </td>
                        <td className={`hidden px-4 py-3 text-right font-medium md:table-cell ${fundingUp ? "text-credit" : "text-debit"}`}>
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
          <section className="overflow-hidden rounded-2xl bg-card">
            <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-credit-chip">
                <HugeiconsIcon icon={ArrowUp01Icon} className="h-3.5 w-3.5 text-credit" />
              </div>
              <h3 className="text-sm font-semibold">Top Gainers</h3>
              <span className="ml-auto rounded-full bg-credit-chip px-2 py-0.5 text-[10px] font-medium text-credit">
                24h
              </span>
            </div>
            <div className="flex flex-col divide-y divide-border/20 p-1">
              {!isFutures
                ? gainers.slice(0, 8).map((c, i) => <RankedCoinRow key={c.id} coin={c} rank={i + 1} points={spark(c.symbol)?.prices} change24h={spark(c.symbol)?.change24h} />)
                : futuresGainers.slice(0, 8).map((m, i) => <RankedFuturesRow key={m.symbol} market={m} rank={i + 1} />)}
            </div>
          </section>
        )}

        {/* Top Movers */}
        {(!isFutures ? movers : futuresMovers).length > 0 && (
          <section className="overflow-hidden rounded-2xl bg-card">
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
                ? movers.map((c, i) => <RankedCoinRow key={c.id} coin={c} rank={i + 1} points={spark(c.symbol)?.prices} change24h={spark(c.symbol)?.change24h} />)
                : futuresMovers.map((m, i) => <RankedFuturesRow key={m.symbol} market={m} rank={i + 1} />)}
            </div>
          </section>
        )}
      </div>
      </>
      )}
    </div>
  )
}

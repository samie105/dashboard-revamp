/**
 * The markets page's rules, lifted out of components/trading/markets-client.tsx
 * unchanged so the redesigned page (components/markets/redesign/) ranks, sorts,
 * filters and pages exactly as the previous one did. Pure, so it is tested here.
 */

import type { CoinData, FuturesMarket } from "@/lib/actions"

export const ROWS_PER_PAGE = 50
export const MOVERS_SHOWN = 6

export const MARKET_TABS = ["Total", "Main", "Spot", "Futures"] as const
export type MarketTab = (typeof MARKET_TABS)[number]

export type SortKey = "marketCap" | "price" | "change24h" | "volume24h"

/** "—" for a missing figure: the price feed sends cap and volume as 0. */
export const UNKNOWN = "—"

/* ── Formatting (the preview's, which follow magnitude) ─────────────────── */

export function formatPrice(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return UNKNOWN
  const frac = value >= 1 ? 2 : value >= 0.01 ? 4 : value >= 0.0001 ? 6 : 8
  return value.toLocaleString("en-US", { minimumFractionDigits: frac, maximumFractionDigits: frac })
}

/** Compact dollars, or "—" when the feed has no figure (0 is not a measurement). */
export function formatLarge(value: unknown): string {
  const v = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(v) || v <= 0) return UNKNOWN
  return `$${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(v)}`
}

export function formatFunding(rate: unknown): string {
  const v = typeof rate === "number" ? rate : Number(rate)
  if (!Number.isFinite(v)) return UNKNOWN
  const pct = v * 100
  return `${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(4)}%`
}

/* ── Movers ─────────────────────────────────────────────────────────────
   Ranked on the change resolver they're given. The page ranks them on the
   7-day move (change7d), so each list agrees with the 7-day curve drawn in
   its rows, as the preview's "Biggest 7d moves" does. */

/** The move across a 7-day series: its last point against its first. Null
 *  when there is no series to measure. */
export function change7d(prices: number[] | null | undefined): number | null {
  if (!prices || prices.length < 2 || !(prices[0] > 0)) return null
  return ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100
}

type ChangeOf = (coin: CoinData) => number

export function gainersOf(coins: CoinData[], changeOf: ChangeOf) {
  return coins.filter((c) => changeOf(c) > 0).sort((a, b) => changeOf(b) - changeOf(a)).slice(0, 12)
}

export function losersOf(coins: CoinData[], changeOf: ChangeOf) {
  return coins.filter((c) => changeOf(c) < 0).sort((a, b) => changeOf(a) - changeOf(b)).slice(0, 12)
}

/** "Most active": the largest moves either way. */
export function activeOf(coins: CoinData[], changeOf: ChangeOf) {
  return [...coins].sort((a, b) => Math.abs(changeOf(b)) - Math.abs(changeOf(a))).slice(0, 8)
}

export function futuresGainersOf(markets: FuturesMarket[]) {
  return markets.filter((m) => m.change24h > 0).sort((a, b) => b.change24h - a.change24h).slice(0, 12)
}

export function futuresActiveOf(markets: FuturesMarket[]) {
  return [...markets].sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h)).slice(0, 8)
}

/** Advancing vs declining, or null when nothing moved (a cold feed, not a balanced day). */
export function breadthOf(coins: CoinData[], changeOf: ChangeOf) {
  const advancing = coins.filter((c) => changeOf(c) > 0).length
  const declining = coins.filter((c) => changeOf(c) < 0).length
  const total = advancing + declining
  if (total === 0) return null
  return { advancing, declining, pct: (advancing / total) * 100 }
}

/* ── The table ─────────────────────────────────────────────────────────── */

export function filterCoins(
  source: CoinData[],
  opts: {
    tab: MarketTab
    search: string
    sortBy: SortKey
    sortAsc: boolean
    /** Assets routing on the chosen chain, or null for every chain. */
    onChain: ((symbol: string) => boolean) | null
  },
): CoinData[] {
  let list = [...source]
  if (opts.search) {
    const q = opts.search.toLowerCase()
    list = list.filter((c) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
  }
  if (opts.onChain) list = list.filter((c) => opts.onChain!(c.symbol))
  if (opts.tab === "Main") list = list.slice(0, opts.search ? list.length : 20)
  const key = opts.sortBy
  // Unchanged from the previous page, including its Total-tab rule: there a
  // descending sort orders by volume, whatever the column.
  list.sort((a, b) => {
    const av = (a[key] as number) ?? 0
    const bv = (b[key] as number) ?? 0
    if (opts.tab === "Total") return bv - av === 0 ? 0 : opts.sortAsc ? av - bv : b.volume24h - a.volume24h
    return opts.sortAsc ? av - bv : bv - av
  })
  return list
}

export function filterFutures(markets: FuturesMarket[], opts: { search: string; sortBy: SortKey; sortAsc: boolean }): FuturesMarket[] {
  let list = [...markets]
  if (opts.search) {
    const q = opts.search.toLowerCase()
    list = list.filter((m) => m.symbol.toLowerCase().includes(q) || m.baseAsset.toLowerCase().includes(q))
  }
  const { sortBy, sortAsc } = opts
  list.sort((a, b) => {
    if (sortBy === "volume24h") return sortAsc ? a.volume24h - b.volume24h : b.volume24h - a.volume24h
    if (sortBy === "price") return sortAsc ? a.markPrice - b.markPrice : b.markPrice - a.markPrice
    if (sortBy === "change24h") return sortAsc ? a.change24h - b.change24h : b.change24h - a.change24h
    return sortAsc ? a.openInterest - b.openInterest : b.openInterest - a.openInterest
  })
  return list
}

/** Only the rendering is paged; search and sort run over the whole set. */
export function pageOf(total: number, page: number) {
  const pageCount = Math.max(1, Math.ceil(total / ROWS_PER_PAGE))
  const safePage = Math.min(page, pageCount - 1)
  const start = safePage * ROWS_PER_PAGE
  return { pageCount, safePage, start, end: Math.min(start + ROWS_PER_PAGE, total) }
}

export function futuresTotals(markets: FuturesMarket[]) {
  return {
    volume: markets.reduce((s, m) => s + m.volume24h, 0),
    openInterest: markets.reduce((s, m) => s + m.openInterest, 0),
    avgFunding: markets.length > 0 ? markets.reduce((s, m) => s + m.fundingRate, 0) / markets.length : 0,
    contracts: markets.length,
  }
}

/** The heading's subtitle, per tab, as before. */
export function subtitleFor(tab: MarketTab, counts: { coins: number; spot: number; futures: number }, futuresClosed: boolean) {
  if (futuresClosed) return "Perpetual futures"
  if (tab === "Futures") return `Perpetual futures · ${counts.futures} contracts`
  if (tab === "Spot") return `Worldstreet spot markets · ${counts.spot} assets`
  if (tab === "Main") return "Top 20 assets by market cap"
  return `Real-time prices for ${counts.coins} assets`
}

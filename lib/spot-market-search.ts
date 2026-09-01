/**
 * Ranked search + chain filtering over the tradable market registry.
 *
 * Both places you can pick a pair — the workspace rail and the header
 * dropdown — used to carry their own copy of
 *
 *     list.filter((m) => m.symbol.toLowerCase().includes(q))
 *
 * which is why searching felt terrible. A substring test over the symbol has
 * no notion of "better": typing `btc` put BTC somewhere in the middle of
 * WBTC, TBTC and BTCB in registry order, and typing `eth` returned nine rows
 * that were all called ETH because the registry lists the same symbol once per
 * network. The one field that separates those nine rows — `networkId` — was
 * rendered as a badge and was not searchable, not filterable, and not part of
 * the ordering.
 *
 * This module is the single ranked index the pickers share. It matches on the
 * symbol, the `SYMBOL/QUOTE` pair, the network, and the token addresses (paste
 * a mint, land on the market), scores those matches by kind rather than by
 * position, and takes a chain filter so nine ETH rows can become the one the
 * user meant.
 */

import { marketRowKey, type HlSpotMarket, type HlFuturesMarket } from "@/lib/crypto-api"
import { networkMetaFor } from "@/lib/crypto-backend/network-meta"

export type AnyMarket = HlSpotMarket | HlFuturesMarket

/** Every chain filter selects one network; `all` is the absence of a filter. */
export const ALL_CHAINS = "all"

export function networkIdOf(m: AnyMarket): string | null {
  return "networkId" in m && m.networkId ? m.networkId : null
}

/** The human name for a network id, falling back to the raw id. */
export function chainLabel(networkId: string): string {
  return networkMetaFor(networkId)?.label ?? networkId
}

export function quoteOf(m: AnyMarket): string {
  return "quote" in m && m.quote ? String(m.quote).toUpperCase() : "USDC"
}

/**
 * The chains the CURRENT list actually contains, in registry order.
 *
 * Derived rather than hardcoded: the backend decides which venues it routes,
 * and a filter chip for a chain with no markets behind it is a dead end that
 * only ever renders "no markets match".
 */
export function chainOptionsFor(list: readonly AnyMarket[]): { id: string; label: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const m of list) {
    const id = networkIdOf(m)
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return [...counts].map(([id, count]) => ({ id, label: chainLabel(id), count }))
}

/** The addresses a row can be reached by — pasting one is an exact match. */
function addressesOf(m: AnyMarket): string[] {
  const out: string[] = []
  for (const key of ["sellToken", "buyToken", "inputMint", "outputMint"] as const) {
    const v = (m as HlSpotMarket)[key]
    if (typeof v === "string" && v) out.push(v.toLowerCase())
  }
  return out
}

type Indexed = {
  market: AnyMarket
  key: string
  /** Registry position — the backend's own ordering, used as the tie-break. */
  order: number
  symbol: string
  pair: string
  networkId: string | null
  chain: string
  addresses: string[]
}

/**
 * Build the searchable index once per list. Lowercasing 400 rows on every
 * keystroke is the kind of thing that makes a search field feel laggy on a
 * phone; the index is memoised by the caller and the keystroke only scores.
 */
export function buildSpotIndex(list: readonly AnyMarket[]): Indexed[] {
  return list.map((m, order) => {
    const symbol = m.symbol.toLowerCase()
    const networkId = networkIdOf(m)
    return {
      market: m,
      key: marketRowKey(m),
      order,
      symbol,
      pair: `${symbol}/${quoteOf(m).toLowerCase()}`,
      networkId,
      chain: networkId ? chainLabel(networkId).toLowerCase() : "",
      addresses: addressesOf(m),
    }
  })
}

/**
 * Score one row against a lowercased query. `null` means "no match" — distinct
 * from a zero score, which a match on the weakest tier would produce.
 *
 * The tiers are ordered by how confident the match is that this is the row the
 * user is reaching for, not by where in the string the hit landed. An exact
 * symbol always outranks a row that merely contains it, which is the whole
 * reason BTC now sits above WBTC.
 */
function score(row: Indexed, q: string): number | null {
  if (row.addresses.includes(q)) return 120
  if (row.symbol === q) return 100
  if (row.pair === q) return 100
  if (row.symbol.startsWith(q)) return 90
  if (row.pair.startsWith(q)) return 80
  if (row.symbol.includes(q)) return 70
  // Chain matches sit below every symbol match: typing "sol" means SOL the
  // asset far more often than Solana the network, and burying SOL under every
  // Solana market would be its own kind of broken.
  if (row.chain && row.chain.startsWith(q)) return 40
  if (row.chain && row.chain.includes(q)) return 30
  return null
}

export type SearchOptions = {
  /** Free-text query. Empty means "no query" — the list is returned as-is. */
  query?: string
  /** A network id, or `ALL_CHAINS`. */
  chain?: string
  /** Row keys the user pinned; they float to the top within their score tier. */
  favorites?: ReadonlySet<string>
}

/**
 * Filter + rank. Returns the matching markets in the order they should render.
 *
 * With no query and no chain filter this is the identity — the registry's own
 * ordering is meaningful (it leads with the liquid majors) and re-sorting it
 * alphabetically, as an eager search box would, is strictly worse.
 */
export function searchSpotMarkets(index: readonly Indexed[], options: SearchOptions = {}): AnyMarket[] {
  const chain = options.chain ?? ALL_CHAINS
  const q = (options.query ?? "").trim().toLowerCase()
  const favorites = options.favorites

  const scoped = chain === ALL_CHAINS ? index : index.filter((r) => r.networkId === chain)

  if (!q) {
    if (!favorites?.size) return scoped.map((r) => r.market)
    // No query: pinned rows lead, everything else keeps registry order.
    return [...scoped]
      .sort((a, b) => favRank(a, favorites) - favRank(b, favorites) || a.order - b.order)
      .map((r) => r.market)
  }

  const hits: { row: Indexed; s: number }[] = []
  for (const row of scoped) {
    const s = score(row, q)
    if (s !== null) hits.push({ row, s })
  }
  hits.sort(
    (a, b) =>
      b.s - a.s ||
      favRank(a.row, favorites) - favRank(b.row, favorites) ||
      a.row.order - b.row.order,
  )
  return hits.map((h) => h.row.market)
}

function favRank(row: Indexed, favorites?: ReadonlySet<string>): number {
  return favorites?.has(row.key) ? 0 : 1
}

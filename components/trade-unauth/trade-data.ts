/**
 * Dummy data for the trading redesign preview (/trade-unauth).
 *
 * Built ON TOP of the markets preview's data rather than beside it: the pair
 * list, prices and 7-day series are imported from market-data.ts, so a coin
 * costs the same on both screens. The live product does not manage this — its
 * trade header prints SOL at $98.33 while its own market list, on the same
 * screen, prints $103.83, and a card underneath explains the 5.30% gap
 * instead of resolving it.
 *
 * Everything here is deterministic: seeded generators, fixed clock strings, no
 * Date.now() at render. Candles, the book and the tape all derive from the
 * pair's price, so they cannot drift apart from each other.
 */

import { MARKETS, formatPrice, formatCompact, type Market } from "@/components/markets-unauth/market-data"

export { formatPrice, formatCompact }
export type { Market }

/* ── Seeded helpers ─────────────────────────────────────────────────────── */

function hash(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ── The tradable universe ──────────────────────────────────────────────── */

/**
 * One entry per pair. The live Pro market list shows SOL twice — once under
 * RECENT and again in the body, at two different prices — so this is keyed by
 * id and deduplicated at source.
 */
export const PAIRS: Market[] = [...new Map(MARKETS.map((m) => [m.id, m])).values()]

export const DEFAULT_PAIR = PAIRS.find((p) => p.id === "SOL-USDT") ?? PAIRS[0]

export function pairById(id: string): Market {
  return PAIRS.find((p) => p.id === id) ?? DEFAULT_PAIR
}

/** Which chain a pair settles on — shown in the header and the route summary. */
export function venueOf(m: Market): string {
  return m.chains[0] ?? "Ethereum"
}

/* ── Candles ────────────────────────────────────────────────────────────── */

export type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1d"

/**
 * Each timeframe carries the NUMBER of candles it shows and the window that
 * spans, because the header's change figure is computed from exactly those
 * candles. Quoting a 7-day move above a chart of the last six hours is the
 * live screen's mistake in a different costume — there, a green area chart
 * sits under a red percentage because the two read different periods.
 */
/**
 * Counts are capped near 90. A candle needs a few pixels of body to be a
 * candle at all — 168 of them in a 420px column is a wall of hair, not a
 * chart — so each timeframe shows a window it can draw legibly rather than
 * the longest one it could technically cover.
 */
export const TIMEFRAMES: { key: Timeframe; label: string; count: number; window: string }[] = [
  { key: "1m", label: "1m", count: 60, window: "1h" },
  { key: "5m", label: "5m", count: 72, window: "6h" },
  { key: "15m", label: "15m", count: 48, window: "12h" },
  { key: "1h", label: "1h", count: 72, window: "3d" },
  { key: "4h", label: "4h", count: 84, window: "14d" },
  { key: "1d", label: "1D", count: 90, window: "90d" },
]

export function timeframe(tf: Timeframe) {
  return TIMEFRAMES.find((t) => t.key === tf) ?? TIMEFRAMES[2]
}

/**
 * Simple mode speaks in ranges, not candle intervals — and it draws an AREA
 * chart, where a dense series is a smooth line rather than a thicket, so it
 * can afford far more points than the Pro candles can.
 */
export const SIMPLE_RANGES: { key: Timeframe; label: string; count: number; window: string }[] = [
  { key: "15m", label: "1D", count: 96, window: "24h" },
  { key: "1h", label: "1W", count: 168, window: "7d" },
  { key: "4h", label: "1M", count: 180, window: "30d" },
]

export function simpleRange(tf: Timeframe) {
  return SIMPLE_RANGES.find((r) => r.key === tf) ?? SIMPLE_RANGES[0]
}

export type Candle = { o: number; h: number; l: number; c: number; v: number }

/**
 * Candles for a pair and timeframe. The LAST close is always the pair's
 * current price, so the chart, the header figure and the ticket all quote the
 * same number — which is the thing the live screen gets wrong.
 */
export function candlesFor(m: Market, tf: Timeframe, countOverride?: number): Candle[] {
  const count = countOverride ?? timeframe(tf).count
  const rand = mulberry32(hash(`${m.id}:${tf}`))
  const tfIndex = TIMEFRAMES.findIndex((t) => t.key === tf)
  // Longer timeframes span more ground, so they get a wider range.
  const vol = 0.0035 * (1 + tfIndex * 0.85)
  const out: Candle[] = []

  // Walk BACKWARDS from the current price, then reverse: that is what pins
  // the final close to the quoted price exactly.
  let close = m.price
  for (let i = 0; i < count; i++) {
    const drift = (rand() - 0.48) * vol * close
    const open = close - drift
    const wick = vol * close * (0.35 + rand() * 0.9)
    const high = Math.max(open, close) + wick * rand()
    const low = Math.min(open, close) - wick * rand()
    out.push({
      o: open,
      h: high,
      l: low,
      c: close,
      v: (0.4 + rand()) * (m.volumeUsd / count / 24),
    })
    close = open
  }
  return out.reverse()
}

/** The move across exactly the candles on screen, so the figure in the header
 *  and the direction of the chart can never disagree. */
export function changeOver(candles: Candle[]): number {
  if (candles.length < 2) return 0
  const first = candles[0].o
  return first === 0 ? 0 : ((candles[candles.length - 1].c - first) / first) * 100
}

/* ── Order book ─────────────────────────────────────────────────────────────
   The single biggest omission on the live Pro screen: there is no ladder, so
   "Pro" adds information but no view of liquidity. */

export type Level = { price: number; size: number; total: number }

export type Book = { bids: Level[]; asks: Level[]; spread: number; spreadPct: number }

export function bookFor(m: Market, levels = 12): Book {
  const rand = mulberry32(hash(`book:${m.id}`))
  // Tick size follows price magnitude, the way a real book does.
  const tick = m.price >= 1000 ? 0.5 : m.price >= 100 ? 0.01 : m.price >= 1 ? 0.001 : m.price * 0.0004
  const spread = tick * (1 + Math.floor(rand() * 3))

  const build = (dir: -1 | 1): Level[] => {
    const out: Level[] = []
    let total = 0
    for (let i = 0; i < levels; i++) {
      const price = m.price + dir * (spread / 2 + tick * i * (1 + rand() * 0.4))
      // Size grows with distance — depth thickens away from the touch.
      const size = (0.4 + rand() * 1.6) * (1 + i * 0.35) * (m.price >= 1000 ? 0.4 : 40)
      total += size
      out.push({ price, size, total })
    }
    return out
  }

  return {
    bids: build(-1),
    asks: build(1),
    spread,
    spreadPct: (spread / m.price) * 100,
  }
}

/* ── Recent trades tape ─────────────────────────────────────────────────── */

export type Fill = { id: string; price: number; size: number; side: "buy" | "sell"; time: string }

export function tapeFor(m: Market, count = 18): Fill[] {
  const rand = mulberry32(hash(`tape:${m.id}`))
  const tick = m.price >= 1000 ? 0.5 : m.price >= 1 ? 0.01 : m.price * 0.0005
  return Array.from({ length: count }, (_, i) => {
    const side = rand() > 0.48 ? "buy" : "sell"
    // Clock strings are literal — no Date at render, so SSR stays stable.
    const mm = 42 - Math.floor(i * 1.7)
    const ss = Math.floor(rand() * 60)
    return {
      id: `${m.id}-t${i}`,
      price: m.price + (rand() - 0.5) * tick * 6,
      size: (0.2 + rand() * 2.4) * (m.price >= 1000 ? 0.05 : 12),
      side: side as "buy" | "sell",
      time: `${String(Math.max(0, 19 + Math.floor(mm / 60))).padStart(2, "0")}:${String(((mm % 60) + 60) % 60).padStart(2, "0")}:${String(ss).padStart(2, "0")}`,
    }
  })
}

/* ── Your balances ──────────────────────────────────────────────────────────
   Read from the wallet preview's numbers where the asset exists there, so the
   two screens agree about how much you hold. */

const WALLET: Record<string, number> = {
  BTC: 0.1842,
  ETH: 3.417,
  SOL: 38.204,
  USDT: 5120,
  USDC: 1023.44,
  TON: 612.35,
  TRX: 9840.11,
  ARB: 1180,
}

export function balanceOf(symbol: string): number {
  return WALLET[symbol] ?? 0
}

/* ── Orders ─────────────────────────────────────────────────────────────────
   The live screen's "Your orders" shows Filled only — there is nothing to
   cancel, which is the other half of why Pro mode is not yet Pro. */

export type OrderStatus = "open" | "filled" | "cancelled"
export type OrderType = "market" | "limit" | "stop"

export type Order = {
  id: string
  pairId: string
  side: "buy" | "sell"
  type: OrderType
  status: OrderStatus
  price: number
  amount: number
  filledPct: number
  /** Literal date + clock text; never derived from a Date at render. */
  date: string
  time: string
  route: string
}

export const ORDERS: Order[] = [
  { id: "o1", pairId: "SOL-USDT", side: "buy", type: "limit", status: "open", price: 168.4, amount: 12, filledPct: 35, date: "Sep 16", time: "01:12", route: "Jupiter" },
  { id: "o2", pairId: "ETH-USDT", side: "sell", type: "stop", status: "open", price: 3050, amount: 1.2, filledPct: 0, date: "Sep 16", time: "00:48", route: "LI.FI" },
  { id: "o3", pairId: "BTC-USDT", side: "buy", type: "limit", status: "open", price: 92000, amount: 0.05, filledPct: 0, date: "Sep 15", time: "22:31", route: "LI.FI" },
  { id: "o4", pairId: "TON-USDT", side: "sell", type: "stop", status: "open", price: 4.9, amount: 200, filledPct: 0, date: "Sep 15", time: "19:05", route: "Ston.fi" },
  { id: "o5", pairId: "SOL-USDT", side: "buy", type: "market", status: "filled", price: 182.55, amount: 6.4, filledPct: 100, date: "Sep 16", time: "01:37", route: "Jupiter" },
  { id: "o6", pairId: "ETH-USDT", side: "buy", type: "market", status: "filled", price: 3284.12, amount: 0.42, filledPct: 100, date: "Sep 16", time: "01:37", route: "LI.FI" },
  { id: "o7", pairId: "ARB-USDT", side: "buy", type: "limit", status: "filled", price: 0.372, amount: 1180, filledPct: 100, date: "Sep 15", time: "23:12", route: "Camelot" },
  { id: "o8", pairId: "BTC-USDT", side: "sell", type: "limit", status: "filled", price: 96420.5, amount: 0.012, filledPct: 100, date: "Sep 15", time: "14:04", route: "LI.FI" },
  { id: "o9", pairId: "TON-USDT", side: "buy", type: "market", status: "filled", price: 5.38, amount: 150, filledPct: 100, date: "Sep 14", time: "20:45", route: "Ston.fi" },
  { id: "o10", pairId: "SOL-USDT", side: "sell", type: "limit", status: "cancelled", price: 195.0, amount: 8, filledPct: 0, date: "Sep 14", time: "11:22", route: "Jupiter" },
  { id: "o11", pairId: "LINK-USDT", side: "buy", type: "limit", status: "cancelled", price: 17.4, amount: 40, filledPct: 0, date: "Sep 13", time: "16:58", route: "LI.FI" },
]

/* ── Ticket maths ───────────────────────────────────────────────────────────
   The right rail on the live screen is ~40% empty below the wallet balances.
   What belongs in that space is the answer to "what exactly am I about to
   do" — so these are the numbers that fill it. */

export const FEE_RATE = 0.001 // 0.10% taker

export type Quote = {
  /** Quote-currency spent (buy) or received (sell), before fees. */
  gross: number
  fee: number
  net: number
  /** Base-currency amount that changes hands. */
  baseAmount: number
  /** How far the fill walks the book, in percent. */
  impactPct: number
  /** Worst price accepted at the chosen slippage. */
  worstPrice: number
}

export function quoteFor({
  market,
  book,
  side,
  quoteAmount,
  limitPrice,
  slippagePct,
}: {
  market: Market
  book: Book
  side: "buy" | "sell"
  /** Always denominated in the QUOTE currency, which is what the input takes. */
  quoteAmount: number
  limitPrice?: number
  slippagePct: number
}): Quote {
  const levels = side === "buy" ? book.asks : book.bids
  const price = limitPrice ?? market.price

  let remaining = quoteAmount
  let baseAmount = 0
  let lastPrice = price
  for (const l of levels) {
    const levelQuote = l.size * l.price
    const take = Math.min(remaining, levelQuote)
    if (take <= 0) break
    baseAmount += take / l.price
    lastPrice = l.price
    remaining -= take
    if (remaining <= 0) break
  }
  // Anything the visible book cannot absorb fills at the last level's price.
  if (remaining > 0 && lastPrice > 0) baseAmount += remaining / lastPrice

  const fee = quoteAmount * FEE_RATE
  const impactPct = price > 0 ? Math.abs((lastPrice - price) / price) * 100 : 0

  return {
    gross: quoteAmount,
    fee,
    net: side === "buy" ? quoteAmount + fee : quoteAmount - fee,
    baseAmount,
    impactPct,
    worstPrice: side === "buy" ? price * (1 + slippagePct / 100) : price * (1 - slippagePct / 100),
  }
}

export const SLIPPAGE_OPTIONS = [0.1, 0.5, 1, 3]

/**
 * Dummy data for the unauthenticated dashboard preview (/dashboard-unauth).
 *
 * Everything here is FIXED or derived from a seeded generator — never
 * Math.random() and never Date.now(). This page renders on the server and
 * hydrates on the client, so a value that differs between the two paints a
 * hydration mismatch. Anything genuinely time-dependent (the greeting, axis
 * dates, relative timestamps) is resolved after mount by the components.
 *
 * No API, no wallet, no session: this module is the whole backend.
 */

import { mulberry32 } from "@/components/preview/seeded"

/* ── Seeded series ────────────────────────────────────────────────────────
   A random walk with drift and a couple of slow swells, so the curve has the
   rhythm of a real portfolio instead of white noise. Same seed → same curve
   on every render, every machine, server and browser alike. */

/** Every range carries the SAME number of points, so the chart can morph one
 *  path into the next when the range changes instead of cutting between them. */
export const SERIES_POINTS = 72

function walk(seed: number, n: number, end: number, driftPct: number, volPct: number): number[] {
  const rand = mulberry32(seed)
  const start = end / (1 + driftPct / 100)
  const phase = rand() * Math.PI * 2
  const out: number[] = []
  let noise = 0
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const base = start + (end - start) * t
    // Smoothed noise (AR(1)) plus two slow swells — trends, pullbacks, a peak.
    noise = noise * 0.82 + (rand() - 0.5) * 0.9
    const swell = Math.sin(t * Math.PI * 2.2 + phase) * 0.55 + Math.sin(t * Math.PI * 5.1 + phase * 1.7) * 0.25
    // Tapers to zero at the right edge so the series lands exactly on `end` —
    // the curve and the headline figure have to agree.
    const taper = 1 - Math.pow(t, 6)
    out.push(base * (1 + ((noise + swell) * volPct * taper) / 100))
  }
  out[n - 1] = end
  return out
}

/* ── Formatters ─────────────────────────────────────────────────────────── */

export function formatUSD(value: number, opts?: { compact?: boolean; maxFrac?: number }): string {
  const max = opts?.maxFrac ?? (opts?.compact ? 1 : 2)
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: opts?.compact ? "compact" : "standard",
    // Intl throws when the minimum exceeds the maximum — clamp instead.
    minimumFractionDigits: Math.min(opts?.compact ? 0 : 2, max),
    maximumFractionDigits: max,
  }).format(value)
}

/** Prices span 96,420.50 → 0.000042, so the precision has to follow the size. */
export function formatPrice(value: number): string {
  const frac = value >= 1 ? 2 : value >= 0.01 ? 4 : 6
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: frac, maximumFractionDigits: frac })}`
}

/** Loose coin quantities — the wallet preview imports this one. */
export function formatAmount(value: number): string {
  const frac = value >= 1000 ? 2 : value >= 1 ? 4 : 6
  return value.toLocaleString("en-US", { maximumFractionDigits: frac })
}

/** Coin quantities for the holdings table. Fractions of a coin get the full
 *  8 places an exchange ledger shows; whole-coin amounts drop to 4 and four-
 *  figure ones to 2, or "5,120.00000000" runs into the next column. */
export function formatQty(value: number): string {
  if (value === 0) return "0.00"
  const frac = value >= 1000 ? 2 : value >= 1 ? 4 : 8
  return value.toLocaleString("en-US", { minimumFractionDigits: frac, maximumFractionDigits: frac })
}

export function formatPct(value: number, digits = 2): string {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(digits)}%`
}

/* ── Identity ───────────────────────────────────────────────────────────── */

export const DEMO_USER = { first: "Raphael", full: "Raphael Tomiwa", initial: "R", uid: "30197536" }

/* ── Portfolio ──────────────────────────────────────────────────────────── */

export const PORTFOLIO_TOTAL = 48215.62
export const BTC_PRICE = 96420.5
export const PORTFOLIO_BTC = PORTFOLIO_TOTAL / BTC_PRICE

export type RangeKey = "1h" | "1d" | "1w" | "1m" | "1y" | "all"

export type Range = {
  key: RangeKey
  label: string
  /** Window length in minutes — drives the axis labels on the client. */
  minutes: number
  /** How the axis names a tick inside this window. */
  tick: "time" | "day" | "month" | "year"
  points: number[]
  changePct: number
  changeUsd: number
}

function range(
  key: RangeKey,
  label: string,
  minutes: number,
  tick: Range["tick"],
  seed: number,
  driftPct: number,
  volPct: number,
): Range {
  const points = walk(seed, SERIES_POINTS, PORTFOLIO_TOTAL, driftPct, volPct)
  const first = points[0]
  return {
    key,
    label,
    minutes,
    tick,
    points,
    changePct: ((PORTFOLIO_TOTAL - first) / first) * 100,
    changeUsd: PORTFOLIO_TOTAL - first,
  }
}

const DAY = 1440

export const RANGES: Range[] = [
  range("1h", "1H", 60, "time", 71, 0.32, 0.12),
  range("1d", "1D", DAY, "time", 1337, 2.74, 0.55),
  range("1w", "1W", 7 * DAY, "day", 4242, 4.9, 1.2),
  range("1m", "1M", 30 * DAY, "day", 90210, 12.6, 2.6),
  range("1y", "1Y", 365 * DAY, "month", 2024, 64.2, 7.5),
  range("all", "ALL", 3 * 365 * DAY, "year", 777, 212.4, 14),
]

/** The 24h move is the headline everywhere a single "today" figure is shown. */
export const DAY_RANGE = RANGES[1]

/* ── Balances — the four places money sits ──────────────────────────────── */

export const SPOT_BALANCE = 31480.19
export const FUTURES_BALANCE = 12960.08
export const IN_ORDERS = 3576.07
export const AVAILABLE = SPOT_BALANCE - IN_ORDERS

/* ── Holdings ───────────────────────────────────────────────────────────── */

export type Holding = {
  symbol: string
  name: string
  amount: number
  inOrder: number
  price: number
  changePct: number
}

export const HOLDINGS: Holding[] = [
  { symbol: "BTC", name: "Bitcoin", amount: 0.1842, inOrder: 0.012, price: 96420.5, changePct: 1.84 },
  { symbol: "ETH", name: "Ethereum", amount: 3.417, inOrder: 0.4, price: 3284.12, changePct: 3.46 },
  { symbol: "USDT", name: "Tether", amount: 5120, inOrder: 1250, price: 1, changePct: 0.01 },
  { symbol: "SOL", name: "Solana", amount: 38.204, inOrder: 0, price: 182.55, changePct: -1.27 },
  { symbol: "TON", name: "Toncoin", amount: 612.35, inOrder: 0, price: 5.38, changePct: 5.92 },
  { symbol: "TRX", name: "TRON", amount: 9840.11, inOrder: 0, price: 0.242, changePct: -0.63 },
  { symbol: "USDC", name: "USD Coin", amount: 1023.44, inOrder: 0, price: 1, changePct: -0.02 },
  { symbol: "ARB", name: "Arbitrum", amount: 1180, inOrder: 0, price: 0.372, changePct: 8.13 },
  { symbol: "DOGE", name: "Dogecoin", amount: 42.6, inOrder: 0, price: 0.1642, changePct: -6.41 },
]

export const holdingValue = (h: Holding) => h.amount * h.price
export const HOLDINGS_TOTAL = HOLDINGS.reduce((sum, h) => sum + holdingValue(h), 0)

/* ── Markets ────────────────────────────────────────────────────────────── */

export type Mover = { symbol: string; name: string; price: number; changePct: number }

export const GAINERS: Mover[] = [
  { symbol: "ARB", name: "Arbitrum", price: 0.372, changePct: 8.13 },
  { symbol: "TON", name: "Toncoin", price: 5.38, changePct: 5.92 },
  { symbol: "SUI", name: "Sui", price: 3.14, changePct: 5.05 },
  { symbol: "ETH", name: "Ethereum", price: 3284.12, changePct: 3.46 },
  { symbol: "BTC", name: "Bitcoin", price: 96420.5, changePct: 1.84 },
]

export const LOSERS: Mover[] = [
  { symbol: "DOGE", name: "Dogecoin", price: 0.1642, changePct: -6.41 },
  { symbol: "APT", name: "Aptos", price: 8.22, changePct: -4.77 },
  { symbol: "LINK", name: "Chainlink", price: 18.94, changePct: -3.12 },
  { symbol: "DOT", name: "Polkadot", price: 6.41, changePct: -2.64 },
  { symbol: "SOL", name: "Solana", price: 182.55, changePct: -1.27 },
]

export const NEW_LISTINGS: Mover[] = [
  { symbol: "WSK", name: "WorldStreet", price: 0.0842, changePct: 24.6 },
  { symbol: "NEAR", name: "NEAR Protocol", price: 6.92, changePct: 11.4 },
  { symbol: "ATOM", name: "Cosmos", price: 9.18, changePct: -2.3 },
  { symbol: "UNI", name: "Uniswap", price: 12.47, changePct: 4.08 },
  { symbol: "LTC", name: "Litecoin", price: 104.3, changePct: 0.86 },
]

/* ── Open positions (perps) ─────────────────────────────────────────────── */

export type Position = {
  symbol: string
  side: "long" | "short"
  leverage: number
  size: number
  entry: number
  mark: number
  pnl: number
  pnlPct: number
}

export const POSITIONS: Position[] = [
  { symbol: "BTC", side: "long", leverage: 10, size: 9642.05, entry: 92180, mark: 96420.5, pnl: 443.52, pnlPct: 4.6 },
  { symbol: "ETH", side: "long", leverage: 5, size: 4926.18, entry: 3198.4, mark: 3284.12, pnl: 132.04, pnlPct: 2.68 },
  { symbol: "SOL", side: "short", leverage: 3, size: 2738.25, entry: 178.9, mark: 182.55, pnl: -55.85, pnlPct: -2.04 },
]

/* ── Activity ───────────────────────────────────────────────────────────── */

export type Activity = {
  id: string
  kind: "receive" | "send" | "swap" | "buy"
  title: string
  detail: string
  symbol: string
  amount: string
  usd: string
  direction: "credit" | "debit" | "neutral"
  /** Minutes ago — rendered as "3h ago" on the client so SSR stays stable. */
  minutesAgo: number
}

export const ACTIVITY: Activity[] = [
  { id: "a1", kind: "receive", title: "Received USDT", detail: "TRON · TRC-20", symbol: "USDT", amount: "+1,200.00 USDT", usd: "$1,200.00", direction: "credit", minutesAgo: 24 },
  { id: "a2", kind: "swap", title: "Swapped ETH → SOL", detail: "Arbitrum One", symbol: "ETH", amount: "1.40 ETH", usd: "$4,597.77", direction: "neutral", minutesAgo: 186 },
  { id: "a3", kind: "send", title: "Sent BTC", detail: "Bitcoin", symbol: "BTC", amount: "−0.0120 BTC", usd: "$1,157.05", direction: "debit", minutesAgo: 640 },
  { id: "a4", kind: "buy", title: "Bought TON", detail: "Card · Visa ••42", symbol: "TON", amount: "+150.00 TON", usd: "$807.00", direction: "credit", minutesAgo: 1420 },
  { id: "a5", kind: "receive", title: "Received ETH", detail: "Arbitrum One", symbol: "ETH", amount: "+0.4200 ETH", usd: "$1,379.33", direction: "credit", minutesAgo: 4320 },
]

/* ── Sentiment ──────────────────────────────────────────────────────────── */

/** Fear & Greed, 0–100. */
export const MARKET_MOOD = { score: 63, label: "Greed", yesterday: 58, lastWeek: 47 }

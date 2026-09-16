/**
 * Dummy data for the unauthenticated dashboard preview (/dashboard-unauth).
 *
 * Everything here is FIXED or derived from a seeded generator — never
 * Math.random() and never Date.now(). This page renders on the server and
 * hydrates on the client, so a value that differs between the two paints a
 * hydration mismatch. Anything genuinely time-dependent (the greeting, the
 * date line, relative timestamps) is resolved after mount by the components.
 *
 * No API, no wallet, no session: this module is the whole backend.
 */

/* ── Seeded series ────────────────────────────────────────────────────────
   A mulberry32 PRNG walked as a random walk with drift. Same seed → same
   curve on every render, every machine, server and browser alike. */

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

/** A walk of `n` points landing exactly on `end`, having drifted `driftPct`. */
function walk(seed: number, n: number, end: number, driftPct: number, volPct: number): number[] {
  const rand = mulberry32(seed)
  const start = end / (1 + driftPct / 100)
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const base = start + (end - start) * t
    // Noise tapers to zero at the right edge so the series lands on `end` —
    // the curve and the headline figure have to agree.
    const noise = (rand() - 0.5) * 2 * (volPct / 100) * base * (1 - t)
    out.push(Number((base + noise).toFixed(6)))
  }
  out[out.length - 1] = end
  return out
}

/* ── Formatters ─────────────────────────────────────────────────────────── */

export function formatUSD(value: number, opts?: { compact?: boolean; maxFrac?: number }): string {
  const max = opts?.maxFrac ?? (opts?.compact ? 1 : 2)
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: opts?.compact ? "compact" : "standard",
    // Intl throws a RangeError when the minimum exceeds the maximum, which is
    // exactly what `{ maxFrac: 0 }` on a standard-notation figure does if the
    // minimum is hard-coded to 2. Clamp instead.
    minimumFractionDigits: Math.min(opts?.compact ? 0 : 2, max),
    maximumFractionDigits: max,
  }).format(value)
}

/** Prices span 96,420.50 → 0.000042, so the precision has to follow the size. */
export function formatPrice(value: number): string {
  const frac = value >= 1000 ? 2 : value >= 1 ? 2 : value >= 0.01 ? 4 : 6
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: frac, maximumFractionDigits: frac })}`
}

export function formatAmount(value: number): string {
  const frac = value >= 1000 ? 2 : value >= 1 ? 4 : 6
  return value.toLocaleString("en-US", { maximumFractionDigits: frac })
}

/* ── Portfolio ──────────────────────────────────────────────────────────── */

export const PORTFOLIO_TOTAL = 48215.62
export const PORTFOLIO_DAY_PNL = 1284.35
export const PORTFOLIO_DAY_PCT = 2.74

export type RangeKey = "7d" | "30d" | "90d"

export const RANGES: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "90d", label: "90D" },
]

export const RANGE_DAYS: Record<RangeKey, number> = { "7d": 7, "30d": 30, "90d": 90 }

/** Performance series per range: the curve, plus the move over the window. */
export const PERFORMANCE: Record<RangeKey, { points: number[]; changePct: number; changeUsd: number }> = {
  "7d": { points: walk(1337, 42, PORTFOLIO_TOTAL, 4.9, 1.1), changePct: 4.9, changeUsd: 2251.4 },
  "30d": { points: walk(4242, 60, PORTFOLIO_TOTAL, 12.6, 2.4), changePct: 12.6, changeUsd: 5394.2 },
  "90d": { points: walk(90210, 90, PORTFOLIO_TOTAL, -3.2, 3.6), changePct: -3.2, changeUsd: -1594.8 },
}

/* ── Account split — the three places money lives ───────────────────────── */

export type Account = {
  key: string
  label: string
  caption: string
  value: number
  changePct: number
  points: number[]
}

export const ACCOUNTS: Account[] = [
  { key: "spot", label: "Spot", caption: "Coins you can move", value: 31480.19, changePct: 3.11, points: walk(11, 30, 31480.19, 3.11, 1.4) },
  { key: "futures", label: "Futures", caption: "Margin + unrealised PnL", value: 12960.08, changePct: 6.42, points: walk(22, 30, 12960.08, 6.42, 3.2) },
  { key: "earn", label: "Earn", caption: "Staked · 5.4% APY", value: 3775.35, changePct: 0.44, points: walk(33, 30, 3775.35, 0.44, 0.3) },
]

/* ── Stat strip ─────────────────────────────────────────────────────────── */

export type Stat = {
  key: string
  label: string
  value: string
  hint: string
  tone?: "credit" | "debit" | "warning"
}

export const STATS: Stat[] = [
  { key: "wallets", label: "Active wallets", value: "6", hint: "across 9 networks" },
  { key: "orders", label: "Open orders", value: "4", hint: "2 limit · 2 stop" },
  { key: "volume", label: "30d volume", value: "$182.4K", hint: "+18% vs last month", tone: "credit" },
  { key: "security", label: "Security score", value: "75%", hint: "1 step left", tone: "warning" },
]

/* ── Holdings ───────────────────────────────────────────────────────────── */

export type Holding = {
  symbol: string
  name: string
  network: string
  amount: number
  price: number
  value: number
  changePct: number
  points: number[]
}

export const HOLDINGS: Holding[] = [
  { symbol: "BTC", name: "Bitcoin", network: "Bitcoin", amount: 0.1842, price: 96420.5, value: 17760.66, changePct: 1.84, points: walk(101, 24, 96420.5, 1.84, 0.9) },
  { symbol: "ETH", name: "Ethereum", network: "Arbitrum One", amount: 3.417, price: 3284.12, value: 11221.84, changePct: 3.46, points: walk(102, 24, 3284.12, 3.46, 1.3) },
  { symbol: "SOL", name: "Solana", network: "Solana", amount: 38.204, price: 182.55, value: 6974.14, changePct: -1.27, points: walk(103, 24, 182.55, -1.27, 1.8) },
  { symbol: "USDT", name: "Tether", network: "TRON", amount: 5120, price: 1, value: 5120, changePct: 0.01, points: walk(104, 24, 1, 0.01, 0.05) },
  { symbol: "TON", name: "Toncoin", network: "TON", amount: 612.35, price: 5.38, value: 3294.44, changePct: 5.92, points: walk(105, 24, 5.38, 5.92, 2.4) },
  { symbol: "TRX", name: "TRON", network: "TRON", amount: 9840.11, price: 0.242, value: 2381.31, changePct: -0.63, points: walk(106, 24, 0.242, -0.63, 1.1) },
  { symbol: "USDC", name: "USD Coin", network: "Solana", amount: 1023.44, price: 1, value: 1023.44, changePct: -0.02, points: walk(107, 24, 1, -0.02, 0.05) },
  { symbol: "ARB", name: "Arbitrum", network: "Arbitrum One", amount: 1180, price: 0.372, value: 439.79, changePct: 8.13, points: walk(108, 24, 0.372, 8.13, 3.1) },
]

export const HOLDINGS_TOTAL = HOLDINGS.reduce((sum, h) => sum + h.value, 0)

/* ── Markets ────────────────────────────────────────────────────────────── */

export type Market = {
  symbol: string
  name: string
  price: number
  changePct: number
  volume: number
  points: number[]
}

export const GAINERS: Market[] = [
  { symbol: "ARB", name: "Arbitrum", price: 0.372, changePct: 8.13, volume: 214_800_000, points: walk(201, 24, 0.372, 8.13, 2.6) },
  { symbol: "TON", name: "Toncoin", price: 5.38, changePct: 5.92, volume: 389_400_000, points: walk(202, 24, 5.38, 5.92, 2.2) },
  { symbol: "SUI", name: "Sui", price: 3.14, changePct: 5.05, volume: 502_100_000, points: walk(203, 24, 3.14, 5.05, 2.4) },
  { symbol: "ETH", name: "Ethereum", price: 3284.12, changePct: 3.46, volume: 14_820_000_000, points: walk(204, 24, 3284.12, 3.46, 1.2) },
  { symbol: "AVAX", name: "Avalanche", price: 41.28, changePct: 2.91, volume: 612_300_000, points: walk(205, 24, 41.28, 2.91, 1.9) },
  { symbol: "BTC", name: "Bitcoin", price: 96420.5, changePct: 1.84, volume: 31_640_000_000, points: walk(206, 24, 96420.5, 1.84, 0.8) },
]

export const LOSERS: Market[] = [
  { symbol: "DOGE", name: "Dogecoin", price: 0.1642, changePct: -6.41, volume: 1_204_000_000, points: walk(301, 24, 0.1642, -6.41, 2.8) },
  { symbol: "APT", name: "Aptos", price: 8.22, changePct: -4.77, volume: 288_900_000, points: walk(302, 24, 8.22, -4.77, 2.3) },
  { symbol: "LINK", name: "Chainlink", price: 18.94, changePct: -3.12, volume: 741_500_000, points: walk(303, 24, 18.94, -3.12, 1.7) },
  { symbol: "DOT", name: "Polkadot", price: 6.41, changePct: -2.64, volume: 196_200_000, points: walk(304, 24, 6.41, -2.64, 2.0) },
  { symbol: "SOL", name: "Solana", price: 182.55, changePct: -1.27, volume: 4_118_000_000, points: walk(305, 24, 182.55, -1.27, 1.6) },
  { symbol: "TRX", name: "TRON", price: 0.242, changePct: -0.63, volume: 421_700_000, points: walk(306, 24, 0.242, -0.63, 1.0) },
]

/** The watchlist reads as a third tab beside Gainers/Losers. */
export const WATCHLIST: Market[] = [
  { symbol: "BTC", name: "Bitcoin", price: 96420.5, changePct: 1.84, volume: 31_640_000_000, points: walk(401, 24, 96420.5, 1.84, 0.8) },
  { symbol: "ETH", name: "Ethereum", price: 3284.12, changePct: 3.46, volume: 14_820_000_000, points: walk(402, 24, 3284.12, 3.46, 1.2) },
  { symbol: "SOL", name: "Solana", price: 182.55, changePct: -1.27, volume: 4_118_000_000, points: walk(403, 24, 182.55, -1.27, 1.6) },
  { symbol: "TON", name: "Toncoin", price: 5.38, changePct: 5.92, volume: 389_400_000, points: walk(404, 24, 5.38, 5.92, 2.2) },
  { symbol: "XRP", name: "XRP", price: 2.41, changePct: 0.92, volume: 3_204_000_000, points: walk(405, 24, 2.41, 0.92, 1.4) },
  { symbol: "ADA", name: "Cardano", price: 0.918, changePct: -0.41, volume: 684_000_000, points: walk(406, 24, 0.918, -0.41, 1.5) },
]

/* ── Open positions (perps) ─────────────────────────────────────────────── */

export type Position = {
  symbol: string
  side: "long" | "short"
  leverage: number
  size: number
  entry: number
  mark: number
  liq: number
  pnl: number
  pnlPct: number
}

export const POSITIONS: Position[] = [
  { symbol: "BTC", side: "long", leverage: 10, size: 9642.05, entry: 92180, mark: 96420.5, liq: 84120, pnl: 443.52, pnlPct: 4.6 },
  { symbol: "ETH", side: "long", leverage: 5, size: 4926.18, entry: 3198.4, mark: 3284.12, liq: 2640.2, pnl: 132.04, pnlPct: 2.68 },
  { symbol: "SOL", side: "short", leverage: 3, size: 2738.25, entry: 178.9, mark: 182.55, liq: 236.1, pnl: -55.85, pnlPct: -2.04 },
]

export const POSITIONS_PNL = POSITIONS.reduce((sum, p) => sum + p.pnl, 0)

/* ── Resting orders ─────────────────────────────────────────────────────── */

export type Order = {
  symbol: string
  type: "Limit" | "Stop"
  side: "buy" | "sell"
  price: number
  amount: number
  filledPct: number
}

export const ORDERS: Order[] = [
  { symbol: "BTC", type: "Limit", side: "buy", price: 92000, amount: 0.05, filledPct: 0 },
  { symbol: "ETH", type: "Stop", side: "sell", price: 3050, amount: 1.2, filledPct: 0 },
  { symbol: "SOL", type: "Limit", side: "buy", price: 168.4, amount: 12, filledPct: 35 },
  { symbol: "TON", type: "Stop", side: "sell", price: 4.9, amount: 200, filledPct: 0 },
]

/* ── Activity ───────────────────────────────────────────────────────────── */

export type Activity = {
  id: string
  kind: "receive" | "send" | "swap" | "buy" | "stake"
  title: string
  detail: string
  amount: string
  usd: string
  direction: "credit" | "debit" | "neutral"
  /** Minutes ago — rendered as "11h ago" on the client so SSR stays stable. */
  minutesAgo: number
}

export const ACTIVITY: Activity[] = [
  { id: "a1", kind: "receive", title: "Received USDT", detail: "TRON", amount: "+1,200.00 USDT", usd: "$1,200.00", direction: "credit", minutesAgo: 24 },
  { id: "a2", kind: "swap", title: "Swapped ETH → SOL", detail: "Arbitrum One", amount: "1.40 ETH", usd: "$4,597.77", direction: "neutral", minutesAgo: 186 },
  { id: "a3", kind: "send", title: "Sent BTC", detail: "Bitcoin", amount: "-0.0120 BTC", usd: "$1,157.05", direction: "debit", minutesAgo: 640 },
  { id: "a4", kind: "buy", title: "Bought TON", detail: "Card · Visa ••42", amount: "+150.00 TON", usd: "$807.00", direction: "credit", minutesAgo: 1420 },
  { id: "a5", kind: "stake", title: "Staked SOL", detail: "Earn · 5.4% APY", amount: "20.00 SOL", usd: "$3,651.00", direction: "neutral", minutesAgo: 2880 },
  { id: "a6", kind: "receive", title: "Received ETH", detail: "Arbitrum One", amount: "+0.4200 ETH", usd: "$1,379.33", direction: "credit", minutesAgo: 4320 },
]

/* ── Insights ───────────────────────────────────────────────────────────── */

/** Fear & Greed, 0–100. */
export const MARKET_MOOD = { score: 63, label: "Greed", source: "alternative.me" }

export const VOLUME_MONTHS: { month: string; value: number }[] = [
  { month: "May", value: 84_200 },
  { month: "Jun", value: 121_800 },
  { month: "Jul", value: 96_400 },
  { month: "Aug", value: 154_600 },
  { month: "Sep", value: 182_400 },
]

export const SECURITY_CHECKS: { label: string; done: boolean }[] = [
  { label: "Two-factor authentication", done: true },
  { label: "Identity verified", done: true },
  { label: "Anti-phishing code", done: true },
  { label: "Withdrawal whitelist", done: false },
]

export const SECURITY_SCORE = Math.round(
  (SECURITY_CHECKS.filter((c) => c.done).length / SECURITY_CHECKS.length) * 100,
)

/* ── Networks ───────────────────────────────────────────────────────────── */

export const NETWORK_SPLIT: { name: string; value: number }[] = [
  { name: "Bitcoin", value: 17760.66 },
  { name: "Arbitrum One", value: 11661.63 },
  { name: "Solana", value: 7997.58 },
  { name: "TRON", value: 7501.31 },
  { name: "TON", value: 3294.44 },
]

/**
 * Dummy data for the buy / sell previews (/buy-unauth, /sell-unauth).
 *
 * Prices and 7-day series come from the markets preview's data so a coin is
 * the same price on every page. Limits follow the live product: a $5 minimum
 * on buys (enforced in lib/crypto-backend/fiat-onramp.ts) and a $5,000 cap.
 * Everything else — methods, payout accounts, fees, orders — is invented.
 *
 * No Math.random(), no Date.now(): server and client render the same thing.
 */

import { MARKETS } from "@/components/markets-unauth/market-data"

export { formatPrice } from "@/components/markets-unauth/market-data"

export type Mode = "buy" | "sell"

/* ── Assets ─────────────────────────────────────────────────────────────── */

export type TradeAsset = {
  symbol: string
  name: string
  price: number
  changePct: number
  high: number
  low: number
  series: number[]
  /** Networks this coin can be delivered on. USDT has three; most have one. */
  networks: string[]
  /** What the person holds — the sell side's "max". */
  held: number
  /** Pegged to the dollar. A stablecoin has no price story to chart: scaled
   *  to fill a card, a ±0.06% wobble reads as a violent swing. */
  stable: boolean
}

const HELD: Record<string, number> = { USDT: 5120, BTC: 0.1842, ETH: 3.417, SOL: 38.204, USDC: 1023.44, TON: 612.35 }
const NETWORKS: Record<string, string[]> = {
  USDT: ["Tron", "Solana", "Ethereum"],
  USDC: ["Solana", "Ethereum"],
  BTC: ["Bitcoin"],
  ETH: ["Ethereum", "Arbitrum One"],
  SOL: ["Solana"],
  TON: ["TON"],
}

// USDT and USDC aren't in the markets list (they're the quote). They're
// never charted (see `stable`), so a flat line is all they need.
const STABLE_SERIES = Array.from({ length: 32 }, () => 1)

function fromMarket(symbol: string, name: string): TradeAsset {
  const m = MARKETS.find((x) => x.base === symbol && x.quote === "USDT")
  return {
    symbol,
    name,
    price: m?.price ?? 1,
    changePct: m?.changePct ?? 0,
    high: m?.high ?? 1,
    low: m?.low ?? 1,
    series: m?.series ?? STABLE_SERIES,
    networks: NETWORKS[symbol] ?? [symbol],
    held: HELD[symbol] ?? 0,
    stable: symbol === "USDT" || symbol === "USDC",
  }
}

export const ASSETS: TradeAsset[] = [
  fromMarket("USDT", "Tether"),
  fromMarket("BTC", "Bitcoin"),
  fromMarket("ETH", "Ethereum"),
  fromMarket("SOL", "Solana"),
  fromMarket("USDC", "USD Coin"),
  fromMarket("TON", "Toncoin"),
]

/* ── Fiat ───────────────────────────────────────────────────────────────── */

export type Fiat = { code: "USD" | "NGN"; symbol: string; name: string; perUsd: number; flag: string }

/** USD settles against the Dollar Account; NGN rides the local bank rail —
 *  the one African rail the live product keeps (see the payout commits). */
export const FIATS: Fiat[] = [
  { code: "USD", symbol: "$", name: "US Dollar", perUsd: 1, flag: "🇺🇸" },
  { code: "NGN", symbol: "₦", name: "Nigerian Naira", perUsd: 1582.4, flag: "🇳🇬" },
]

export function formatFiat(value: number, fiat: Fiat, maxFrac = 2): string {
  return `${fiat.symbol}${value.toLocaleString("en-US", { minimumFractionDigits: Math.min(2, maxFrac), maximumFractionDigits: maxFrac })}`
}

export function formatCoin(value: number, symbol: string): string {
  const frac = symbol === "USDT" || symbol === "USDC" ? 2 : value >= 1 ? 4 : 6
  return `${value.toLocaleString("en-US", { maximumFractionDigits: frac })} ${symbol}`
}

/* ── Limits ─────────────────────────────────────────────────────────────── */

export const LIMITS = { minUsd: 5, maxUsd: 5000, dailyUsd: 5000, usedTodayUsd: 1240 }

/** How long a quoted price holds before it refreshes. */
export const QUOTE_TTL = 20

/* ── How you pay / how you get paid ─────────────────────────────────────── */

export type Method = {
  key: string
  label: string
  detail: string
  /** Fee as a percent of the order. */
  feePct: number
  eta: string
  fiats: Fiat["code"][]
  /** Shown but not selectable. */
  soon?: boolean
}

export const BUY_METHODS: Method[] = [
  { key: "dollar", label: "Dollar Account", detail: "$2,410.55 available", feePct: 0, eta: "Instant", fiats: ["USD"] },
  { key: "card", label: "Debit / credit card", detail: "Visa •• 4242", feePct: 1.8, eta: "~2 min", fiats: ["USD"] },
  { key: "bank", label: "Bank transfer", detail: "Pay from any Nigerian bank", feePct: 0.5, eta: "~5 min", fiats: ["NGN"] },
  { key: "p2p", label: "P2P", detail: "Buy directly from people", feePct: 0, eta: "Varies", fiats: ["USD", "NGN"], soon: true },
]

export const SELL_METHODS: Method[] = [
  { key: "dollar", label: "Dollar Account", detail: "Credited instantly", feePct: 0, eta: "Instant", fiats: ["USD"] },
  { key: "bank", label: "GTBank •• 3381", detail: "Raphael Tomiwa · NGN", feePct: 0.5, eta: "~10 min", fiats: ["NGN"] },
  { key: "p2p", label: "P2P", detail: "Sell directly to people", feePct: 0, eta: "Varies", fiats: ["USD", "NGN"], soon: true },
]

/** The staged checklist the order screen walks through — same steps as the
 *  live flow's status screen. */
export const STAGES: Record<Mode, string[]> = {
  buy: ["Payment received", "Price locked", "Sending to your wallet", "Delivered"],
  sell: ["Coins received", "Price locked", "Sending your payout", "Paid out"],
}

/* ── Recent orders ──────────────────────────────────────────────────────── */

export type Order = {
  id: string
  mode: Mode
  symbol: string
  amount: number
  fiat: Fiat["code"]
  fiatAmount: number
  method: string
  status: "completed" | "processing" | "failed"
  /** Minutes ago, rendered on the client. */
  minutesAgo: number
}

export const RECENT_ORDERS: Order[] = [
  { id: "o1", mode: "buy", symbol: "USDT", amount: 250, fiat: "USD", fiatAmount: 250, method: "Dollar Account", status: "completed", minutesAgo: 38 },
  { id: "o2", mode: "sell", symbol: "SOL", amount: 2.4, fiat: "NGN", fiatAmount: 691_420, method: "GTBank •• 3381", status: "processing", minutesAgo: 95 },
  { id: "o3", mode: "buy", symbol: "BTC", amount: 0.0052, fiat: "USD", fiatAmount: 510.4, method: "Visa •• 4242", status: "completed", minutesAgo: 1480 },
  { id: "o4", mode: "buy", symbol: "ETH", amount: 0.15, fiat: "NGN", fiatAmount: 783_100, method: "Bank transfer", status: "failed", minutesAgo: 2950 },
  { id: "o5", mode: "sell", symbol: "USDT", amount: 400, fiat: "USD", fiatAmount: 400, method: "Dollar Account", status: "completed", minutesAgo: 4320 },
]

/**
 * Dummy data for the swap redesign preview (/swap-unauth).
 *
 * Deterministic throughout. Prices agree with the markets and trade previews,
 * so a token costs the same wherever you meet it.
 *
 * The live swap page's history is the fault this file is shaped around: its
 * rows read "USDC → 0x00000000000…", printing a contract address — frequently
 * the ZERO address — where the token symbol belongs, with a subtitle of
 * "solana-mainnet-beta → solana-…" that names the same chain twice in raw
 * slug form and then truncates. A swap's content is "1,200 USDC became 6.57
 * SOL"; neither side of that is an address.
 */

/* ── Tokens ─────────────────────────────────────────────────────────────── */

export type Chain = "Ethereum" | "Arbitrum" | "Solana" | "Base" | "TRON" | "TON"

export type Token = {
  symbol: string
  name: string
  chain: Chain
  /** USD price — same figures the markets preview uses. */
  price: number
  balance: number
  decimals: number
}

export const TOKENS: Token[] = [
  { symbol: "USDT", name: "Tether", chain: "TRON", price: 1, balance: 5120, decimals: 2 },
  { symbol: "USDC", name: "USD Coin", chain: "Arbitrum", price: 1, balance: 1023.44, decimals: 2 },
  { symbol: "USDC", name: "USD Coin", chain: "Solana", price: 1, balance: 842.1, decimals: 2 },
  { symbol: "ETH", name: "Ethereum", chain: "Ethereum", price: 3284.12, balance: 0.417, decimals: 5 },
  { symbol: "ETH", name: "Ethereum", chain: "Arbitrum", price: 3284.12, balance: 3.0, decimals: 5 },
  { symbol: "BTC", name: "Bitcoin", chain: "Ethereum", price: 96420.5, balance: 0.1842, decimals: 6 },
  { symbol: "SOL", name: "Solana", chain: "Solana", price: 182.55, balance: 38.204, decimals: 4 },
  { symbol: "ARB", name: "Arbitrum", chain: "Arbitrum", price: 0.372, balance: 1180, decimals: 2 },
  { symbol: "TON", name: "Toncoin", chain: "TON", price: 5.38, balance: 612.35, decimals: 3 },
  { symbol: "TRX", name: "TRON", chain: "TRON", price: 0.242, balance: 9840.11, decimals: 2 },
]

export function tokenKey(t: Token) {
  return `${t.symbol}-${t.chain}`
}

export function tokenByKey(key: string): Token {
  return TOKENS.find((t) => tokenKey(t) === key) ?? TOKENS[0]
}

export const DEFAULT_FROM = tokenKey(TOKENS[1]) // USDC on Arbitrum
export const DEFAULT_TO = tokenKey(TOKENS[6]) // SOL

/* ── Formatters ─────────────────────────────────────────────────────────── */

export function formatAmount(value: number, decimals = 4): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: decimals })
}

export function formatUSD(value: number, opts?: { compact?: boolean }): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: opts?.compact ? "compact" : "standard",
    minimumFractionDigits: opts?.compact ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/** A rate needs enough precision to be a rate: 0.000419, not 0.00. */
export function formatRate(value: number): string {
  const frac = value >= 1000 ? 2 : value >= 1 ? 4 : value >= 0.01 ? 6 : 8
  return value.toLocaleString("en-US", { minimumFractionDigits: frac, maximumFractionDigits: frac })
}

/* ── Quote ──────────────────────────────────────────────────────────────── */

/** How long a quote is good for. Swap quotes expire; the live page never says so. */
export const QUOTE_TTL_SECONDS = 30

export type Hop = {
  kind: "swap" | "bridge"
  venue: string
  detail: string
}

export type Quote = {
  fromAmount: number
  toAmount: number
  /** to per from. */
  rate: number
  minReceived: number
  priceImpactPct: number
  networkFeeUsd: number
  protocolFeeUsd: number
  hops: Hop[]
  /** Cross-chain routes take minutes; same-chain is seconds. */
  etaSeconds: number
}

/**
 * The route, spelled out. The live page's subtitle promises "cross-chain
 * routing, with the quote's working shown" and then shows none of the working.
 */
function routeFor(from: Token, to: Token): Hop[] {
  if (from.chain === to.chain) {
    if (from.symbol === to.symbol) return []
    const venue =
      from.chain === "Solana" ? "Jupiter" : from.chain === "TRON" ? "SunSwap" : "Uniswap v3"
    return [{ kind: "swap", venue, detail: `${from.symbol} → ${to.symbol} on ${from.chain}` }]
  }
  // USDC is the bridge asset, so a leg that is ALREADY USDC does not need a
  // swap into it. Emitting one anyway produced "USDC → USDC on Arbitrum" as
  // step 1 — a hop that does nothing, in the panel whose whole job is to show
  // the working honestly.
  const BRIDGE_ASSET = "USDC"
  const hops: Hop[] = []

  if (from.symbol !== BRIDGE_ASSET) {
    hops.push({
      kind: "swap",
      venue: from.chain === "Solana" ? "Jupiter" : "Uniswap v3",
      detail: `${from.symbol} → ${BRIDGE_ASSET} on ${from.chain}`,
    })
  }

  hops.push({ kind: "bridge", venue: "LI.FI", detail: `${BRIDGE_ASSET}: ${from.chain} → ${to.chain}` })

  if (to.symbol !== BRIDGE_ASSET) {
    hops.push({
      kind: "swap",
      venue: to.chain === "Solana" ? "Jupiter" : "Uniswap v3",
      detail: `${BRIDGE_ASSET} → ${to.symbol} on ${to.chain}`,
    })
  }

  return hops
}

export function quoteFor({
  from,
  to,
  fromAmount,
  slippagePct,
}: {
  from: Token
  to: Token
  fromAmount: number
  slippagePct: number
}): Quote {
  const crossChain = from.chain !== to.chain
  const hops = routeFor(from, to)

  const usdIn = fromAmount * from.price
  // Impact grows with size against a fixed notional depth, and a bridge adds
  // a second venue's spread on top.
  const impactPct = Math.min(4.5, (usdIn / 45_000) * 1.1 + (crossChain ? 0.18 : 0.04))
  const protocolFeeUsd = usdIn * (crossChain ? 0.0025 : 0.001)
  const networkFeeUsd = crossChain ? 1.84 : from.chain === "Solana" ? 0.02 : 0.61

  const usdOut = usdIn * (1 - impactPct / 100) - protocolFeeUsd
  const toAmount = to.price > 0 ? usdOut / to.price : 0

  return {
    fromAmount,
    toAmount,
    rate: fromAmount > 0 ? toAmount / fromAmount : from.price / to.price,
    minReceived: toAmount * (1 - slippagePct / 100),
    priceImpactPct: impactPct,
    networkFeeUsd,
    protocolFeeUsd,
    hops,
    etaSeconds: crossChain ? 180 : from.chain === "Solana" ? 8 : 25,
  }
}

export const SLIPPAGE_OPTIONS = [0.1, 0.5, 1, 3]

/* ── Rate history ───────────────────────────────────────────────────────── */

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

function hash(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

export type RangeKey = "1d" | "1w" | "1m"

export const RANGES: { key: RangeKey; label: string; points: number; window: string }[] = [
  { key: "1d", label: "1D", points: 48, window: "24 hours" },
  { key: "1w", label: "1W", points: 84, window: "7 days" },
  { key: "1m", label: "1M", points: 90, window: "30 days" },
]

/** The from/to rate over time, landing on the current rate. */
export function rateSeries(from: Token, to: Token, range: RangeKey): number[] {
  const spec = RANGES.find((r) => r.key === range) ?? RANGES[1]
  const end = from.price / to.price
  const rand = mulberry32(hash(`${tokenKey(from)}:${tokenKey(to)}:${range}`))
  const vol = range === "1d" ? 0.004 : range === "1w" ? 0.011 : 0.02
  const out: number[] = []
  let v = end
  for (let i = 0; i < spec.points; i++) {
    out.push(v)
    v = v * (1 + (rand() - 0.5) * 2 * vol)
  }
  return out.reverse()
}

/* ── History ────────────────────────────────────────────────────────────────
   Symbols on BOTH sides, chains named properly, a USD value, and a status
   that only takes a colour when something went wrong. */

export type SwapStatus = "completed" | "pending" | "failed"

export type SwapRecord = {
  id: string
  fromSymbol: string
  fromChain: Chain
  fromAmount: number
  toSymbol: string
  toChain: Chain
  toAmount: number
  usd: number
  status: SwapStatus
  /** Seen / needed, while pending. */
  confirmations?: [number, number]
  route: string
  /** Fixed offsets — no clock read at render. */
  minutesAgo: number
  txid: string
}

export const SWAPS: SwapRecord[] = [
  { id: "s1", fromSymbol: "USDC", fromChain: "Arbitrum", fromAmount: 1200, toSymbol: "SOL", toChain: "Solana", toAmount: 6.5702, usd: 1200, status: "pending", confirmations: [4, 12], route: "LI.FI", minutesAgo: 3, txid: "0x7c4e91ab35d0" },
  { id: "s2", fromSymbol: "SOL", fromChain: "Solana", fromAmount: 2.4, toSymbol: "USDT", toChain: "TRON", toAmount: 437.02, usd: 438.12, status: "completed", route: "Jupiter · LI.FI", minutesAgo: 24, txid: "5Kq8nRtYuV3w" },
  { id: "s3", fromSymbol: "ETH", fromChain: "Arbitrum", fromAmount: 0.42, toSymbol: "USDC", toChain: "Arbitrum", toAmount: 1377.05, usd: 1379.33, status: "completed", route: "Uniswap v3", minutesAgo: 96, txid: "0x3f5401b76080" },
  { id: "s4", fromSymbol: "USDC", fromChain: "Solana", fromAmount: 500, toSymbol: "TRUMP", toChain: "Solana", toAmount: 221.24, usd: 500, status: "completed", route: "Jupiter", minutesAgo: 188, txid: "6p6xgHyF7AeE" },
  { id: "s5", fromSymbol: "TRX", fromChain: "TRON", fromAmount: 4200, toSymbol: "USDT", toChain: "TRON", toAmount: 1014.36, usd: 1016.4, status: "completed", route: "SunSwap", minutesAgo: 420, txid: "TJYeasTPa6gp" },
  { id: "s6", fromSymbol: "USDT", fromChain: "TRON", fromAmount: 800, toSymbol: "TON", toChain: "TON", toAmount: 148.14, usd: 797.0, status: "failed", route: "LI.FI", minutesAgo: 640, txid: "UQBGvjFGRxPG" },
  { id: "s7", fromSymbol: "ARB", fromChain: "Arbitrum", fromAmount: 1180, toSymbol: "ETH", toChain: "Arbitrum", toAmount: 0.1329, usd: 438.96, status: "completed", route: "Uniswap v3", minutesAgo: 1180, txid: "0x8b8f4c21a1de" },
  { id: "s8", fromSymbol: "SOL", fromChain: "Solana", fromAmount: 14.2, toSymbol: "USDC", toChain: "Solana", toAmount: 2588.4, usd: 2592.21, status: "completed", route: "Jupiter", minutesAgo: 2160, txid: "Fq8kU7JtyKvn" },
]

export const SWAP_STATS = {
  count: SWAPS.length,
  volumeUsd: SWAPS.filter((s) => s.status === "completed").reduce((a, s) => a + s.usd, 0),
  pending: SWAPS.filter((s) => s.status === "pending").length,
  failed: SWAPS.filter((s) => s.status === "failed").length,
}

/**
 * Dummy data for the transactions redesign preview (/transactions-unauth).
 *
 * Deterministic throughout — no Math.random(), no Date.now() — so server and
 * client render identically. Time is stored as a DAY OFFSET plus a literal
 * clock string rather than a timestamp, for the same reason: "2 days ago" is
 * a fact about the data, "Sep 14" is a fact about the viewer's calendar, and
 * only the first of those can be rendered on the server.
 *
 * The summary figures DERIVE from the rows (see SUMMARY at the bottom). The
 * live page computes them separately and it shows: its header claims 16
 * deposits + 11 withdrawals + 14 moved = 41 against a list that says "30
 * transactions", and its Money Out and Net both render as an em dash.
 */

/* ── Prices, for the USD column ─────────────────────────────────────────── */

const PRICES: Record<string, number> = {
  BTC: 96420.5,
  ETH: 3284.12,
  SOL: 182.55,
  USDT: 1,
  USDC: 1,
  TON: 5.38,
  TRX: 0.242,
  ARB: 0.372,
  SUI: 3.14,
}

export function usdOf(symbol: string, amount: number): number {
  return (PRICES[symbol] ?? 0) * amount
}

export function formatUSD(value: number, opts?: { compact?: boolean; maxFrac?: number }): string {
  const max = opts?.maxFrac ?? (opts?.compact ? 1 : 2)
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: opts?.compact ? "compact" : "standard",
    minimumFractionDigits: Math.min(opts?.compact ? 0 : 2, max),
    maximumFractionDigits: max,
  }).format(value)
}

/**
 * Token amounts need precision that follows the size — the live page prints
 * "$41.828268" for a dollar total, which is a raw float that escaped a
 * formatter, and "-0.00 Unknown" for an amount it could not resolve.
 */
export function formatAmount(value: number): string {
  const frac = value >= 1000 ? 2 : value >= 1 ? 4 : 6
  return value.toLocaleString("en-US", { maximumFractionDigits: frac })
}

/* ── Types ──────────────────────────────────────────────────────────────── */

export type TxKind = "deposit" | "withdrawal" | "swap" | "trade" | "transfer"
export type TxStatus = "completed" | "pending" | "failed"

export type Tx = {
  id: string
  kind: TxKind
  status: TxStatus
  /** The asset leaving, for a swap/trade; the only asset otherwise. */
  asset: string
  amount: number
  /** Swaps and trades have a second leg. */
  toAsset?: string
  toAmount?: number
  network: string
  /** Counterparty address, or the two accounts for an internal transfer. */
  counterparty?: string
  hash: string
  /** Network fee, in the fee asset. */
  fee: number
  feeAsset: string
  /** 0 = today, 1 = yesterday, 2+ = that many days back. */
  dayOffset: number
  /** Literal clock text — never derived from a Date at render time. */
  time: string
  /** Seen / needed. Only meaningful while pending. */
  confirmations?: [number, number]
}

/* ── The ledger ──────────────────────────────────────────────────────────
   Compact tuples expanded below, so thirty rows stay readable and the shape
   cannot drift row to row. */

type Row = [
  kind: TxKind,
  status: TxStatus,
  asset: string,
  amount: number,
  network: string,
  dayOffset: number,
  time: string,
  extra?: Partial<Tx>,
]

const ROWS: Row[] = [
  ["withdrawal", "completed", "ETH", 0.0016, "Ethereum", 0, "01:38 AM", { counterparty: "0x7078c4A9b1De3f5e7A3D6c4b19E0aD4922b1" }],
  ["swap", "completed", "ETH", 0.001645, "Arbitrum One", 0, "01:37 AM", { toAsset: "USDC", toAmount: 5.4 }],
  ["deposit", "pending", "USDT", 1200, "TRON", 0, "01:12 AM", { confirmations: [7, 19], counterparty: "TLEvwMieGYSv8pBP5s1nGBJ8nYVPPokeXG" }],
  ["trade", "completed", "USDC", 2400, "Spot", 0, "12:58 AM", { toAsset: "BTC", toAmount: 0.0249 }],
  ["withdrawal", "failed", "SOL", 14.2, "Solana", 1, "11:02 PM", { counterparty: "Fq8kU7JtyKvnJsZJafXa6GfgjciFDKiNCDSYc5D2FfWy" }],
  ["withdrawal", "completed", "ETH", 0.002, "Ethereum", 1, "12:41 AM", { counterparty: "0x1af1C2b7E4d83C05e6a1bF3d9c2E7a0B4B6Fc" }],
  ["swap", "completed", "SOL", 2.4, "Solana", 1, "12:39 AM", { toAsset: "USDT", toAmount: 438.12 }],
  ["transfer", "completed", "USDC", 500, "Spot → Futures", 1, "09:20 PM", {}],
  ["deposit", "completed", "SOL", 0.01, "Solana", 2, "05:19 PM", {}],
  ["deposit", "completed", "USDC", 0.666144, "Arbitrum One", 2, "04:16 PM", { counterparty: "0xf70d9A2c5B1e8F3a6D4c7B0e2A9f5C3d1dbef" }],
  ["trade", "completed", "BTC", 0.012, "Spot", 2, "02:04 PM", { toAsset: "USDT", toAmount: 1157.05 }],
  ["transfer", "completed", "USDT", 1500, "Funding → Spot", 2, "11:30 AM", {}],
  ["deposit", "completed", "TON", 150, "TON", 3, "08:45 PM", { counterparty: "UQBGvjFGRxPGyXyABYk7IyZBDUr6nkWu0z5f_68vkyG47GIW" }],
  ["swap", "completed", "TRX", 4200, "TRON", 3, "06:12 PM", { toAsset: "USDT", toAmount: 1016.4 }],
  ["withdrawal", "completed", "USDT", 800, "TRON", 3, "03:55 PM", { counterparty: "TLEvwMieGYSv8pBP5s1nGBJ8nYVPPokeXG" }],
  ["trade", "completed", "ETH", 1.4, "Spot", 4, "09:31 PM", { toAsset: "USDC", toAmount: 4597.77 }],
  ["deposit", "completed", "ETH", 0.42, "Arbitrum One", 4, "07:18 PM", { counterparty: "0x3f5401b76080CB31B74A7ed98e38daE13c01c516" }],
  ["transfer", "completed", "SOL", 20, "Spot → Earn", 4, "01:02 PM", {}],
  ["withdrawal", "completed", "ARB", 400, "Arbitrum One", 5, "10:44 PM", { counterparty: "0x3f5401b76080CB31B74A7ed98e38daE13c01c516" }],
  ["swap", "completed", "USDC", 1023.44, "Solana", 5, "04:27 PM", { toAsset: "SOL", toAmount: 5.6 }],
  ["deposit", "completed", "BTC", 0.05, "Bitcoin", 6, "11:15 AM", { counterparty: "bc1q3ml9cragvkwxpvucph8mwf0xv0dre323f0mg8g" }],
  ["trade", "completed", "USDT", 3200, "Spot", 6, "09:03 AM", { toAsset: "ETH", toAmount: 0.974 }],
  ["withdrawal", "completed", "TON", 60, "TON", 7, "08:22 PM", { counterparty: "UQBGvjFGRxPGyXyABYk7IyZBDUr6nkWu0z5f_68vkyG47GIW" }],
  ["transfer", "completed", "USDC", 750, "Futures → Spot", 8, "05:40 PM", {}],
  ["deposit", "completed", "TRX", 9840.11, "TRON", 9, "02:11 PM", { counterparty: "TLEvwMieGYSv8pBP5s1nGBJ8nYVPPokeXG" }],
  ["swap", "completed", "ETH", 0.8, "Arbitrum One", 11, "07:56 PM", { toAsset: "ARB", toAmount: 7060 }],
  ["withdrawal", "completed", "USDC", 1200, "Solana", 13, "12:30 PM", { counterparty: "Fq8kU7JtyKvnJsZJafXa6GfgjciFDKiNCDSYc5D2FfWy" }],
  ["deposit", "completed", "USDT", 5000, "TRON", 16, "10:05 AM", { counterparty: "TLEvwMieGYSv8pBP5s1nGBJ8nYVPPokeXG" }],
  ["trade", "completed", "SOL", 38.2, "Spot", 19, "03:47 PM", { toAsset: "USDT", toAmount: 6974.14 }],
  ["deposit", "completed", "ETH", 3, "Ethereum", 24, "06:09 PM", { counterparty: "0x3f5401b76080CB31B74A7ed98e38daE13c01c516" }],
]

/** Fee assets per network — a TRON fee is not denominated in ETH. */
const FEE_ASSET: Record<string, string> = {
  Ethereum: "ETH",
  "Arbitrum One": "ETH",
  Solana: "SOL",
  TRON: "TRX",
  TON: "TON",
  Bitcoin: "BTC",
}

/** A stable pseudo-hash per row — deterministic, so SSR matches. */
function hashFor(i: number, kind: string): string {
  let h = 0x811c9dc5
  const s = `${kind}:${i}`
  for (let n = 0; n < s.length; n++) {
    h ^= s.charCodeAt(n)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  let out = ""
  let x = h
  for (let n = 0; n < 16; n++) {
    out += "0123456789abcdef"[x & 0xf]
    x = (Math.imul(x, 0x01000193) ^ (x >>> 7)) >>> 0
  }
  return out
}

export const TRANSACTIONS: Tx[] = ROWS.map(([kind, status, asset, amount, network, dayOffset, time, extra], i) => {
  const feeAsset = FEE_ASSET[network] ?? "USDT"
  // Internal transfers are free; everything that touches a chain is not.
  const onChain = kind !== "transfer" && kind !== "trade"
  const feeUsd = onChain ? [0.42, 1.18, 0.07, 0.9, 2.3][i % 5] : 0
  return {
    id: `tx-${i + 1}`,
    kind,
    status,
    asset,
    amount,
    network,
    hash: (network === "Ethereum" || network === "Arbitrum One" ? "0x" : "") + hashFor(i, kind),
    fee: feeUsd / (PRICES[feeAsset] ?? 1),
    feeAsset,
    dayOffset,
    time,
    ...extra,
  }
})

/* ── Summary — derived, so the header cannot contradict the list ────────── */

/** A failed transaction moved nothing. Counting it is how a ledger lies. */
const settled = TRANSACTIONS.filter((t) => t.status === "completed")

function legUsd(t: Tx) {
  return usdOf(t.asset, t.amount)
}

export const SUMMARY = {
  inUsd: settled.filter((t) => t.kind === "deposit").reduce((s, t) => s + legUsd(t), 0),
  inCount: settled.filter((t) => t.kind === "deposit").length,
  outUsd: settled.filter((t) => t.kind === "withdrawal").reduce((s, t) => s + legUsd(t), 0),
  outCount: settled.filter((t) => t.kind === "withdrawal").length,
  tradedUsd: settled.filter((t) => t.kind === "swap" || t.kind === "trade").reduce((s, t) => s + legUsd(t), 0),
  tradeCount: settled.filter((t) => t.kind === "trade").length,
  swapCount: settled.filter((t) => t.kind === "swap").length,
  transferCount: settled.filter((t) => t.kind === "transfer").length,
  feesUsd: settled.reduce((s, t) => s + usdOf(t.feeAsset, t.fee), 0),
  total: TRANSACTIONS.length,
  pending: TRANSACTIONS.filter((t) => t.status === "pending").length,
  failed: TRANSACTIONS.filter((t) => t.status === "failed").length,
}

export const NET_USD = SUMMARY.inUsd - SUMMARY.outUsd

/* ── Filter vocabulary ──────────────────────────────────────────────────── */

export const KIND_FILTERS: { key: TxKind | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "deposit", label: "Deposits" },
  { key: "withdrawal", label: "Withdrawals" },
  { key: "swap", label: "Swaps" },
  { key: "trade", label: "Trades" },
  { key: "transfer", label: "Transfers" },
]

export const STATUS_FILTERS: { key: TxStatus | "any"; label: string }[] = [
  { key: "any", label: "Any status" },
  { key: "completed", label: "Completed" },
  { key: "pending", label: "Pending" },
  { key: "failed", label: "Failed" },
]

export const RANGE_FILTERS: { key: string; label: string; days: number }[] = [
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "all", label: "All time", days: Infinity },
]

/** Money direction for a row: what the wallet's balance actually did. */
export function directionOf(kind: TxKind): "credit" | "debit" | "neutral" {
  if (kind === "deposit") return "credit"
  if (kind === "withdrawal") return "debit"
  return "neutral"
}

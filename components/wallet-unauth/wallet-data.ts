/**
 * Dummy data for the wallet redesign preview (/wallet-unauth).
 *
 * Same discipline as the dashboard's demo-data: everything fixed, nothing from
 * Math.random() or Date.now(), so server and client render identically.
 *
 * The figures RECONCILE on purpose — the account split sums to the total, the
 * balance breakdown sums to the total, and each asset's available + in-order +
 * locked equals its total. A mock wallet whose columns do not add up teaches
 * the reviewer to stop reading the numbers, which is the one thing a wallet
 * screen cannot afford.
 */

import { formatUSD, formatPrice, formatAmount } from "@/components/dashboard-unauth/demo-data"

export { formatUSD, formatPrice, formatAmount }

/* ── Balances ─────────────────────────────────────────────────────────────
   This block is the single source of truth. The headline total, the account
   split and the state breakdown are all DERIVED from it further down, because
   the alternative — typing each figure by hand and keeping four of them in
   agreement — is how a mock ends up with a table that sums to $48,214.78 under
   a hero that says $48,215.62. A reviewer who spots that stops trusting every
   other number on the page. */

export type AccountKey = "spot" | "funding" | "futures" | "earn"

export type Balance = {
  symbol: string
  name: string
  network: string
  price: number
  changePct: number
  /** total = available + inOrder + locked, always. */
  available: number
  inOrder: number
  locked: number
  account: AccountKey
}

export const BALANCES: Balance[] = [
  { symbol: "BTC", name: "Bitcoin", network: "Bitcoin", price: 96420.5, changePct: 1.84, available: 0.1342, inOrder: 0.05, locked: 0, account: "spot" },
  { symbol: "ETH", name: "Ethereum", network: "Arbitrum One", price: 3284.12, changePct: 3.46, available: 2.217, inOrder: 1.2, locked: 0, account: "spot" },
  { symbol: "SOL", name: "Solana", network: "Solana", price: 182.55, changePct: -1.27, available: 18.204, inOrder: 12, locked: 8, account: "futures" },
  { symbol: "USDT", name: "Tether", network: "TRON", price: 1, changePct: 0.01, available: 5120, inOrder: 0, locked: 0, account: "funding" },
  { symbol: "TON", name: "Toncoin", network: "TON", price: 5.38, changePct: 5.92, available: 412.35, inOrder: 200, locked: 0, account: "earn" },
  { symbol: "TRX", name: "TRON", network: "TRON", price: 0.242, changePct: -0.63, available: 9840.11, inOrder: 0, locked: 0, account: "funding" },
  { symbol: "USDC", name: "USD Coin", network: "Solana", price: 1, changePct: -0.02, available: 1023.44, inOrder: 0, locked: 0, account: "funding" },
  { symbol: "ARB", name: "Arbitrum", network: "Arbitrum One", price: 0.372, changePct: 8.13, available: 1180, inOrder: 0, locked: 0, account: "spot" },
  // Zero rows are not filler — they are what the "hide zero balances" toggle
  // exists to hide, and a toggle with nothing to hide cannot be reviewed.
  { symbol: "SUI", name: "Sui", network: "Sui", price: 3.14, changePct: 5.05, available: 0, inOrder: 0, locked: 0, account: "spot" },
  { symbol: "AVAX", name: "Avalanche", network: "Avalanche", price: 41.28, changePct: 2.91, available: 0, inOrder: 0, locked: 0, account: "spot" },
]

export type BalanceRow = Balance & { total: number; value: number; share: number }

const withTotals = BALANCES.map((b) => {
  const total = b.available + b.inOrder + b.locked
  return { ...b, total, value: total * b.price }
})

export const BALANCES_TOTAL = withTotals.reduce((s, r) => s + r.value, 0)

/** Rows ranked by value, each carrying its share of the wallet. Ranking is
 *  baked in so the allocation colours match between the bar and the table. */
export const BALANCE_ROWS: BalanceRow[] = withTotals
  .map((r) => ({ ...r, share: (r.value / (BALANCES_TOTAL || 1)) * 100 }))
  .sort((a, b) => b.value - a.value)

/* ── Totals ─────────────────────────────────────────────────────────────── */

export const WALLET_TOTAL = BALANCES_TOTAL

/** A 24h move is a fact about the past, not a sum of the rows, so it stays a
 *  stated figure. */
export const WALLET_DAY_PCT = 2.74
export const WALLET_DAY_PNL = 1284.35

/** The house quote asset. A trading platform prices the whole wallet in BTC
 *  as well as in dollars, because that is the unit performance is judged in. */
export const BTC_PRICE = 96420.5
export const WALLET_BTC = WALLET_TOTAL / BTC_PRICE

/* ── Chain families ─────────────────────────────────────────────────────────
   The unit a wallet is actually organised by is the ADDRESS, and one address
   serves a whole family: the same 0x… receives on Ethereum, Arbitrum and
   Avalanche, so listing those as three separate "networks" asks the user to
   copy the same string three times and pick the right one by luck.

   Grouping by family is also what makes the selector short enough to scan —
   six rows instead of a scrolling list of every chain the platform supports.

   Addresses are DUMMY but CHECKSUM-VALID, generated once per chain and pasted
   here. The first draft used invented strings of roughly the right shape, and
   they scanned fine and then died in the wallet: an EVM address carries its
   checksum in its CAPITALISATION (EIP-55), TRON and Bitcoin carry one in the
   trailing bytes, and Sui is 0x plus exactly 64 hex characters. A made-up
   string passes none of those, so the QR decoded correctly and the receiving
   wallet still said "invalid address" — which looks like a bug in the QR and
   is not one.

   Each is a real, well-formed address on its chain that NOBODY holds the key
   to. That makes the preview honest and makes the warning in the receive
   modal load-bearing: funds sent to any of them are gone. Regenerate with
   @scure/base + @noble/hashes if these ever need to change. Balances and asset counts are
   DERIVED from BALANCES, so the selector and the table cannot drift apart. */

export type ChainGroup = {
  key: string
  name: string
  /** The chains this one address actually serves. */
  caption: string
  networks: string[]
  /** Which coin's mark represents the family. */
  symbol: string
  address: string
  /** Confirmations a deposit needs before it credits. */
  confirmations: number
  /** The smallest deposit that will be credited rather than swallowed. */
  minimum: string
  value: number
  assets: BalanceRow[]
}

const CHAIN_META: Omit<ChainGroup, "value" | "assets">[] = [
  {
    key: "evm",
    name: "EVM",
    caption: "Ethereum · Arbitrum · Avalanche",
    networks: ["Ethereum", "Arbitrum One", "Avalanche"],
    symbol: "ETH",
    address: "0x3f5401b76080CB31B74A7ed98e38daE13c01c516",
    confirmations: 12,
    minimum: "0.001 ETH",
  },
  { key: "bitcoin", name: "Bitcoin", caption: "Native SegWit", networks: ["Bitcoin"], symbol: "BTC", address: "bc1q3ml9cragvkwxpvucph8mwf0xv0dre323f0mg8g", confirmations: 2, minimum: "0.0002 BTC" },
  { key: "solana", name: "Solana", caption: "Mainnet Beta", networks: ["Solana"], symbol: "SOL", address: "Fq8kU7JtyKvnJsZJafXa6GfgjciFDKiNCDSYc5D2FfWy", confirmations: 32, minimum: "0.01 SOL" },
  { key: "tron", name: "TRON", caption: "TRC-20", networks: ["TRON"], symbol: "TRX", address: "TLEvwMieGYSv8pBP5s1nGBJ8nYVPPokeXG", confirmations: 19, minimum: "1 TRX" },
  { key: "ton", name: "TON", caption: "The Open Network", networks: ["TON"], symbol: "TON", address: "UQBGvjFGRxPGyXyABYk7IyZBDUr6nkWu0z5f_68vkyG47GIW", confirmations: 1, minimum: "0.1 TON" },
  { key: "sui", name: "Sui", caption: "Mainnet", networks: ["Sui"], symbol: "SUI", address: "0x73f60bf23b7d5b3eee0b5a4d1dba2c5b461fe7272c6809f9d92a4c529523a7e5", confirmations: 6, minimum: "0.5 SUI" },
]

export const CHAIN_GROUPS: ChainGroup[] = CHAIN_META.map((c) => {
  const assets = BALANCE_ROWS.filter((r) => c.networks.includes(r.network))
  return { ...c, assets, value: assets.reduce((s, r) => s + r.value, 0) }
}).sort((a, b) => b.value - a.value)

export const CHAINS_TOTAL = CHAIN_GROUPS.reduce((s, c) => s + c.value, 0)

/* ── Wallet activity ────────────────────────────────────────────────────────
   Deposits and withdrawals, not trades — this is the wallet, and what a
   trading platform shows here is MOVEMENT with a settlement state attached. */

export type Movement = {
  id: string
  kind: "deposit" | "withdrawal" | "transfer"
  symbol: string
  amount: number
  usd: number
  network: string
  status: "completed" | "pending" | "failed"
  /** Confirmations seen / needed. Only meaningful while pending. */
  confirmations?: [number, number]
  /** Fixed minute offsets — no clock read, so SSR stays stable. */
  minutesAgo: number
  txid: string
}

export const MOVEMENTS: Movement[] = [
  { id: "m1", kind: "deposit", symbol: "USDT", amount: 1200, usd: 1200, network: "TRON", status: "completed", minutesAgo: 24, txid: "a3f9c1d7e5b2" },
  { id: "m2", kind: "deposit", symbol: "ETH", amount: 0.42, usd: 1379.33, network: "Arbitrum One", status: "pending", confirmations: [7, 12], minutesAgo: 41, txid: "0x7c4e91ab35d0" },
  { id: "m3", kind: "transfer", symbol: "USDC", amount: 500, usd: 500, network: "Spot → Futures", status: "completed", minutesAgo: 186, txid: "internal-8841" },
  { id: "m4", kind: "withdrawal", symbol: "BTC", amount: 0.012, usd: 1157.05, network: "Bitcoin", status: "completed", minutesAgo: 640, txid: "9d2b71fc4a08" },
  { id: "m5", kind: "withdrawal", symbol: "SOL", amount: 14.2, usd: 2592.21, network: "Solana", status: "failed", minutesAgo: 1180, txid: "5Kq8nRtYuV3w" },
  { id: "m6", kind: "deposit", symbol: "TON", amount: 150, usd: 807, network: "TON", status: "completed", minutesAgo: 1420, txid: "UQc41fRb9Xe2" },
]

/* ── Security posture ───────────────────────────────────────────────────── */

export const WITHDRAWAL_LIMIT = { used: 12_400, total: 100_000 }

export const SECURITY_FLAGS: { label: string; done: boolean }[] = [
  { label: "Two-factor authentication", done: true },
  { label: "Anti-phishing code", done: true },
  { label: "Withdrawal whitelist", done: false },
]

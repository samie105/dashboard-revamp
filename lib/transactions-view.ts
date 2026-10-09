/**
 * What the redesigned transactions page says about a transaction.
 *
 * The rules are the ones the previous page used
 * (components/transactions/transactions-client.tsx), lifted out unchanged so
 * the new markup and the old page cannot tell a different story about the
 * same row: which way the money went, what to call it, who it was with, which
 * explorer shows it. The few additions (day label with a supplied clock, the
 * 14-day net bars, the history filters, the timeline steps) are pure, so
 * they are tested here rather than in a browser.
 */

import { orderAmountText, orderLabel, orderStateLabel, type HistoryRow } from "@/lib/fiat-history"
import type { UnifiedTransaction, UnifiedTransactionStatus } from "@/types/transactions"

export type Direction = "in" | "out" | "neutral"

/** Which way the money went. Unchanged from the previous page. */
export function directionOf(tx: UnifiedTransaction): Direction {
  switch (tx.type) {
    case "deposit":
    case "spot_deposit":
      return "in"
    case "withdrawal":
      return "out"
    case "p2p":
      return tx.subType === "buy" ? "in" : "out"
    case "transfer":
      if (tx.subType === "receive" || tx.direction === "incoming") return "in"
      if (tx.subType === "send" || tx.direction === "outgoing") return "out"
      return "neutral"
    default:
      return "neutral"
  }
}

export function isInternal(tx: UnifiedTransaction) {
  return tx.type === "transfer" && (tx.subType === "internal" || Boolean(tx.direction?.includes("-to-")))
}

/** A failed, cancelled or expired transaction moved nothing. */
export function isStopped(status: UnifiedTransactionStatus) {
  return status === "failed" || status === "cancelled" || status === "expired"
}

/** The preview's four row glyphs, chosen by what the row is. */
export type KindGlyph = "in" | "out" | "swap" | "trade"

export function glyphOf(tx: UnifiedTransaction): KindGlyph {
  if (tx.type === "swap" || isInternal(tx)) return "swap"
  if (tx.type === "spot_trade" || tx.type === "spot_order") return "trade"
  return directionOf(tx) === "in" ? "in" : "out"
}

/** Unchanged from the previous page. */
export function typeLabel(tx: UnifiedTransaction) {
  switch (tx.type) {
    case "deposit":
      return tx.subType === "onchain" ? "Received" : "Deposit"
    case "spot_deposit":
      return "Spot deposit"
    case "withdrawal":
      return "Withdrawal"
    case "p2p":
      return tx.subType === "buy" ? "P2P deposit" : "P2P withdrawal"
    case "spot_trade":
    case "spot_order":
      return tx.pair ? `Trade ${tx.pair}` : "Spot trade"
    case "swap":
      return "Swap"
    case "transfer":
      if (isInternal(tx)) return "Internal transfer"
      return directionOf(tx) === "in" ? "Received" : "Sent"
    default:
      return "Transaction"
  }
}

/** A row's name: the order's own words for a fiat order, else as above. */
export function labelOf(row: HistoryRow) {
  return row.order ? orderLabel(row.order) : typeLabel(row)
}

const CHAIN_LABELS: Record<string, string> = {
  ethereum: "Ethereum",
  arbitrum: "Arbitrum",
  solana: "Solana",
  sui: "Sui",
  ton: "TON",
  tron: "Tron",
}

export function chainLabel(chain?: string) {
  if (!chain) return undefined
  return CHAIN_LABELS[chain] ?? chain.charAt(0).toUpperCase() + chain.slice(1)
}

/** Unchanged from the previous page, including its Solscan fallback. */
export function explorerUrl(chain: string | undefined, txHash: string) {
  switch (chain) {
    case "ethereum": return `https://etherscan.io/tx/${txHash}`
    case "arbitrum": return `https://arbiscan.io/tx/${txHash}`
    case "sui": return `https://suiscan.xyz/mainnet/tx/${txHash}`
    case "tron": return `https://tronscan.org/#/transaction/${txHash}`
    default: return `https://solscan.io/tx/${txHash}`
  }
}

export function truncateMiddle(s: string, head = 8, tail = 6) {
  return s.length <= head + tail + 1 ? s : `${s.slice(0, head)}…${s.slice(-tail)}`
}

export function fmtAmount(n: number, digits = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: Math.max(digits, 6) })
}

const CURRENCY_SYMBOLS: Record<string, string> = { NGN: "₦", USD: "$", GBP: "£", EUR: "€" }

export function fmtFiat(amount: number, currency = "USD") {
  return `${CURRENCY_SYMBOLS[currency] || ""}${fmtAmount(amount)}${currency === "USD" ? "" : ` ${currency}`}`
}

/** Who it was with, for the row's second column. Same rules as before. */
export function counterparty(tx: UnifiedTransaction): string | null {
  if (tx.type === "swap" && tx.toToken) {
    const to = tx.toAmount != null ? `${fmtAmount(Number(tx.toAmount))} ${tx.toToken}` : tx.toToken
    return `→ ${to}`
  }
  if (tx.bankDetails) return `to ${tx.bankDetails.bankName}`
  if (tx.pair) return tx.pair
  const dir = directionOf(tx)
  if (dir === "in" && tx.fromAddress) return `from ${truncateMiddle(tx.fromAddress, 6, 4)}`
  if (dir === "out" && tx.toAddress) return `to ${truncateMiddle(tx.toAddress, 6, 4)}`
  if (tx.direction?.includes("-to-")) return tx.direction.replace(/-/g, " ").replace(" to ", " → ")
  if (isInternal(tx)) return "internal"
  return null
}

/** Signed amount for the primary leg: "+12.50 USDT", "−0.10 ETH". */
export function amountText(tx: UnifiedTransaction) {
  const d = directionOf(tx)
  const sign = d === "in" ? "+" : d === "out" ? "−" : ""
  return `${sign}${fmtAmount(tx.amount)} ${tx.token}`
}

const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()

/** Whole calendar days between the transaction and `now` (local time). */
export function daysAgo(iso: string, now: Date) {
  return Math.round((startOfDay(now) - startOfDay(new Date(iso))) / 86_400_000)
}

/** "Today" / "Yesterday" / "Monday, Oct 5" — the day group heading. */
export function dayLabel(iso: string, now: Date) {
  const days = daysAgo(iso, now)
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  const d = new Date(iso)
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  })
}

/**
 * Net flow per day for the last `days` days, oldest first: money in minus
 * money out, in USD, from the rows on screen. A stopped transaction moved
 * nothing, and a row without a valuation adds nothing (it is not a $0 day).
 */
export function netByDay(transactions: UnifiedTransaction[], now: Date, days = 14): number[] {
  const out = Array.from({ length: days }, () => 0)
  for (const tx of transactions) {
    if (isStopped(tx.status) || tx.valueUsd == null) continue
    const ago = daysAgo(tx.createdAt, now)
    if (ago < 0 || ago >= days) continue
    const d = directionOf(tx)
    if (d === "in") out[days - 1 - ago] += tx.valueUsd
    else if (d === "out") out[days - 1 - ago] -= tx.valueUsd
  }
  return out
}

/* ── Timeline ─────────────────────────────────────────────────────────────
   The previous page's tracker (Submitted → Processing → Completed, or
   Submitted → Failed / Cancelled / Expired), drawn as the preview's vertical
   steps. Only states the record actually carries; no invented hints. */

export type StepState = "done" | "current" | "failed" | "todo"
export type Step = { label: string; at?: string; state: StepState }

export function stepsFor(tx: UnifiedTransaction): Step[] {
  switch (tx.status) {
    case "failed":
      return [
        { label: "Submitted", at: tx.createdAt, state: "done" },
        { label: "Failed", at: tx.completedAt, state: "failed" },
      ]
    case "cancelled":
    case "expired":
      return [
        { label: "Submitted", at: tx.createdAt, state: "done" },
        { label: tx.status === "cancelled" ? "Cancelled" : "Expired", at: tx.completedAt, state: "failed" },
      ]
    case "pending":
      return [
        { label: "Submitted", at: tx.createdAt, state: "current" },
        { label: "Processing", state: "todo" },
        { label: "Completed", state: "todo" },
      ]
    case "processing":
      return [
        { label: "Submitted", at: tx.createdAt, state: "done" },
        { label: "Processing", state: "current" },
        { label: "Completed", state: "todo" },
      ]
    default:
      return [
        { label: "Submitted", at: tx.createdAt, state: "done" },
        { label: "Processing", state: "done" },
        { label: "Completed", at: tx.completedAt, state: "done" },
      ]
  }
}

/* ── Traded ───────────────────────────────────────────────────────────────
   The preview's "Traded" card, from the rows on screen: what the swaps and
   spot trades that went through were worth. Unknown (null) while any of them
   has no valuation, rather than a total that quietly skips some. */

export function tradedSummary(transactions: UnifiedTransaction[]) {
  const legs = transactions.filter(
    (tx) => !isStopped(tx.status) && (tx.type === "swap" || tx.type === "spot_trade" || tx.type === "spot_order"),
  )
  const usd = legs.every((tx) => tx.valueUsd != null) ? legs.reduce((s, tx) => s + (tx.valueUsd ?? 0), 0) : null
  return {
    usd,
    trades: legs.filter((tx) => tx.type !== "swap").length,
    swaps: legs.filter((tx) => tx.type === "swap").length,
  }
}

/* ── CSV ──────────────────────────────────────────────────────────────────
   The preview's Export CSV, with the record's real fields. Cells that a
   spreadsheet would run as a formula are prefixed with a quote. */

const CSV_HEAD = ["Reference", "Date", "Type", "Status", "Asset", "Amount", "To asset", "To amount", "Network", "From", "To", "Hash", "USD value"]

function csvCell(v: unknown) {
  let s = v == null ? "" : String(v)
  if (/^[=+@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function transactionsCsv(rows: HistoryRow[]): string {
  const body = rows.map((tx) =>
    [
      tx.order?.publicReference ?? tx.id,
      tx.createdAt,
      labelOf(tx),
      tx.order ? orderStateLabel(tx.order.state) : tx.status,
      tx.token,
      tx.order ? orderAmountText(tx.order) : tx.amount,
      tx.toToken,
      tx.toAmount,
      tx.order ? tx.order.network : chainLabel(tx.chain),
      tx.fromAddress,
      tx.toAddress,
      tx.txHash,
      tx.valueUsd != null ? tx.valueUsd.toFixed(2) : "",
    ]
      .map(csvCell)
      .join(","),
  )
  return [CSV_HEAD.join(","), ...body].join("\n")
}

/* ── History filters (the preview's controls) ─────────────────────────────
   Applied to the rows the hook returns, as the preview does, so the tab
   counts and the "n of m" line come from one list. Nothing is hidden: the
   preview's three statuses cover all six (Pending = pending + processing,
   Failed = failed + cancelled + expired). */

export type KindKey = "all" | "deposit" | "withdrawal" | "swap" | "trade" | "transfer"
export type StatusKey = "any" | "completed" | "pending" | "failed"
export type HistoryRange = "7d" | "30d" | "all"

export const KIND_FILTERS: { key: KindKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "deposit", label: "Deposits" },
  { key: "withdrawal", label: "Withdrawals" },
  { key: "swap", label: "Swaps" },
  { key: "trade", label: "Trades" },
  { key: "transfer", label: "Transfers" },
]

export const STATUS_FILTERS: { key: StatusKey; label: string }[] = [
  { key: "any", label: "Any" },
  { key: "completed", label: "Completed" },
  { key: "pending", label: "Pending" },
  { key: "failed", label: "Failed" },
]

export const RANGE_FILTERS: { key: HistoryRange; label: string }[] = [
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "all", label: "All" },
]

const RANGE_DAYS: Record<HistoryRange, number> = { "7d": 7, "30d": 30, all: Infinity }

/** Which tab a row belongs to. Types map as the previous tabs did; spot
 *  trades and orders get the preview's Trades tab. */
export function kindOf(tx: UnifiedTransaction): Exclude<KindKey, "all"> | null {
  switch (tx.type) {
    case "deposit":
    case "withdrawal":
    case "swap":
    case "transfer":
      return tx.type
    case "spot_trade":
    case "spot_order":
      return "trade"
    default:
      return null
  }
}

export function statusGroup(status: UnifiedTransactionStatus): Exclude<StatusKey, "any"> {
  if (status === "pending" || status === "processing") return "pending"
  if (status === "completed") return "completed"
  return "failed"
}

/** Every filter but the type tab, so each tab's badge counts what it would show. */
export function filterBase<T extends HistoryRow>(
  rows: T[],
  f: { status: StatusKey; range: HistoryRange; query: string },
  now: Date,
): T[] {
  const q = f.query.trim().toLowerCase()
  return rows.filter(
    (tx) =>
      (f.status === "any" || statusGroup(tx.status) === f.status) &&
      daysAgo(tx.createdAt, now) < RANGE_DAYS[f.range] &&
      (!q ||
        [tx.id, tx.token, tx.fromToken, tx.toToken, tx.txHash, tx.fromAddress, tx.toAddress, chainLabel(tx.chain), labelOf(tx), tx.order?.publicReference, tx.fiatCurrency]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q))),
  )
}

export function filterKind<T extends UnifiedTransaction>(rows: T[], kind: KindKey): T[] {
  return kind === "all" ? rows : rows.filter((tx) => kindOf(tx) === kind)
}

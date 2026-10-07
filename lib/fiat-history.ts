/**
 * Fiat orders as rows of the transactions history.
 *
 * GET /fiat/orders is listed in the history beside the wallet's ledger, so a
 * buy or sell with bank money reads as one more thing the user did. Each order
 * becomes a `HistoryRow`: the shape the list already filters, groups and
 * selects, with the original order attached for its own detail panel.
 *
 * Display only. The order's `state` stays the source of truth (guide §11,
 * docs/fiat-frontend-integration-guide.md line 1022: "The backend's state is
 * the product-level source of truth"); the row status below only decides
 * which status filter it falls under and how the chip looks.
 *
 * There is no documented field linking an order to the wallet transaction it
 * produced, so the two are never merged: a completed buy also shows as its
 * own "Received" row, and the order's detail says so.
 */

import { instructedAmount } from "@/lib/crypto-backend/fiat-onramp"
import { FIAT_ORDER_PAUSE_STATES, FIAT_ORDER_TERMINAL_STATES } from "@/lib/crypto-backend/fiat-poll-schedule"
import type { FiatOrder, FiatQuote } from "@/lib/crypto-backend/types"
import type { PendingFlowKind } from "@/lib/pending-flow"
import type { UnifiedTransaction, UnifiedTransactionStatus } from "@/types/transactions"

export type HistoryRow = UnifiedTransaction & { order?: FiatOrder }

/**
 * The asset's public symbol. Orders carry it as `ethereum:usdc` (guide
 * line 804), or, for Bridge, the canonical USDC contract the backend stored
 * from the browser's `USDC` (guide lines 975-976: "The browser sends the
 * public `USDC` symbol. The backend resolves and stores the canonical
 * WorldStreet USDC contract"). Anything else is shown as given, shortened.
 */
export function orderAssetSymbol(order: Pick<FiatOrder, "asset" | "provider">): string {
  const { asset } = order
  if (asset.includes(":") && !asset.startsWith("0x")) return asset.split(":").pop()!.toUpperCase()
  if (asset.startsWith("0x")) return order.provider === "bridge" ? "USDC" : `${asset.slice(0, 6)}…${asset.slice(-4)}`
  return asset.toUpperCase()
}

export function orderLabel(order: FiatOrder): string {
  const asset = orderAssetSymbol(order)
  return order.direction === "onramp" ? `Buy ${asset} with ${order.currency}` : `Sell ${asset} for ${order.currency}`
}

/** "awaiting_bank_deposit" → "Awaiting bank deposit". */
export function orderStateLabel(state: string): string {
  const words = state.replaceAll("_", " ")
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** "ethereum-mainnet" → "Ethereum Mainnet". */
export function networkLabel(network: string): string {
  return network
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

const PROCESSING = new Set(["crypto_submitted", "provider_processing", "scheduled", "refund_in_flight"])
const FAILED = new Set(["failed", "reversed", "refunded", "refund_failed"])

/** Which status filter the order falls under: §11's problem states under
 *  Failed, every state still moving (or paused for review) under Pending. */
export function orderStatus(state: string): UnifiedTransactionStatus {
  if (state === "completed") return "completed"
  if (state === "expired") return "expired"
  if (state === "cancelled") return "cancelled"
  if (FAILED.has(state)) return "failed"
  if (PROCESSING.has(state)) return "processing"
  return "pending"
}

export type OrderChipTone = "live" | "review" | "done" | "bad" | "quiet"

/** The chip: short enough for the status column; the detail panel carries
 *  the full state. Grouped by the §11 meanings (guide lines 1028-1037). */
export function orderChip(state: string): { label: string; tone: OrderChipTone } {
  switch (state) {
    case "created":
    case "quoted":
      return { label: "Started", tone: "live" }
    case "awaiting_bank_deposit":
    case "awaiting_crypto_deposit":
    case "crypto_intent_ready":
      return { label: "Action needed", tone: "live" }
    case "crypto_submitted":
    case "provider_processing":
    case "scheduled":
      return { label: "Processing", tone: "live" }
    case "manual_review":
    case "blocked":
      return { label: "In review", tone: "review" }
    case "refund_in_flight":
      return { label: "Refunding", tone: "live" }
    case "completed":
      return { label: "Completed", tone: "done" }
    case "failed":
    case "reversed":
    case "refund_failed":
      return { label: orderStateLabel(state), tone: "bad" }
    case "refunded":
    case "expired":
    case "cancelled":
      return { label: orderStateLabel(state), tone: "quiet" }
    default:
      return { label: orderStateLabel(state), tone: "live" }
  }
}

function formatOrderAmount(value: string | undefined, unit: string): string | null {
  if (!value) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return `${value} ${unit}`
  return `${parsed.toLocaleString("en-US", { maximumFractionDigits: 8 })} ${unit}`
}

/**
 * A sell's crypto amount. The sell flows read `cryptoIntent.normalizedSummary
 * .amount` (components/fiat/sell/FiatSellFlow.tsx:130, BridgeUsdSell.tsx:103);
 * the guide's example puts `amount` / `asset` on the intent itself (guide
 * lines 851-852), which lib/crypto-backend/types.ts:83 does not declare.
 * Both are read, the flows' field first.
 */
function intentAmount(order: FiatOrder): { amount?: string; asset?: string } {
  const intent = order.cryptoIntent as (FiatOrder["cryptoIntent"] & { amount?: string; asset?: string }) | undefined
  if (!intent) return {}
  const summary = intent.normalizedSummary
  return {
    amount: summary?.amount ?? intent.amount,
    asset: intent.asset,
  }
}

/** The amounts the previous order list showed, formatted the same way, plus
 *  a sell's crypto amount and a buy's requested bank amount. For a buy, only
 *  `amount` / `currency` are read from its payment instructions
 *  (instructedAmount); the rest of `providerDisplay` is never rendered. */
export function orderAmounts(order: FiatOrder) {
  const intent = intentAmount(order)
  const asked = order.direction === "onramp" ? instructedAmount(order.providerDisplay) : null
  return {
    requested: asked ? formatOrderAmount(asked.amount, asked.currency ?? order.currency) : null,
    expected: formatOrderAmount(order.expectedDepositAmount, order.currency),
    observed: formatOrderAmount(order.observedDepositAmount, order.observedDepositAsset ? orderAssetSymbol({ asset: order.observedDepositAsset, provider: order.provider }) : orderAssetSymbol(order)),
    sending: order.direction === "offramp" ? formatOrderAmount(intent.amount, intent.asset ?? orderAssetSymbol(order)) : null,
  }
}

export function orderAmountText(order: FiatOrder): string | null {
  const { expected, observed, sending, requested } = orderAmounts(order)
  return expected ?? observed ?? sending ?? requested
}

/** Resume an unfinished order through the existing pending-flow path.
 *  Unchanged from components/fiat/history/FiatOrderHistory.tsx. */
export function orderRecovery(order: FiatOrder): { kind: PendingFlowKind; href: string; label: string } | null {
  if (FIAT_ORDER_TERMINAL_STATES.has(order.state) || FIAT_ORDER_PAUSE_STATES.has(order.state)) return null
  if (order.provider === "bridge" && order.direction === "offramp") {
    return { kind: "fiat-bridge-sell", href: "/sell", label: "Continue USD withdrawal" }
  }
  if (order.provider === "onswitch" && order.direction === "offramp") {
    return { kind: "fiat-sell", href: "/sell", label: "Continue local withdrawal" }
  }
  if (order.provider === "onswitch" && order.direction === "onramp") {
    return { kind: "fiat-buy", href: "/buy", label: "Continue fiat deposit" }
  }
  return null
}

const SENT_STATES = new Set(["crypto_submitted", "provider_processing", "scheduled", "completed"])

/** Why the same money may show twice: the wallet side of the order is its own row. */
export function orderWalletNote(order: FiatOrder): string | null {
  const asset = orderAssetSymbol(order)
  if (order.direction === "onramp" && order.state === "completed") {
    return `The ${asset} you bought also appears in this list as its own Received entry.`
  }
  if (order.direction === "offramp" && SENT_STATES.has(order.state)) {
    return `The ${asset} you sent also appears in this list as its own Sent entry.`
  }
  return null
}

export function orderToRow(order: FiatOrder): HistoryRow {
  const onramp = order.direction === "onramp"
  const amount = Number(
    onramp
      ? order.expectedDepositAmount ?? instructedAmount(order.providerDisplay)?.amount
      : order.expectedDepositAmount ?? order.observedDepositAmount ?? intentAmount(order).amount,
  )
  return {
    id: order.id,
    type: onramp ? "deposit" : "withdrawal",
    subType: onramp ? "fiat_buy" : "fiat_sell",
    direction: onramp ? "incoming" : "outgoing",
    amount: Number.isFinite(amount) ? amount : 0,
    token: orderAssetSymbol(order),
    chain: order.network,
    status: orderStatus(order.state),
    fiatCurrency: order.currency,
    txHash: order.observedDepositTxHash,
    createdAt: order.createdAt,
    completedAt: order.completedAt,
    order,
  }
}

/** Wallet rows and order rows, newest first. */
export function mergeHistory(transactions: UnifiedTransaction[], orders: FiatOrder[] | undefined): HistoryRow[] {
  if (!orders?.length) return transactions
  return [...transactions, ...orders.map(orderToRow)].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}

/**
 * What the order was quoted to deliver: the quote's `destinationAmount` /
 * `destinationCurrency` (guide lines 754-755), shown on the "you get" side
 * until the order reports what actually arrived. Only this order's own quote
 * is used, and only when it delivers what the order delivers: the order's
 * fiat currency for a sell, never a crypto figure on the bank side.
 */
export function quotedReceive(order: FiatOrder, quote: Pick<FiatQuote, "id" | "direction" | "destinationAmount" | "destinationCurrency"> | undefined): string | null {
  if (!quote || quote.id !== order.quoteId || quote.direction !== order.direction) return null
  if (order.direction === "offramp" && quote.destinationCurrency.toUpperCase() !== order.currency.toUpperCase()) return null
  return formatOrderAmount(quote.destinationAmount, quote.destinationCurrency)
}

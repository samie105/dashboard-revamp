/**
 * OnSwitch onramp logic for the Buy flow. Guide §5 (lines 207-381), §9.1-9.2
 * (lines 640-795), §11 (lines 947-984), §13 "OnSwitch local-fiat onramp"
 * (lines 1145-1156).
 *
 * The backend is the source of truth for capability, quotes and order state
 * (guide lines 10-12). The dashboard applies one product-level destination
 * filter below for the African buy UI; it can hide a backend-supported route,
 * but it never enables a route the backend did not return as wallet-ready.
 */

import type { CryptoBackendClient } from "./client"
import { CryptoBackendError } from "./errors"
import { displayRows, type DisplayRow } from "./fiat-display"
import { onswitchCorridors } from "./fiat-capabilities"
import { runIdempotentMutation } from "./fiat-idempotency"
import { FIAT_ORDER_TERMINAL_STATES } from "./fiat-poll-schedule"
import type { FiatCapabilitySnapshot, FiatOrder, FiatQuote } from "./types"

type OnrampClient = Pick<CryptoBackendClient, "createFiatQuote" | "createFiatOrder">
type OnrampDiscardClient = Pick<CryptoBackendClient, "discardFiatOrder">

/**
 * Networks currently exposed by the African local-currency buy UI.
 *
 * This is intentionally frontend-only. The backend may return additional
 * wallet-ready OnSwitch routes, but the dashboard should only present the two
 * destinations currently supported by the product: Ethereum and Solana.
 */
export const AFRICAN_BUY_NETWORKS = ["ethereum-mainnet", "solana-mainnet-beta"] as const

/** OnSwitch accepts only ASCII alphanumeric characters for inline holder names. */
export function normalizeOnswitchHolderName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
}

const AFRICAN_BUY_NETWORK_SET: ReadonlySet<string> = new Set(AFRICAN_BUY_NETWORKS)

/* ── Availability (guide §5 lines 368-377) ────────────────────────────── */

export type OnrampAvailability =
  | "loading"
  | "disabled" // "Hide or disable fiat actions."
  | "blocked" // "Show a non-actionable 'temporarily unavailable' state."
  | "discovery_only" // "do not show money-moving buttons"
  | "unavailable" // OnSwitch onramp route or every corridor is off
  | "available"

export function onrampAvailability(config: FiatCapabilitySnapshot | undefined): OnrampAvailability {
  if (!config) return "loading"
  if (!config.enabled || config.availability === "disabled") return "disabled"
  if (config.availability === "blocked") return "blocked"
  if (config.availability === "discovery_only") return "discovery_only"
  return onrampOptions(config).length > 0 ? "available" : "unavailable"
}

/* ── Options: corridor × channel × wallet-ready asset route ───────────── */

export interface OnrampOption {
  /** Stable key for selection state. */
  key: string
  countryCode: string
  countryName?: string
  currencyCode: string
  channel: string
  /** providerAssetId, sent as `asset` (guide line 654). */
  asset: string
  /** localNetworkId, sent as `network` (guide line 655). */
  network: string
  symbol: string
}

/**
 * Every option the UI may offer. Guide lines 375-377: a coverage item and an
 * assetRoutes item must both be enabled and wallet-ready. A route with no
 * localNetworkId can't be quoted (there's no `network` to send), so it's
 * left out rather than guessed. The product allowlist also removes networks
 * that are valid in the backend contract but not exposed in this UI.
 */
export function onrampOptions(config: FiatCapabilitySnapshot | undefined): OnrampOption[] {
  const options: OnrampOption[] = []
  for (const { coverage, assetRoutes } of onswitchCorridors(config, "onramp")) {
    for (const channel of coverage.channels) {
      for (const route of assetRoutes) {
        if (!route.localNetworkId || !AFRICAN_BUY_NETWORK_SET.has(route.localNetworkId)) continue
        options.push({
          key: [coverage.countryCode, coverage.currencyCode, channel, route.providerAssetId, route.localNetworkId].join("|"),
          countryCode: coverage.countryCode,
          countryName: coverage.countryName,
          currencyCode: coverage.currencyCode,
          channel,
          asset: route.providerAssetId,
          network: route.localNetworkId,
          symbol: route.symbol,
        })
      }
    }
  }
  return options
}

/* ── Quote (guide §9.1 lines 641-705) ─────────────────────────────────── */

export type OnrampQuoteRequest = Parameters<OnrampClient["createFiatQuote"]>[0]

/** A positive decimal. Anything finer (limits, precision) is the backend's call. */
export function isValidAmount(amount: string): boolean {
  return /^\d+(\.\d+)?$/.test(amount.trim()) && Number(amount) > 0
}

/** The guide's onramp request body (lines 646-657), built from a config option. */
export function buildOnrampQuoteRequest(option: OnrampOption, amount: string): OnrampQuoteRequest {
  return {
    provider: "onswitch",
    direction: "onramp",
    country: option.countryCode,
    currency: option.currencyCode,
    channel: option.channel,
    amount: amount.trim(),
    asset: option.asset,
    network: option.network,
    exactOutput: false,
  }
}

/**
 * POST /fiat/quotes under an idempotency key scoped to the exact request.
 * After a success the key is released, so asking again for the same amount
 * (e.g. after expiry, guide line 701) gets a new key.
 */
export function requestOnrampQuote(client: OnrampClient, request: OnrampQuoteRequest): Promise<FiatQuote> {
  return runIdempotentMutation("quote", { ...request }, (key) => client.createFiatQuote(request, key))
}

/** Seconds until the quote expires (0 when expired or unparseable). Guide line 700: "Display the quote expiry." */
export function quoteSecondsLeft(quote: Pick<FiatQuote, "expiresAt">, now: number = Date.now()): number {
  const expires = Date.parse(quote.expiresAt)
  if (!Number.isFinite(expires)) return 0
  return Math.max(0, Math.floor((expires - now) / 1000))
}

/**
 * Whether an order can still be placed against this quote. Guide line 700:
 * "A quote is not a payment and does not reserve funds." The guide shows
 * only `state: "active"`, so anything else, or a passed expiry, needs a new
 * quote. The backend has the final word (FIAT_QUOTE_NOT_ACTIVE, line 971).
 */
export function isQuoteUsable(quote: Pick<FiatQuote, "expiresAt" | "state">, now: number = Date.now()): boolean {
  return quote.state === "active" && quoteSecondsLeft(quote, now) > 0
}

/* ── Order (guide §9.2 lines 707-757) ─────────────────────────────────── */

/**
 * POST /fiat/orders for an OnSwitch onramp. The key is scoped to
 * (walletId, quoteId): a double-click or a retry after a timeout reuses it,
 * so the backend replays the same order (guide lines 968-969, 974-975).
 */
export function createOnrampOrder(
  client: OnrampClient,
  input: { walletId: string; quoteId: string; holderName?: string },
): Promise<FiatOrder> {
  const holderName = input.holderName ? normalizeOnswitchHolderName(input.holderName) : undefined
  const body = {
    provider: "onswitch" as const,
    walletId: input.walletId,
    quoteId: input.quoteId,
    ...(holderName ? { holderName } : {}),
  }
  return runIdempotentMutation("order", body, (key) => client.createFiatOrder(body, key))
}

export function discardOnrampOrder(client: OnrampDiscardClient, orderId: string): Promise<FiatOrder> {
  return runIdempotentMutation("discard", { orderId }, (key) => client.discardFiatOrder(orderId, key))
}

/** Guide line 970-971: "Re-quote when the backend returns FIAT_QUOTE_NOT_ACTIVE." */
export function needsRequote(error: unknown): boolean {
  return error instanceof CryptoBackendError && error.code === "FIAT_QUOTE_NOT_ACTIVE"
}

/* ── Order state → screen (guide §11 lines 952-963) ───────────────────── */

export type OnrampOrderScreen =
  | "continue" // created / quoted
  | "pay" // awaiting_bank_deposit
  | "processing" // provider_processing / scheduled, and the crypto_* states
  | "completed"
  | "review" // manual_review / blocked
  | "problem" // failed / reversed / refund_in_flight / refunded / refund_failed
  | "unknown" // a state the guide doesn't list

export interface OnrampOrderView {
  screen: OnrampOrderScreen
  /**
   * True for end states (completed, failed, reversed, refunded,
   * refund_failed; see FIAT_ORDER_TERMINAL_STATES and open question 10).
   * Not terminal: manual_review / blocked (automatic polling stops, guide
   * line 962, but the order can still move) and refund_in_flight (still
   * polled, slowly). Both stay resumable.
   */
  terminal: boolean
  /** The backend's reason for review/problem states, as plain text, if any. */
  reason?: string
}

const SCREEN_BY_STATE: Record<string, OnrampOrderScreen> = {
  created: "continue",
  quoted: "continue",
  awaiting_bank_deposit: "pay",
  awaiting_crypto_deposit: "processing",
  crypto_intent_ready: "processing",
  crypto_submitted: "processing",
  provider_processing: "processing",
  scheduled: "processing",
  completed: "completed",
  expired: "problem",
  cancelled: "problem",
  manual_review: "review",
  blocked: "review",
  failed: "problem",
  reversed: "problem",
  refund_in_flight: "problem",
  refunded: "problem",
  refund_failed: "problem",
}

/**
 * The screen for an order is driven by `state` only. `providerStatus` is
 * diagnostics (guide lines 948-950) and the HTTP status of the create call
 * never matters: 201 "does not mean the fiat payment settled" (lines 966-967).
 *
 * The reason shown for review/problem states comes from whichever of
 * failureReason / reviewReason / refundReason (types.ts FiatOrder) the
 * backend filled in; which field it uses per state is open question 16.
 */
export function onrampOrderView(order: Pick<FiatOrder, "state" | "failureReason" | "reviewReason" | "refundReason">): OnrampOrderView {
  const screen = SCREEN_BY_STATE[order.state] ?? "unknown"
  const terminal = FIAT_ORDER_TERMINAL_STATES.has(order.state)
  const reason =
    screen === "review" || screen === "problem"
      ? [order.reviewReason, order.refundReason, order.failureReason].find(
          (value): value is string => typeof value === "string" && value.trim() !== "",
        )
      : undefined
  return { screen, terminal, ...(reason ? { reason } : {}) }
}

/* ── Status stages (guide §11 lines 954-961) ──────────────────────────── */

/**
 * The staged checklist on the order status screen, one stage per §11 state
 * group an onramp passes through. Labels restate the guide's "UI meaning"
 * column; they don't add states.
 */
export const ONRAMP_STAGES: ReadonlyArray<{ key: string; label: string }> = [
  { key: "created", label: "Order created" }, // created / quoted
  { key: "awaiting_bank_deposit", label: "Waiting for your bank payment" },
  { key: "provider_processing", label: "Payment being processed" }, // provider_processing / scheduled
  { key: "completed", label: "Delivered to your wallet" },
]

/**
 * Which stage is in flight for a state. Returns ONRAMP_STAGES.length once
 * completed (the checklist then shows every stage done), or null for states
 * that aren't on the happy path (review, problem, unknown), which the screen
 * shows without the checklist.
 */
export function onrampStageIndex(state: string): number | null {
  switch (state) {
    case "created":
    case "quoted":
      return 0
    case "awaiting_bank_deposit":
      return 1
    case "provider_processing":
    case "scheduled":
    case "awaiting_crypto_deposit":
    case "crypto_intent_ready":
    case "crypto_submitted":
      return 2
    case "completed":
      return ONRAMP_STAGES.length
    default:
      return null
  }
}

/* ── Payment instructions (guide §9.2 lines 740-757) ──────────────────── */

export type InstructionRow = DisplayRow

export interface PaymentInstructions {
  rows: InstructionRow[]
  expiresAt?: string
}

const INSTRUCTION_LABELS: Record<string, string> = {
  amount: "Amount",
  currency: "Currency",
  bankName: "Bank",
  bank_name: "Bank",
  accountName: "Account name",
  account_name: "Account name",
  accountNumber: "Account number",
  account_number: "Account number",
  reference: "Reference",
  expires_at: "Expires at",
  asset: "Asset",
  note: "Note",
}

const INSTRUCTION_SENSITIVE_KEYS: ReadonlySet<string> = new Set(["accountNumber", "account_number", "iban", "routingNumber", "routing_number"])

function instructionRecord(providerDisplay: FiatOrder["providerDisplay"]): Record<string, unknown> | undefined {
  if (!providerDisplay || typeof providerDisplay !== "object" || Array.isArray(providerDisplay)) return undefined
  const display = providerDisplay as Record<string, unknown>
  for (const key of ["paymentInstructions", "payment_instructions", "deposit", "source_deposit_instructions"]) {
    const value = display[key]
    if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>
  }
  return undefined
}

/**
 * "providerDisplay is a sanitized display object. Render only the fields
 * returned by the backend and treat the instructions as expiring. Do not
 * infer bank details from the quote." (guide lines 755-757)
 *
 * Reads the documented paymentInstructions shape and the provider's current
 * nested deposit shape (`providerDisplay.deposit`, with snake_case fields)
 * through the shared displayRows helper. expiresAt/expires_at is pulled out
 * for the countdown. If the backend sends no instructions, there are no rows.
 */
export function paymentInstructionsFrom(providerDisplay: FiatOrder["providerDisplay"]): PaymentInstructions {
  const raw = instructionRecord(providerDisplay)
  if (!raw) return { rows: [] }
  const rows = displayRows(raw, {
    labels: INSTRUCTION_LABELS,
    sensitiveKeys: INSTRUCTION_SENSITIVE_KEYS,
    skipKeys: new Set(["expiresAt", "expires_at"]),
  })
  const expiresAt = raw.expiresAt ?? raw.expires_at
  return { rows, ...(typeof expiresAt === "string" ? { expiresAt } : {}) }
}


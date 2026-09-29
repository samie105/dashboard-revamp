/**
 * OnSwitch African fiat offramp logic for Sell. The provider remains the
 * source of truth for corridors and beneficiary fields; this module only
 * builds safe requests and maps backend order states to UI decisions.
 */

import type { CryptoBackendClient } from "./client"
import { CryptoBackendError } from "./errors"
import { isOnswitchOfframpAvailable, onswitchCorridors } from "./fiat-capabilities"
import { fiatFingerprint, runIdempotentMutation } from "./fiat-idempotency"
import { FIAT_ORDER_TERMINAL_STATES } from "./fiat-poll-schedule"
import { isValidAmount } from "./fiat-onramp"
import type {
  FiatBeneficiary,
  FiatBeneficiaryRequirement,
  FiatCapabilitySnapshot,
  FiatOrder,
  FiatQuote,
} from "./types"

type OfframpClient = Pick<
  CryptoBackendClient,
  "createFiatQuote" | "createFiatOrder" | "createFiatBeneficiary" | "confirmFiatOrder"
>
type OfframpDiscardClient = Pick<CryptoBackendClient, "discardFiatOrder">

export interface OfframpOption {
  key: string
  countryCode: string
  countryName?: string
  currencyCode: string
  channel: string
  asset: string
  network: string
  symbol: string
}

export function offrampOptions(config: FiatCapabilitySnapshot | undefined): OfframpOption[] {
  const options: OfframpOption[] = []
  for (const { coverage, assetRoutes } of onswitchCorridors(config, "offramp")) {
    for (const channel of coverage.channels) {
      for (const route of assetRoutes) {
        if (!route.localNetworkId) continue
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

export type OfframpAvailability = "loading" | "disabled" | "blocked" | "discovery_only" | "unavailable" | "available"

export function offrampAvailability(config: FiatCapabilitySnapshot | undefined): OfframpAvailability {
  if (!config) return "loading"
  if (!config.enabled || config.availability === "disabled") return "disabled"
  if (config.availability === "blocked") return "blocked"
  if (config.availability === "discovery_only") return "discovery_only"
  return isOnswitchOfframpAvailable(config) && offrampOptions(config).length > 0 ? "available" : "unavailable"
}

export type OfframpQuoteRequest = Parameters<OfframpClient["createFiatQuote"]>[0]

export function buildOfframpQuoteRequest(option: OfframpOption, amount: string): OfframpQuoteRequest {
  return {
    provider: "onswitch",
    direction: "offramp",
    country: option.countryCode,
    currency: option.currencyCode,
    channel: option.channel,
    amount: amount.trim(),
    asset: option.asset,
    network: option.network,
    exactOutput: false,
  }
}

export function requestOfframpQuote(client: OfframpClient, request: OfframpQuoteRequest): Promise<FiatQuote> {
  return runIdempotentMutation("quote", { ...request }, (key) => client.createFiatQuote(request, key))
}

export function createOfframpOrder(
  client: OfframpClient,
  input: { walletId: string; quoteId: string; beneficiaryId: string },
): Promise<FiatOrder> {
  const body = { provider: "onswitch" as const, ...input }
  return runIdempotentMutation("order", body, (key) => client.createFiatOrder(body, key))
}

export function discardOfframpOrder(client: OfframpDiscardClient, orderId: string): Promise<FiatOrder> {
  return runIdempotentMutation("discard", { orderId }, (key) => client.discardFiatOrder(orderId, key))
}

export function isOfframpQuoteUsable(quote: Pick<FiatQuote, "expiresAt" | "state">, now = Date.now()): boolean {
  const expiresAt = Date.parse(quote.expiresAt)
  return quote.state === "active" && Number.isFinite(expiresAt) && expiresAt > now
}

export function quoteSecondsLeft(quote: Pick<FiatQuote, "expiresAt">, now = Date.now()): number {
  const expiresAt = Date.parse(quote.expiresAt)
  return Number.isFinite(expiresAt) ? Math.max(0, Math.floor((expiresAt - now) / 1000)) : 0
}

export function needsOfframpRequote(error: unknown): boolean {
  return error instanceof CryptoBackendError && error.code === "FIAT_QUOTE_NOT_ACTIVE"
}

function same(value: string | undefined, expected: string): boolean {
  return value?.trim().toUpperCase() === expected.trim().toUpperCase()
}

export function verifiedOnswitchBeneficiaries(
  beneficiaries: FiatBeneficiary[] | undefined,
  option: Pick<OfframpOption, "countryCode" | "currencyCode" | "channel">,
): FiatBeneficiary[] {
  return (beneficiaries ?? []).filter((beneficiary) =>
    same(beneficiary.provider, "onswitch") &&
    same(beneficiary.direction, "offramp") &&
    same(beneficiary.country, option.countryCode) &&
    same(beneficiary.currency, option.currencyCode) &&
    same(beneficiary.channel, option.channel) &&
    (same(beneficiary.status, "ready") || (same(beneficiary.status, "verified") && same(beneficiary.ownershipStatus, "verified"))),
  )
}

function leaf(path: string): string {
  return path.split(/[.\[\]]/).filter(Boolean).at(-1) ?? path
}

export function automaticBeneficiaryField(path: string): boolean {
  return ["holder_type", "holder_name", "account_holder_name", "channel", "country", "currency"].includes(leaf(path))
}

export function beneficiaryFormValues(requirements: FiatBeneficiaryRequirement[], values: Readonly<Record<string, string>>, context: { holderName: string; channel: string; country: string; currency: string }): Record<string, string> {
  const automatic: Record<string, string> = { holder_type: "INDIVIDUAL", holder_name: context.holderName.trim(), account_holder_name: context.holderName.trim(), channel: context.channel, country: context.country, currency: context.currency }
  return Object.fromEntries(requirements.map((field) => [field.path, automatic[leaf(field.path)] ?? values[field.path] ?? ""]))
}

/** Provider lookup uses a country plus a beneficiary object. Raw values stay
 * in the component until this function is called for the POST mutation. */
export function buildOnswitchBeneficiaryPayload(input: {
  country: string
  holderName: string
  holderType: string
  channel?: string
  requirements: FiatBeneficiaryRequirement[]
  values: Readonly<Record<string, string>>
}): Record<string, unknown> {
  const beneficiary: Record<string, unknown> = {
    holder_type: "INDIVIDUAL",
    holder_name: input.holderName.trim(),
    ...(input.channel ? { channel: input.channel.toUpperCase() } : {}),
  }
  for (const requirement of input.requirements) {
    const value = input.values[requirement.path]?.trim()
    if (!value) continue
    const key = leaf(requirement.path)
    if (automaticBeneficiaryField(requirement.path)) continue
    const normalizedKey = key === "nuban_code" ? "bank_code" : key
    beneficiary[normalizedKey] = value
  }
  return { country: input.country.trim().toUpperCase(), beneficiary }
}

export function beneficiaryRequirementLabel(path: string): string {
  const name = leaf(path).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ")
  return name.replace(/^./, (value) => value.toUpperCase())
}

export function beneficiaryRequirementMatches(requirement: FiatBeneficiaryRequirement, value: string): boolean {
  if (!value.trim()) return !requirement.required
  if (!requirement.regex) return true
  try {
    return new RegExp(requirement.regex).test(value.trim())
  } catch {
    // A malformed provider hint must never crash the form. The backend still
    // validates the submitted payload and remains authoritative.
    return true
  }
}

export function createOnswitchBeneficiary(
  client: OfframpClient,
  input: {
    country: string
    currency: string
    channel: string
    holderName: string
    holderType: string
    requirements: FiatBeneficiaryRequirement[]
    values: Readonly<Record<string, string>>
  },
): Promise<FiatBeneficiary> {
  const providerPayload = buildOnswitchBeneficiaryPayload(input)
  const body = {
    provider: "onswitch" as const,
    direction: "offramp" as const,
    country: input.country.trim().toUpperCase(),
    currency: input.currency.trim().toUpperCase(),
    channel: input.channel.trim().toUpperCase(),
    holderName: input.holderName.trim(),
    holderType: "individual",
    providerPayload,
  }
  return runIdempotentMutation(
    "beneficiary-create",
    {
      provider: body.provider,
      direction: body.direction,
      country: body.country,
      currency: body.currency,
      channel: body.channel,
      form: fiatFingerprint(body),
    },
    (key) => client.createFiatBeneficiary(body, key),
  )
}

export function confirmOnswitchOrder(
  client: Pick<CryptoBackendClient, "confirmFiatOrder">,
  input: { orderId: string; transactionHash: string },
): Promise<FiatOrder> {
  return runIdempotentMutation(
    "confirm",
    { provider: "onswitch", orderId: input.orderId, transactionHash: input.transactionHash },
    (key) => client.confirmFiatOrder(input.orderId, input.transactionHash, key),
  )
}

export type OfframpOrderScreen = "continue" | "sign" | "processing" | "completed" | "review" | "problem" | "unknown"

export interface OfframpOrderView {
  screen: OfframpOrderScreen
  terminal: boolean
  reason?: string
}

const SCREEN_BY_STATE: Record<string, OfframpOrderScreen> = {
  created: "continue",
  quoted: "continue",
  awaiting_crypto_deposit: "sign",
  crypto_intent_ready: "sign",
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

export function offrampOrderView(order: Pick<FiatOrder, "state" | "failureReason" | "reviewReason" | "refundReason">): OfframpOrderView {
  const screen = SCREEN_BY_STATE[order.state] ?? "unknown"
  const reason = screen === "review" || screen === "problem"
    ? [order.reviewReason, order.refundReason, order.failureReason].find((value): value is string => Boolean(value?.trim()))
    : undefined
  return {
    screen,
    terminal: FIAT_ORDER_TERMINAL_STATES.has(order.state),
    ...(reason ? { reason } : {}),
  }
}

export const OFFRAMP_STAGES: ReadonlyArray<{ key: string; label: string }> = [
  { key: "created", label: "Order created" },
  { key: "crypto_submitted", label: "Crypto transfer submitted" },
  { key: "provider_processing", label: "Local payout being processed" },
  { key: "completed", label: "Fiat payout completed" },
]

export function offrampStageIndex(state: string): number | null {
  switch (state) {
    case "created":
    case "quoted":
      return 0
    case "awaiting_crypto_deposit":
    case "crypto_intent_ready":
      return 1
    case "crypto_submitted":
    case "provider_processing":
    case "scheduled":
      return 2
    case "completed":
      return OFFRAMP_STAGES.length
    default:
      return null
  }
}

export { isValidAmount }

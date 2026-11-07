import type { CryptoBackendClient } from "./client"
import { runIdempotentMutation } from "./fiat-idempotency"
import type { FiatOrder, PayoutBank, PayoutOption } from "./types"

type CompareClient = Pick<CryptoBackendClient, "compareFiatQuotes" | "createFiatOrderFromQuote" | "listFiatPayoutBanks">

export interface CompareRequest {
  amount: string
  asset: string
  network: string
  country: string
  currency: string
}

export interface PayoutAccount {
  bankId: string
  accountNumber: string
  holderName?: string
}

/** Quotes every available payout option. The result never names a provider. */
export async function requestPayoutOptions(client: CompareClient, request: CompareRequest): Promise<PayoutOption[]> {
  const result = await runIdempotentMutation("quote", { ...request }, (key) => client.compareFiatQuotes(request, key))
  return result.options
}

export function listPayoutBanks(client: CompareClient, quoteId: string, signal?: AbortSignal): Promise<PayoutBank[]> {
  return client.listFiatPayoutBanks(quoteId, signal)
}

/**
 * `revision` counts edits to the payout account. It stands in for the account
 * in the idempotency identity because bank details must never be part of one:
 * the same attempt retried reuses its key, a corrected account gets a new one.
 */
export function placePayoutOrder(client: CompareClient, input: { walletId: string; quoteId: string; payout: PayoutAccount; revision: number }): Promise<FiatOrder> {
  const { revision, ...body } = input
  return runIdempotentMutation("order", { walletId: input.walletId, quoteId: input.quoteId, bankId: input.payout.bankId, revision }, (key) => client.createFiatOrderFromQuote(body, key))
}

/** Compare is shown only when explicitly switched on at build time. */
export function isPayoutCompareEnabled(flag: string | undefined = process.env.NEXT_PUBLIC_FIAT_COMPARE_ENABLED): boolean {
  return flag === "true"
}

export function isValidAccountNumber(value: string): boolean {
  return /^\d{10}$/.test(value.trim())
}

export function isValidHolderName(value: string): boolean {
  return value.trim().length >= 3
}

export function payoutAccountReady(input: { bankId: string; accountNumber: string; holderName: string }): boolean {
  return input.bankId.length > 0 && isValidAccountNumber(input.accountNumber) && isValidHolderName(input.holderName)
}

export function tagLabel(tag: PayoutOption["tags"][number]): string {
  return tag === "best_rate" ? "Best rate" : "Fastest"
}

/** "About 2 min", "About 1 hr", or nothing when the speed is unknown. */
export function settlementLabel(seconds: number | undefined): string | null {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) return null
  if (seconds < 90) return "Under 2 min"
  if (seconds < 3600) return `About ${Math.round(seconds / 60)} min`
  return `About ${Math.round(seconds / 3600)} hr`
}

export function hasExtraFee(option: Pick<PayoutOption, "feeAmount">): boolean {
  return Number(option.feeAmount) > 0
}

/** Seconds until an option stops being valid, never negative. */
export function optionSecondsLeft(option: Pick<PayoutOption, "expiresAt">, now = Date.now()): number {
  return Math.max(0, Math.floor((new Date(option.expiresAt).getTime() - now) / 1000))
}

export function isOptionUsable(option: Pick<PayoutOption, "expiresAt">, now = Date.now()): boolean {
  return optionSecondsLeft(option, now) > 0
}

export function formatFiat(amount: string, currency: string): string {
  const value = Number(amount)
  if (!Number.isFinite(value)) return `${amount} ${currency}`
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 2 }).format(value)
  } catch {
    return `${value.toLocaleString()} ${currency}`
  }
}

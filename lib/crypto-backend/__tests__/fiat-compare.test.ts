import { describe, expect, it } from "vitest"
import {
  hasExtraFee,
  isOptionUsable,
  isPayoutCompareEnabled,
  isValidAccountNumber,
  optionSecondsLeft,
  payoutAccountReady,
  placePayoutOrder,
  requestPayoutOptions,
  settlementLabel,
  tagLabel,
} from "../fiat-compare"
import type { FiatOrder, PayoutOption } from "../types"

const option = (overrides: Partial<PayoutOption> = {}): PayoutOption => ({
  optionId: "o1", label: "Option A", sendAmount: "100", feeAmount: "0", totalDebit: "100", receiveAmount: "138000",
  receiveCurrency: "NGN", effectiveRate: 1380, rateGuaranteed: true, expiresAt: new Date(Date.now() + 60_000).toISOString(), tags: [], ...overrides,
})

describe("payout compare flag", () => {
  it("is off unless explicitly the string true", () => {
    expect(isPayoutCompareEnabled(undefined)).toBe(false)
    expect(isPayoutCompareEnabled("")).toBe(false)
    expect(isPayoutCompareEnabled("1")).toBe(false)
    expect(isPayoutCompareEnabled("TRUE")).toBe(false)
    expect(isPayoutCompareEnabled("true")).toBe(true)
  })
})

describe("payout account validation", () => {
  it("requires a ten digit account number, a bank and a holder name", () => {
    expect(isValidAccountNumber("0123456789")).toBe(true)
    for (const bad of ["012345678", "01234567890", "01234abcde", "", " 0123 456 789"]) expect(isValidAccountNumber(bad)).toBe(false)
    expect(payoutAccountReady({ bankId: "b1", accountNumber: "0123456789", holderName: "Ada Obi" })).toBe(true)
    expect(payoutAccountReady({ bankId: "", accountNumber: "0123456789", holderName: "Ada Obi" })).toBe(false)
    expect(payoutAccountReady({ bankId: "b1", accountNumber: "0123456789", holderName: "Ad" })).toBe(false)
  })
})

describe("option display helpers", () => {
  it("labels tags and speed, and stays silent about an unknown speed", () => {
    expect(tagLabel("best_rate")).toBe("Best rate")
    expect(tagLabel("fastest")).toBe("Fastest")
    expect(settlementLabel(undefined)).toBeNull()
    expect(settlementLabel(0)).toBeNull()
    expect(settlementLabel(60)).toBe("Under 2 min")
    expect(settlementLabel(600)).toBe("About 10 min")
    expect(settlementLabel(7200)).toBe("About 2 hr")
  })

  it("detects an extra fee only when it is above zero", () => {
    expect(hasExtraFee(option({ feeAmount: "1.2" }))).toBe(true)
    expect(hasExtraFee(option({ feeAmount: "0" }))).toBe(false)
    expect(hasExtraFee(option({ feeAmount: "" }))).toBe(false)
  })

  it("expires an option and never reports negative time", () => {
    const now = Date.parse("2026-11-07T10:00:00Z")
    expect(optionSecondsLeft({ expiresAt: "2026-11-07T10:05:00Z" }, now)).toBe(300)
    expect(optionSecondsLeft({ expiresAt: "2026-11-07T09:00:00Z" }, now)).toBe(0)
    expect(isOptionUsable({ expiresAt: "2026-11-07T09:00:00Z" }, now)).toBe(false)
  })
})

describe("compare client calls", () => {
  it("returns the options from the compare response", async () => {
    const client = { compareFiatQuotes: async () => ({ options: [option()] }) } as never
    await expect(requestPayoutOptions(client, { amount: "100", asset: "solana:usdc", network: "solana-mainnet-beta", country: "NG", currency: "NGN" })).resolves.toHaveLength(1)
  })

  it("never puts bank details in the idempotency identity", async () => {
    const client = { createFiatOrderFromQuote: async () => ({ id: "ok" }) } as never
    await expect(placePayoutOrder(client, { walletId: "w", quoteId: "q0", revision: 0, payout: { bankId: "b1", accountNumber: "0123456789", holderName: "Ada Obi" } })).resolves.toBeDefined()
  })

  it("sends a different idempotency key when the account is corrected", async () => {
    const keys: string[] = []
    const client = { createFiatOrderFromQuote: async (_input: unknown, key: string) => { keys.push(key); throw new Error("rejected") } } as never
    const base = { walletId: "w1", quoteId: "q1" }
    await placePayoutOrder(client, { ...base, revision: 0, payout: { bankId: "b1", accountNumber: "0123456789", holderName: "Ada Obi" } }).catch(() => undefined)
    await placePayoutOrder(client, { ...base, revision: 1, payout: { bankId: "b1", accountNumber: "9876543210", holderName: "Ada Obi" } }).catch(() => undefined)
    expect(keys).toHaveLength(2)
    expect(keys[0]).not.toBe(keys[1])
  })

  it("reuses the same key when an identical order is retried after an uncertain failure", async () => {
    const keys: string[] = []
    const client = { createFiatOrderFromQuote: async (_input: unknown, key: string) => { keys.push(key); throw Object.assign(new Error("network"), { status: 0 }) } } as never
    const input = { walletId: "w1", quoteId: "q2", revision: 0, payout: { bankId: "b1", accountNumber: "0123456789" } }
    await placePayoutOrder(client, input).catch(() => undefined)
    await placePayoutOrder(client, input).catch(() => undefined)
    expect(keys[0]).toBe(keys[1])
  })

  it("passes the created order through", async () => {
    const created = { id: "order-1" } as FiatOrder
    const client = { createFiatOrderFromQuote: async () => created } as never
    await expect(placePayoutOrder(client, { walletId: "w", quoteId: "q3", revision: 0, payout: { bankId: "b", accountNumber: "0123456789" } })).resolves.toBe(created)
  })
})

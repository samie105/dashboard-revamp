import { describe, expect, it } from "vitest"

import { CryptoBackendError } from "@/lib/crypto-backend/errors"
import { SPONSOR_EXPIRED_REASON, SPONSOR_UNAVAILABLE_REASON, resolveFeePresentation } from "@/lib/crypto-backend/sponsorship"
import type { SponsorshipOperation } from "@/lib/crypto-backend/types"

/**
 * Spec §11: sponsorship is shown only when the backend explicitly reports it
 * available, and a sponsorship outage must never kill a transfer the user
 * could pay for themselves. `resolveFeePresentation` is the one pure function
 * the review screen's fee row (and the min-expiry countdown) is built on —
 * every case here is a case the screen has to render truthfully.
 */

function operation(overrides: Partial<SponsorshipOperation> = {}): SponsorshipOperation {
  return {
    id: "spon_1",
    walletId: "wallet_1",
    accountId: "acct_1",
    networkId: "eth-mainnet",
    chainFamily: "evm",
    operation: "native-transfer",
    status: "prepared",
    expiresAt: "2026-08-28T00:05:00.000Z",
    ...overrides,
  }
}

describe("resolveFeePresentation", () => {
  it("reports sponsored with the estimated cost once the operation is prepared", () => {
    const result = resolveFeePresentation({
      requested: true,
      operation: operation({ status: "prepared", estimatedCostUsd: 0.42 }),
      quoteError: null,
    })
    expect(result).toEqual({ kind: "sponsored", costUsd: 0.42 })
  })

  it("also reports sponsored once the operation has moved on to submitted/confirmed", () => {
    expect(resolveFeePresentation({ requested: true, operation: operation({ status: "submitted" }), quoteError: null }).kind).toBe("sponsored")
    expect(resolveFeePresentation({ requested: true, operation: operation({ status: "confirmed" }), quoteError: null }).kind).toBe("sponsored")
  })

  it("surfaces the backend's top-level message for SPONSORSHIP_UNAVAILABLE when there's no structured details.message", () => {
    // `client.ts` populates CryptoBackendError.message from `payload.error?.
    // message` — the documented primary human-readable field — so a backend
    // that puts its reason there (rather than nested in `details`) must not
    // be silently dropped for the generic canned copy.
    const quoteError = new CryptoBackendError("Sponsorship isn't available for this account right now.", 400, "SPONSORSHIP_UNAVAILABLE")
    const result = resolveFeePresentation({ requested: true, operation: null, quoteError })
    expect(result).toEqual({ kind: "self-paid-fallback", reason: "Sponsorship isn't available for this account right now." })
  })

  it("prefers a structured details.message over the top-level message when both are present (e.g. the daily limit)", () => {
    const quoteError = new CryptoBackendError("Sponsorship unavailable", 400, "SPONSORSHIP_UNAVAILABLE", {
      message: "You've used today's $5 sponsorship allowance for this account.",
    })
    const result = resolveFeePresentation({ requested: true, operation: null, quoteError })
    expect(result).toEqual({
      kind: "self-paid-fallback",
      reason: "You've used today's $5 sponsorship allowance for this account.",
    })
  })

  it("falls back to the canned default when a SPONSORSHIP_UNAVAILABLE error carries no usable message at all", () => {
    const quoteError = new CryptoBackendError("", 400, "SPONSORSHIP_UNAVAILABLE")
    const result = resolveFeePresentation({ requested: true, operation: null, quoteError })
    expect(result).toEqual({ kind: "self-paid-fallback", reason: SPONSOR_UNAVAILABLE_REASON })
  })

  it("never leaks a generic transport error's top-level message into the fee row", () => {
    // Only a SPONSORSHIP_UNAVAILABLE-coded error's top-level message is
    // trusted — an unrelated failure's technical text must not reach the UI.
    const quoteError = new CryptoBackendError("Crypto backend request failed before a response: TypeError: fetch failed", 0, "CRYPTO_BACKEND_UNREACHABLE")
    const result = resolveFeePresentation({ requested: true, operation: null, quoteError })
    expect(result).toEqual({ kind: "self-paid-fallback", reason: SPONSOR_UNAVAILABLE_REASON })
  })

  it("falls back to the canned default for a plain (non-CryptoBackendError) throw", () => {
    const result = resolveFeePresentation({ requested: true, operation: null, quoteError: new Error("fetch failed") })
    expect(result).toEqual({ kind: "self-paid-fallback", reason: SPONSOR_UNAVAILABLE_REASON })
  })

  it("falls back to self-paid with the expiry reason when the offer itself expired", () => {
    const result = resolveFeePresentation({ requested: true, operation: operation({ status: "expired" }), quoteError: null })
    expect(result).toEqual({ kind: "self-paid-fallback", reason: SPONSOR_EXPIRED_REASON })
  })

  it("prefers the expiry reason over a stale quoteError when the operation itself says expired", () => {
    const staleError = new CryptoBackendError("boom", 500, "RPC_UNAVAILABLE")
    const result = resolveFeePresentation({ requested: true, operation: operation({ status: "expired" }), quoteError: staleError })
    expect(result).toEqual({ kind: "self-paid-fallback", reason: SPONSOR_EXPIRED_REASON })
  })

  it("reports plain self-paid when sponsorship was never requested, regardless of what else is in flight", () => {
    expect(resolveFeePresentation({ requested: false, operation: null, quoteError: null })).toEqual({ kind: "self-paid" })
    expect(resolveFeePresentation({ requested: false, operation: operation({ status: "prepared" }), quoteError: null })).toEqual({ kind: "self-paid" })
  })

  it("falls back to the default reason for a quote/prepare failure that isn't SPONSORSHIP_UNAVAILABLE (the quote-ok-then-prepare-fails case)", () => {
    const prepareError = new CryptoBackendError("Prepare failed", 502, "RPC_UNAVAILABLE")
    const result = resolveFeePresentation({ requested: true, operation: null, quoteError: prepareError })
    expect(result).toEqual({ kind: "self-paid-fallback", reason: SPONSOR_UNAVAILABLE_REASON })
  })

  it("never promises sponsored for an operation stuck at quoted (no signing payload yet)", () => {
    const result = resolveFeePresentation({ requested: true, operation: operation({ status: "quoted" }), quoteError: null })
    expect(result).toEqual({ kind: "self-paid-fallback", reason: SPONSOR_UNAVAILABLE_REASON })
  })
})

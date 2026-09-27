import { describe, expect, it } from "vitest"

import { CryptoBackendError } from "@/lib/crypto-backend/errors"
import {
  describeFiatError,
  fiatReadRetry,
  isRetryableReadError,
  shouldRefetchCapabilities,
  shouldRequote,
  shouldRetryWithSameKey,
  type FiatErrorAction,
} from "@/lib/crypto-backend/fiat-errors"

/**
 * Every code in guide §12.1 (docs/fiat-frontend-integration-guide.md lines
 * 987-999), at the status the table lists it under, with the frontend
 * action the table prescribes.
 */
const TABLE: Array<[status: number, code: string, action: FiatErrorAction]> = [
  // 400 — "Fix the request/UI input. Do not retry unchanged."
  [400, "INVALID_REQUEST", "fix-input"],
  [400, "IDEMPOTENCY_KEY_REQUIRED", "fix-input"],
  [400, "FIAT_AMOUNT_INVALID", "fix-input"],
  [400, "BENEFICIARY_REQUIRED", "fix-input"],
  // 401 — "Refresh Clerk once. If still unauthorized, send the user to sign in."
  [401, "UNAUTHORIZED", "reauth"],
  [401, "AUTH_REQUIRED", "reauth"],
  // 403 — "Stop the action and show ownership/compliance guidance. Do not retry."
  [403, "FORBIDDEN", "stop"],
  [403, "BENEFICIARY_NOT_VERIFIED", "stop"],
  // 404 — "Reload the user's list or show that the resource is unavailable."
  [404, "NOT_FOUND", "reload-list"],
  // 409 — "Resolve state. Reuse the same key for an in-flight retry; new key only for a new logical action."
  [409, "FIAT_PROVIDER_NOT_READY", "refetch-capabilities"],
  [409, "FIAT_QUOTE_NOT_ACTIVE", "requote"],
  [409, "IDEMPOTENCY_IN_PROGRESS", "retry-same-key"],
  [409, "IDEMPOTENT_REQUEST_FAILED", "retry-same-key"],
  [409, "FIAT_CONFIRMATION_CONFLICT", "reload-list"],
  // 413 — "Reduce input size."
  [413, "PAYLOAD_TOO_LARGE", "fix-input"],
  // 422 — "Refresh capabilities or correct the selected corridor/asset/account."
  [422, "FIAT_CORRIDOR_UNAVAILABLE", "refetch-capabilities"],
  [422, "FIAT_DIRECTION_UNSUPPORTED", "refetch-capabilities"],
  [422, "FIAT_ASSET_MAPPING_MISSING", "refetch-capabilities"],
  [422, "BRIDGE_ASSET_UNSUPPORTED", "refetch-capabilities"],
  [422, "BRIDGE_NETWORK_UNSUPPORTED", "refetch-capabilities"],
  [422, "FIAT_PROVIDER_VALIDATION", "refetch-capabilities"], // "FIAT_PROVIDER_* validation errors"
  // 429 — "Honor Retry-After when present and back off. Do not start a duplicate mutation."
  [429, "RATE_LIMITED", "retry-same-key"],
  // 502 — "Treat as temporary/provider failure … retry mutations with the same idempotency key only."
  [502, "FIAT_PROVIDER_UPSTREAM_ERROR", "temporary"], // "FIAT_PROVIDER_*"
  [502, "PROVIDER_RESPONSE_INVALID", "temporary"],
  [502, "PROVIDER_OWNERSHIP_MISMATCH", "temporary"],
  [502, "CRYPTO_SERVICE_UNREACHABLE", "temporary"],
  // 503 — "Show temporary unavailability and retry later with backoff."
  [503, "CRYPTO_SERVICE_UNCONFIGURED", "temporary"],
  // 500 — "Do not create a duplicate. Keep the request ID, reload the resource, and escalate."
  [500, "INTERNAL_ERROR", "escalate"],
  [500, "IDEMPOTENCY_RESOURCE_MISSING", "escalate"],
]

describe("describeFiatError — every guide §12.1 code", () => {
  it.each(TABLE)("%i %s → %s", (status, code, action) => {
    const result = describeFiatError(new CryptoBackendError("backend text", status, code, undefined, "req-123"))
    expect(result.action).toBe(action)
    expect(result.requestId).toBe("req-123")
  })
})

describe("describeFiatError — status fallbacks for codes the table doesn't name", () => {
  it.each([
    [0, "temporary"],
    [401, "reauth"],
    [403, "stop"],
    [404, "reload-list"],
    [422, "refetch-capabilities"],
    [429, "retry-same-key"],
    [500, "escalate"],
    [502, "temporary"],
    [503, "temporary"],
    [504, "temporary"],
    [418, "fix-input"],
  ] as Array<[number, FiatErrorAction]>)("status %i → %s", (status, action) => {
    expect(describeFiatError(new CryptoBackendError("x", status, "SOMETHING_NEW")).action).toBe(action)
  })

  it("treats a non-CryptoBackendError as retryable with a generic message", () => {
    expect(describeFiatError(new Error("boom"))).toEqual({
      message: "Something went wrong. Please try again.",
      action: "retry-same-key",
    })
  })
})

describe("describeFiatError — never branches on or shows the backend message (guide §4 lines 204-205, §12.2 lines 1093-1094)", () => {
  it("gives the same result for two errors that differ only in message", () => {
    const a = describeFiatError(new CryptoBackendError("onswitch quote lane is not approved", 409, "FIAT_PROVIDER_NOT_READY"))
    const b = describeFiatError(new CryptoBackendError("bridge operation is not approved", 409, "FIAT_PROVIDER_NOT_READY"))
    expect(a).toEqual(b)
  })

  it("does not echo provider text for an unknown code", () => {
    const result = describeFiatError(new CryptoBackendError("raw upstream: acct 0123456789 rejected", 400, "SOMETHING_NEW"))
    expect(result.message).not.toContain("0123456789")
    expect(result.message).toBe("The fiat request could not be completed.")
  })
})

describe("describeFiatError — Retry-After on 429 (guide §12.1 line 996)", () => {
  it("reads delta-seconds from the error's retryAfter", () => {
    const error = new CryptoBackendError("x", 429, "RATE_LIMITED", undefined, "r", "30")
    expect(describeFiatError(error).retryAfterSeconds).toBe(30)
  })

  it("reads an HTTP-date Retry-After", () => {
    const at = new Date(Date.now() + 90_000).toUTCString()
    const seconds = describeFiatError(new CryptoBackendError("x", 429, "RATE_LIMITED", undefined, "r", at)).retryAfterSeconds
    expect(seconds).toBeGreaterThanOrEqual(85)
    expect(seconds).toBeLessThanOrEqual(90)
  })

  it("prefers an explicitly passed header over the error's own", () => {
    const error = new CryptoBackendError("x", 429, "RATE_LIMITED", undefined, "r", "30")
    expect(describeFiatError(error, "5").retryAfterSeconds).toBe(5)
  })

  it("leaves retryAfterSeconds undefined when absent or malformed", () => {
    expect(describeFiatError(new CryptoBackendError("x", 429, "RATE_LIMITED")).retryAfterSeconds).toBeUndefined()
    expect(describeFiatError(new CryptoBackendError("x", 429, "RATE_LIMITED", undefined, "r", "soon")).retryAfterSeconds).toBeUndefined()
  })
})

describe("predicates", () => {
  it("shouldRequote only for FIAT_QUOTE_NOT_ACTIVE", () => {
    expect(shouldRequote(new CryptoBackendError("x", 409, "FIAT_QUOTE_NOT_ACTIVE"))).toBe(true)
    expect(shouldRequote(new CryptoBackendError("x", 409, "IDEMPOTENCY_IN_PROGRESS"))).toBe(false)
  })

  it("shouldRefetchCapabilities for FIAT_PROVIDER_NOT_READY and 422 corridor codes", () => {
    expect(shouldRefetchCapabilities(new CryptoBackendError("x", 409, "FIAT_PROVIDER_NOT_READY"))).toBe(true)
    expect(shouldRefetchCapabilities(new CryptoBackendError("x", 422, "FIAT_CORRIDOR_UNAVAILABLE"))).toBe(true)
    expect(shouldRefetchCapabilities(new CryptoBackendError("x", 400, "INVALID_REQUEST"))).toBe(false)
  })

  it("shouldRetryWithSameKey for 429 and in-progress", () => {
    expect(shouldRetryWithSameKey(new CryptoBackendError("x", 429, "RATE_LIMITED"))).toBe(true)
    expect(shouldRetryWithSameKey(new CryptoBackendError("x", 409, "IDEMPOTENCY_IN_PROGRESS"))).toBe(true)
    expect(shouldRetryWithSameKey(new CryptoBackendError("x", 403, "FORBIDDEN"))).toBe(false)
  })
})

describe("isRetryableReadError — verbatim guide §12.3 lines 1102-1105", () => {
  it.each([0, 502, 503, 504])("retries status %i", (status) => {
    expect(isRetryableReadError(new CryptoBackendError("x", status, "ANY"))).toBe(true)
  })

  it.each([400, 401, 403, 404, 409, 413, 422, 429, 500])("does not retry status %i", (status) => {
    expect(isRetryableReadError(new CryptoBackendError("x", status, "ANY"))).toBe(false)
  })

  it("does not retry a non-CryptoBackendError", () => {
    expect(isRetryableReadError(new Error("x"))).toBe(false)
    expect(isRetryableReadError("x")).toBe(false)
  })
})

describe("fiatReadRetry — React Query retry option for fiat reads", () => {
  it.each([0, 502, 503, 504])("retries status %i up to 3 times", (status) => {
    const error = new CryptoBackendError("x", status, "ANY")
    expect(fiatReadRetry(0, error)).toBe(true)
    expect(fiatReadRetry(2, error)).toBe(true)
    expect(fiatReadRetry(3, error)).toBe(false)
  })

  it.each([400, 401, 403, 404, 409, 422])("never retries status %i (guide §12.1)", (status) => {
    expect(fiatReadRetry(0, new CryptoBackendError("x", status, "ANY"))).toBe(false)
  })
})

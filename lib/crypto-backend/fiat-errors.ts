/**
 * Fiat error mapping (CP2).
 *
 * Rules from guide §12:
 *  · §12 opening: "Use error.status, error.code, and error.requestId for
 *    behavior and support diagnostics. Do not branch on the
 *    human-readable message." (guide lines 204-205)
 *  · §12.1 status-code policy table (lines 987-999) enumerates the
 *    codes and the frontend action per HTTP status.
 *  · §12.2 shows illustrative envelopes for the common codes.
 *  · §12.3 retry helper sketch — status 0 / 502 / 503 / 504 as
 *    retryable READ errors (lines 1103-1105); mutations are only ever
 *    retried with the same idempotency key (lines 1140-1142).
 *  · §11: "HTTP 429 RATE_LIMITED — Honor Retry-After when present and
 *    back off. Do not start a duplicate mutation." (guide line 996)
 *
 * Every branch below is anchored on `error.status` + `error.code` per
 * §12; message text is never inspected.
 */

import { CryptoBackendError } from "./errors"

/**
 * The action the UI should take. Codes group into intents so screens
 * can drive behaviour without switching on every code individually.
 */
export type FiatErrorAction =
  /** Retry the exact same request with the same idempotency key. */
  | "retry-same-key"
  /** The quote expired — mint a NEW idempotency key and re-quote. */
  | "requote"
  /** Refetch /fiat/config; the corridor/rail is no longer available. */
  | "refetch-capabilities"
  /** Correct the input and try again with a new key. */
  | "fix-input"
  /** Push the user through Clerk again. */
  | "reauth"
  /** Ownership / compliance failure — stop and show guidance. */
  | "stop"
  /** Reload the user's list; a probed id may not belong to them. */
  | "reload-list"
  /** Temporary provider/service outage — show unavailable, back off. */
  | "temporary"
  /** Internal error — do not duplicate; keep the requestId, escalate. */
  | "escalate"

export interface FiatErrorDescription {
  message: string
  action: FiatErrorAction
  requestId?: string
  /** Populated on 429 when the response carried a Retry-After header. */
  retryAfterSeconds?: number
}

/**
 * Describe a fiat error for the UI. `retryAfterHeader` is the raw
 * `Retry-After` response header (guide §12.1 429 row), passed in by
 * the caller because CryptoBackendError itself doesn't carry it today.
 */
export function describeFiatError(
  error: unknown,
  retryAfterHeader?: string | null,
): FiatErrorDescription {
  if (!(error instanceof CryptoBackendError)) {
    return {
      message: "Something went wrong. Please try again.",
      action: "retry-same-key",
    }
  }

  const requestId = error.requestId
  const rawRetryAfter = retryAfterHeader ?? error.retryAfter
  const retryAfterSeconds =
    rawRetryAfter != null ? parseRetryAfter(rawRetryAfter) : undefined
  const { status, code } = error

  // Branch on error.code first (guide §12.1 table). Fall through to
  // status-based defaults for unknown codes at known statuses.
  switch (code) {
    case "AUTH_REQUIRED":
    case "UNAUTHORIZED":
      return userMessage("Your session has expired. Please sign in again.", "reauth", requestId)
    case "FIAT_PROVIDER_NOT_READY":
      return userMessage("This fiat rail is temporarily unavailable.", "refetch-capabilities", requestId)
    case "FIAT_QUOTE_NOT_ACTIVE":
      return userMessage("The quote expired. Get a new quote to continue.", "requote", requestId)
    case "BENEFICIARY_NOT_VERIFIED":
      return userMessage(
        "Verify that the bank account belongs to you before continuing.",
        "stop",
        requestId,
      )
    case "RATE_LIMITED":
      return {
        message: "Too many requests. Please wait a moment and try again.",
        action: "retry-same-key",
        requestId,
        retryAfterSeconds,
      }
    case "IDEMPOTENCY_KEY_REQUIRED":
      return userMessage("Missing request identifier. Please try again.", "fix-input", requestId)
    case "IDEMPOTENCY_IN_PROGRESS":
      return userMessage(
        "Still processing your previous request. Please wait.",
        "retry-same-key",
        requestId,
      )
    case "IDEMPOTENT_REQUEST_FAILED":
      return userMessage(
        "That request could not be completed. Please try again.",
        "retry-same-key",
        requestId,
      )
    case "FIAT_CONFIRMATION_CONFLICT":
      return userMessage(
        "The order can't be confirmed in its current state.",
        "reload-list",
        requestId,
      )
    case "FIAT_CORRIDOR_UNAVAILABLE":
    case "FIAT_DIRECTION_UNSUPPORTED":
    case "FIAT_ASSET_MAPPING_MISSING":
    case "BRIDGE_ASSET_UNSUPPORTED":
    case "BRIDGE_NETWORK_UNSUPPORTED":
      return userMessage(
        "This corridor or asset is not available. Please pick another.",
        "refetch-capabilities",
        requestId,
      )
    case "FIAT_AMOUNT_INVALID":
    case "FIAT_MINIMUM_AMOUNT":
      return userMessage("The minimum crypto buy is $5 USD equivalent. Increase the amount and try again.", "fix-input", requestId)
    case "BENEFICIARY_REQUIRED":
    case "INVALID_REQUEST":
      return userMessage("Check the details and try again.", "fix-input", requestId)
    case "FORBIDDEN":
      return userMessage("This action isn't allowed for your account.", "stop", requestId)
    case "NOT_FOUND":
      return userMessage(
        "We couldn't find that resource. Reload and try again.",
        "reload-list",
        requestId,
      )
    case "PAYLOAD_TOO_LARGE":
      return userMessage("Request is too large. Reduce the input.", "fix-input", requestId)
    case "INTERNAL_ERROR":
    case "IDEMPOTENCY_RESOURCE_MISSING":
      return userMessage("Something went wrong on our side. We're on it.", "escalate", requestId)
    case "CRYPTO_SERVICE_UNCONFIGURED":
      return userMessage(
        "The fiat service is unavailable. Please try again later.",
        "temporary",
        requestId,
      )
    case "PROVIDER_RESPONSE_INVALID":
    case "PROVIDER_OWNERSHIP_MISMATCH":
    case "CRYPTO_SERVICE_UNREACHABLE":
    case "CRYPTO_BACKEND_UNREACHABLE":
      return userMessage(
        "The fiat service is temporarily unavailable. Please try again.",
        "temporary",
        requestId,
      )
  }

  // §12.1 lists "FIAT_PROVIDER_* validation errors" in the 422 row and
  // "FIAT_PROVIDER_*" in the 502 row, so the same prefix maps by status.
  // FIAT_PROVIDER_NOT_READY is handled explicitly above (409 row).
  if (code.startsWith("FIAT_PROVIDER_")) {
    if (status === 422) {
      return userMessage(
        "This corridor or asset is not available. Please pick another.",
        "refetch-capabilities",
        requestId,
      )
    }
    if (status >= 500 && status < 600) {
      return userMessage(
        "The fiat service is temporarily unavailable. Please try again.",
        "temporary",
        requestId,
      )
    }
  }

  // Fallback by status (guide §12.1) for codes we haven't seen.
  if (status === 500) {
    return userMessage("Something went wrong on our side. We're on it.", "escalate", requestId)
  }
  if (status === 0 || (status >= 500 && status < 600)) {
    return userMessage(
      "The fiat service is temporarily unavailable. Please try again.",
      "temporary",
      requestId,
    )
  }
  if (status === 422) {
    return userMessage(
      "This corridor or asset is not available. Please pick another.",
      "refetch-capabilities",
      requestId,
    )
  }
  if (status === 429) {
    return {
      message: "Too many requests. Please wait a moment and try again.",
      action: "retry-same-key",
      requestId,
      retryAfterSeconds,
    }
  }
  if (status === 401) {
    return userMessage("Your session has expired. Please sign in again.", "reauth", requestId)
  }
  if (status === 403) {
    return userMessage("This action isn't allowed for your account.", "stop", requestId)
  }
  if (status === 404) {
    return userMessage("Resource not found.", "reload-list", requestId)
  }
  // Guide §12.2 lines 1093-1094: "The frontend should show a safe generic
  // message and retain the request ID for support." The backend message is
  // never shown, so provider text can't leak into the UI.
  return userMessage("The fiat request could not be completed.", "fix-input", requestId)
}

function userMessage(
  message: string,
  action: FiatErrorAction,
  requestId: string | undefined,
): FiatErrorDescription {
  return { message, action, requestId }
}

/**
 * Retry-After per HTTP: either delta-seconds or an HTTP-date. Returns
 * seconds until the retry is allowed, or undefined for malformed input.
 */
function parseRetryAfter(header: string): number | undefined {
  const raw = header.trim()
  if (!raw) return undefined
  const seconds = Number(raw)
  if (Number.isFinite(seconds)) return Math.max(0, Math.floor(seconds))
  const date = Date.parse(raw)
  if (!Number.isFinite(date)) return undefined
  return Math.max(0, Math.floor((date - Date.now()) / 1000))
}

/* ── Convenience predicates for common branches ───────────────────────── */

export function shouldRefetchCapabilities(error: unknown): boolean {
  return describeFiatError(error).action === "refetch-capabilities"
}

export function shouldRequote(error: unknown): boolean {
  return error instanceof CryptoBackendError && error.code === "FIAT_QUOTE_NOT_ACTIVE"
}

export function shouldRetryWithSameKey(error: unknown): boolean {
  return describeFiatError(error).action === "retry-same-key"
}

export function shouldReauth(error: unknown): boolean {
  return describeFiatError(error).action === "reauth"
}

/* ── Read retry policy (guide §12.3) ──────────────────────────────────── */

/**
 * Verbatim from docs/fiat-frontend-integration-guide.md §12.3 lines
 * 1102-1105:
 *
 *   function isRetryableReadError(error: unknown): boolean {
 *     return error instanceof CryptoBackendError &&
 *       (error.status === 0 || error.status === 502 ||
 *        error.status === 503 || error.status === 504)
 *   }
 *
 * Everything else — 400/401/403/404/409/422/429 — is NOT auto-retried
 * (guide §12.1). 401 is already handled by the client's one-shot Clerk
 * refresh (lib/crypto-backend/client.ts:1146-1164); a further React
 * Query retry would just re-fire a request the user has to sign back
 * in to authorise. 429 sets `Retry-After` and the UI (not this
 * auto-retry) drives the backoff.
 */
export function isRetryableReadError(error: unknown): boolean {
  return (
    error instanceof CryptoBackendError &&
    (error.status === 0 ||
      error.status === 502 ||
      error.status === 503 ||
      error.status === 504)
  )
}

/**
 * React Query `retry` option for every fiat read hook (useQuery). Bounds
 * retries at 3 (React Query's default) and only retries when guide
 * §12.3 says it's safe. Non-CryptoBackendError falls through to `false`
 * — nothing to do with an unrecognised failure.
 */
export function fiatReadRetry(failureCount: number, error: unknown): boolean {
  return failureCount < 3 && isRetryableReadError(error)
}

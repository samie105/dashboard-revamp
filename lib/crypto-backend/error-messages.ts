import { CryptoBackendError } from "./errors"

export type CryptoErrorAction =
  | "retry" | "setup-wallet" | "unlock" | "refresh-session"
  | "new-intent" | "view-existing" | "pay-gas" | "none"

export type CryptoErrorDescription = {
  title: string
  message: string
  action: CryptoErrorAction
  requestId?: string
}

/** A non-empty string, or null — an id made of whitespace is not an id. */
function idOf(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

/**
 * The id of the operation a `DUPLICATE_REQUEST` is pointing at, if the service
 * named one.
 *
 * The backend's documented contract (`docs/self-custody/backend-docs/
 * frontend-integration.md` §10) has no `DUPLICATE_REQUEST` row at all — an
 * idempotent intent replay comes back `200` with a top-level `existing: true`
 * and the intent itself (§8.4), not as an error. So **null is the expected
 * answer today**, and callers MUST degrade honestly rather than offering a
 * "View status" button that points at nothing.
 *
 * The key-guessing is deliberate insurance for the day the service does carry
 * one: it reads the plausible shapes, validates the value is a real string, and
 * never invents an id.
 */
export function existingOperationIdFrom(error: unknown): string | null {
  if (!(error instanceof CryptoBackendError)) return null
  const details = error.details
  if (!details || typeof details !== "object") return null
  const record = details as Record<string, unknown>
  const direct =
    idOf(record.intentId) ?? idOf(record.existingIntentId) ?? idOf(record.operationId) ?? idOf(record.id)
  if (direct) return direct
  for (const key of ["existing", "intent", "operation"]) {
    const nested = record[key]
    if (nested && typeof nested === "object") {
      const found = idOf((nested as Record<string, unknown>).id) ?? idOf((nested as Record<string, unknown>).intentId)
      if (found) return found
    }
  }
  return null
}


/**
 * Known chain failures, in words.
 *
 * Chains report failures as machine payloads — `{"InsufficientFundsForRent":
 * {"account_index":0}}`, `{"InstructionError":[0,{"Custom":1}]}` — and the
 * fall-through below used to print whatever it was handed. A user reading
 * "Something went wrong. {"InsufficientFundsForRent":{"account_index":0}}" is
 * being shown a debugger's output and asked to interpret it.
 *
 * Every entry here says the same thing that payload says, in the words the
 * user needs: what is short, and therefore what to do.
 */
const CHAIN_FAILURES: readonly [RegExp, string][] = [
  [/InsufficientFundsForRent|insufficient lamports|rent[- ]exempt/i, "Insufficient funds for gas"],
  [/insufficient funds for gas|gas required exceeds/i, "Insufficient funds for gas"],
  [/InsufficientFunds|insufficient balance|0x1/i, "Insufficient balance for this transfer"],
  [/SlippageToleranceExceeded|0x1771/i, "The price moved too far before this could execute"],
  [/BlockhashNotFound|blockhash/i, "The network moved on before this was submitted — try again"],
  [/AccountNotFound|could not find account/i, "That account doesn't exist on this network yet"],
  [/nonce too low|replacement transaction underpriced/i, "A newer transaction replaced this one"],
]

/** Does this read like a machine payload rather than a sentence? */
function looksLikeRawPayload(message: string): boolean {
  const trimmed = message.trim()
  return (
    trimmed.startsWith("{") ||
    trimmed.startsWith("[") ||
    /"[A-Za-z]+":/.test(trimmed) ||
    /0x[0-9a-f]{2,}/i.test(trimmed)
  )
}

/**
 * A message fit to show someone.
 *
 * Recognised failures become their plain sentence. Anything that still reads
 * like a payload is withheld entirely — a generic line the user can act on
 * beats a precise one they cannot parse, and the raw text is still on the
 * error object for logs and for support.
 */
export function humanizeErrorMessage(message: string | undefined | null): string {
  const text = (message ?? "").trim()
  if (!text) return "Something went wrong. Nothing was charged — try again."
  for (const [pattern, plain] of CHAIN_FAILURES) {
    if (pattern.test(text)) return plain
  }
  if (looksLikeRawPayload(text)) {
    return "The network rejected this transaction. Nothing was sent."
  }
  return text
}

export function describeCryptoError(error: unknown): CryptoErrorDescription {
  // Node 21+ exposes a global `navigator` with `onLine` left `undefined` (not
  // `false`), so a bare `!navigator.onLine` would misfire outside a browser.
  // Only trust an explicit `false` as an "offline" signal.
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { title: "You're offline", message: "Check your connection and try again.", action: "retry" }
  }
  if (error instanceof CryptoBackendError) {
    const requestId = error.requestId
    switch (error.code) {
      case "AUTH_REQUIRED":
      case "UNAUTHORIZED":
        return { title: "Session expired", message: "Your sign-in session needs a refresh.", action: "refresh-session", requestId }
      case "WALLET_NOT_FOUND":
        return { title: "No wallet yet", message: "Create your Worldstreet wallet to continue.", action: "setup-wallet", requestId }
      case "USER_VERIFICATION_REQUIRED":
        return { title: "Verification needed", message: "Unlock your wallet to continue.", action: "unlock", requestId }
      case "INSUFFICIENT_FUNDS": {
        const d = error.details as { available?: string; requested?: string } | undefined
        /* Figures first. When the service names what is available and what
           was asked for, that is the most useful thing we can say and no
           prose replaces it. Only without them does the backend's own
           sentence get a turn — it states the shortfall in words (see
           `simulationFailure`) — and a raw payload never does. */
        if (d?.available && d?.requested) {
          return {
            title: "Not enough funds",
            message: `The amount exceeds what this account can spend. Available: ${d.available}. Requested: ${d.requested}.`,
            action: "none",
            requestId,
          }
        }
        const stated = error.message && !looksLikeRawPayload(error.message) ? error.message : null
        return {
          title: "Not enough funds",
          message: stated ?? "The amount exceeds what this account can spend.",
          action: "none",
          requestId,
        }
      }
      case "SPONSORSHIP_UNAVAILABLE":
        return { title: "Fee sponsorship unavailable", message: "Worldstreet can't cover this network fee right now. You can pay the fee yourself instead.", action: "pay-gas", requestId }
      case "RPC_UNAVAILABLE":
        return { title: "Network provider unavailable", message: "The network isn't responding. Your data is unchanged — try again shortly.", action: "retry", requestId }
      case "INTENT_EXPIRED":
        return { title: "Quote expired", message: "This quote ran out before you confirmed. Get a fresh one — nothing was sent.", action: "new-intent", requestId }
      case "DUPLICATE_REQUEST":
        return { title: "Already in progress", message: "This request was already submitted — showing the existing operation.", action: "view-existing", requestId }
      case "PROXY_DISABLED":
        return { title: "Wallet service disabled", message: "The new wallet is switched off right now. Try again later.", action: "none", requestId }
      case "CRYPTO_BACKEND_UNREACHABLE":
        return { title: "Can't reach the wallet service", message: "The wallet service didn't respond. Check your connection and try again shortly.", action: "retry", requestId }
    }
    if (error.status === 429) return { title: "Too many requests", message: "Give it a moment, then try again.", action: "retry", requestId }
    if (error.status >= 500) return { title: "Wallet service issue", message: "The wallet service hit a problem. Try again shortly.", action: "retry", requestId }
    // Never the raw payload: `humanizeErrorMessage` turns a known chain
    // failure into its sentence and withholds anything still machine-shaped.
    return { title: "Something went wrong", message: humanizeErrorMessage(error.message), action: "retry", requestId }
  }
  if (error instanceof Error && error.name === "AbortError") {
    return { title: "Cancelled", message: "The request was cancelled.", action: "none" }
  }
  return {
    title: "Something went wrong",
    message: humanizeErrorMessage(error instanceof Error ? error.message : null),
    action: "retry",
  }
}

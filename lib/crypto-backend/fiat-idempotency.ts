/**
 * Fiat idempotency manager (CP2).
 *
 * The rules the guide's §3.3 imposes on mutation idempotency:
 *  · "Use a new UUID for each new logical action."
 *  · "Reuse the same key only when retrying the exact same request body
 *    after a timeout, connection failure, or uncertain response."
 *  · "Never reuse an old key for a different amount, beneficiary,
 *    wallet, quote, or channel."
 *
 * §6.2's route table tells us which mutations require the header and
 * which don't (POST /fiat/compliance/bridge/sync is the only one marked
 * "No"). §9.3 + §11 add: "The confirmation key is separate from the
 * order-creation key. A successful response returns the updated order."
 *
 * The checkpoint CP2 checklist adds three constraints on how we implement
 * that:
 *  · sessionStorage-backed with an in-memory fallback (so a mid-flight
 *    tab reload reuses the in-flight key instead of minting a fresh one
 *    and creating a duplicate resource);
 *  · released on a definitive response (so a genuine repeat action isn't
 *    folded into the previous one);
 *  · no bank details stored.
 *
 * We meet the "no bank details" constraint by REFUSING an identity that
 * contains any obvious bank-detail field name (thrown Error, not a
 * silent redaction, so a slip is loud). The identity is the fingerprint
 * that scopes the key — callers pass only fields that are safe to
 * persist per-tab. Everything else stays in memory.
 */

import { CryptoBackendError } from "./errors"

export type FiatMutationOperation =
  | "quote"
  | "order"
  | "confirm"
  | "virtual-account"
  | "kyc-link"
  | "customer"
  | "beneficiary-create"
  | "beneficiary-delete"

/**
 * The identity fields that fingerprint a mutation. `undefined` values are
 * dropped from the canonical form so callers may pass optional inputs
 * without changing the fingerprint.
 */
export type FiatIdempotencyIdentity = Readonly<
  Record<string, string | number | boolean | null | undefined>
>

/**
 * A change to the schema (new mandatory identity field on an operation,
 * for example) must bump this so a stale entry from an older schema
 * can't be reused.
 */
const STORAGE_PREFIX = "worldstreet:fiat-idempotency:v1:"

/**
 * Field names that must NEVER appear in an identity. This is a defence
 * in depth against a caller accidentally passing raw beneficiary payload
 * fields as the fingerprint. If any of these appear, keyFor throws.
 *
 * The list is deliberately broad — different provider payloads use
 * different casings (bank_code vs bankCode). Keep in sync with guide §15
 * "Raw bank account numbers and full provider instructions are not
 * logged."
 */
const FORBIDDEN_IDENTITY_KEYS: ReadonlySet<string> = new Set([
  "account_number",
  "accountNumber",
  "bank_account_number",
  "bankAccountNumber",
  "iban",
  "swift",
  "sort_code",
  "sortCode",
  "routing_number",
  "routingNumber",
  "providerPayload",
  "provider_payload",
])

const inMemory = new Map<string, string>()

function canonicalize(identity: FiatIdempotencyIdentity): string {
  const entries = Object.entries(identity)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
  return JSON.stringify(entries)
}

function storageKey(
  operation: FiatMutationOperation,
  identity: FiatIdempotencyIdentity,
): string {
  return `${STORAGE_PREFIX}${operation}::${canonicalize(identity)}`
}

function ensureSafe(identity: FiatIdempotencyIdentity): void {
  for (const key of Object.keys(identity)) {
    if (FORBIDDEN_IDENTITY_KEYS.has(key)) {
      throw new Error(
        `Fiat idempotency identity must not include bank details (got "${key}"). ` +
          `See docs/fiat-frontend-integration-guide.md §15 and CLAUDE.md fiat ramp rules.`,
      )
    }
  }
}

function mint(): string {
  return crypto.randomUUID()
}

function readStorage(key: string): string | undefined {
  try {
    if (typeof sessionStorage === "undefined") return undefined
    return sessionStorage.getItem(key) ?? undefined
  } catch {
    return undefined
  }
}

function writeStorage(key: string, value: string): void {
  try {
    if (typeof sessionStorage === "undefined") return
    sessionStorage.setItem(key, value)
  } catch {
    // Quota exhausted or storage disabled — in-memory still works.
  }
}

function deleteStorage(key: string): void {
  try {
    if (typeof sessionStorage === "undefined") return
    sessionStorage.removeItem(key)
  } catch {
    // Storage disabled; nothing to clean up.
  }
}

export interface FiatIdempotencyStore {
  /**
   * Return the idempotency key for a mutation. Two calls with the same
   * (operation, identity) get the same key back until `release` is
   * called. Guide §3.3 exact-retry semantics.
   */
  keyFor(operation: FiatMutationOperation, identity: FiatIdempotencyIdentity): string
  /**
   * Forget a specific (operation, identity) key so the next call mints a
   * fresh one. Call after a definitive response so a genuine repeat
   * action isn't folded into the previous one.
   */
  release(operation: FiatMutationOperation, identity: FiatIdempotencyIdentity): void
  /**
   * Forget every key for one operation (e.g. releasing all in-flight
   * order keys after a screen unmounts).
   */
  releaseAll(operation: FiatMutationOperation): void
}

export const fiatIdempotencyStore: FiatIdempotencyStore = {
  keyFor(operation, identity) {
    ensureSafe(identity)
    const key = storageKey(operation, identity)
    const cached = inMemory.get(key) ?? readStorage(key)
    if (cached) {
      inMemory.set(key, cached)
      return cached
    }
    const uuid = mint()
    inMemory.set(key, uuid)
    writeStorage(key, uuid)
    return uuid
  },
  release(operation, identity) {
    ensureSafe(identity)
    const key = storageKey(operation, identity)
    inMemory.delete(key)
    deleteStorage(key)
  },
  releaseAll(operation) {
    const prefix = `${STORAGE_PREFIX}${operation}::`
    for (const key of Array.from(inMemory.keys())) {
      if (key.startsWith(prefix)) inMemory.delete(key)
    }
    try {
      if (typeof sessionStorage === "undefined") return
      for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
        const key = sessionStorage.key(i)
        if (key && key.startsWith(prefix)) sessionStorage.removeItem(key)
      }
    } catch {
      // Storage disabled — in-memory already cleared.
    }
  },
}

/**
 * Whether a failed mutation's outcome is definitive (the key can be
 * released) or uncertain (the key MUST be kept for an exact retry).
 *
 * Guide §12.3 lines 1140-1142: "For a mutation timeout, the UI must not
 * generate a new idempotency key until it has either retried the exact
 * request with the original key or confirmed the result by
 * listing/reading the resource."
 *
 * Kept (uncertain), from the §12.1 table (lines 987-999):
 *  · no HTTP response (status 0) or a non-CryptoBackendError (aborts,
 *    unknown throws) — the request may or may not have landed;
 *  · 429 RATE_LIMITED — "Do not start a duplicate mutation";
 *  · 409 IDEMPOTENCY_IN_PROGRESS — "Reuse the same key for an in-flight
 *    retry";
 *  · 409 IDEMPOTENT_REQUEST_FAILED — see open question in
 *    docs/FIAT_RAMP_CONTEXT.md; kept until the backend team confirms;
 *  · 5xx — 502 "retry mutations with the same idempotency key only",
 *    503 "retry later", 500 "Do not create a duplicate".
 *
 * Everything else is a definitive rejection: the backend answered and
 * did not create the resource, so a retry is a new logical action.
 */
export function isUncertainMutationFailure(error: unknown): boolean {
  if (!(error instanceof CryptoBackendError)) return true
  const { status, code } = error
  if (status === 0) return true
  if (status === 429) return true
  if (status >= 500) return true
  if (code === "IDEMPOTENCY_IN_PROGRESS" || code === "IDEMPOTENT_REQUEST_FAILED") return true
  return false
}

/**
 * Run one mutation under an idempotency key and apply the release policy:
 * success or a definitive rejection releases the key; an uncertain
 * failure keeps it, so the next call with the same identity reuses it.
 */
export async function runIdempotentMutation<T>(
  operation: FiatMutationOperation,
  identity: FiatIdempotencyIdentity,
  mutate: (idempotencyKey: string) => Promise<T>,
  store: FiatIdempotencyStore = fiatIdempotencyStore,
): Promise<T> {
  const key = store.keyFor(operation, identity)
  try {
    const result = await mutate(key)
    store.release(operation, identity)
    return result
  } catch (error) {
    if (!isUncertainMutationFailure(error)) store.release(operation, identity)
    throw error
  }
}

/** Test-only helper — clears every key across every operation. */
export function __resetFiatIdempotencyStore(): void {
  inMemory.clear()
  try {
    if (typeof sessionStorage === "undefined") return
    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
      const key = sessionStorage.key(i)
      if (key && key.startsWith(STORAGE_PREFIX)) sessionStorage.removeItem(key)
    }
  } catch {
    // Nothing to clean up.
  }
}

/** Test-only helper — enumerate what's in storage (not for runtime use). */
export function __enumerateFiatIdempotencyStorageKeys(): string[] {
  try {
    if (typeof sessionStorage === "undefined") return []
    const keys: string[] = []
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i)
      if (key && key.startsWith(STORAGE_PREFIX)) keys.push(key)
    }
    return keys
  } catch {
    return []
  }
}

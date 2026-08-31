/**
 * Idempotency keys for transfer creation.
 *
 * The backend collapses two `POST /transactions/intents` calls carrying the
 * same `idempotencyKey` into one intent. That only helps if the key is STABLE
 * across retries of the same transfer and DIFFERENT for a genuinely new one.
 *
 * The bug this replaces: a fresh `crypto.randomUUID()` was minted inside the
 * mutation on every call, so a double-click, a re-fired mutation, or the
 * client's own 401-refresh replay each sent a key the service had never seen
 * and therefore each created a SEPARATE transfer. The header was present and
 * the protection was not — the worst of both, because the call site looked
 * correct.
 *
 * Identity is the transfer's own fields. Fee sponsorship is quoted separately
 * on top of an intent and never changes what is being moved, so it is not part
 * of identity. The store is cleared when the user starts a new transfer, which
 * is what keeps a deliberate repeat send — same amount, same address, a minute
 * later — from being folded into the one that just completed.
 */

export type TransferIdentity = {
  accountId: string
  networkId: string
  asset: { kind: "native" | "token"; identifier: string }
  to: string
  amount: string
}

/**
 * A collision-proof identity string. JSON rather than a joined string: a
 * delimiter can appear inside a field and silently merge two different
 * transfers into one key, and "silently merged" here means a transfer the
 * user asked for never happens.
 */
export function transferFingerprint(input: TransferIdentity): string {
  return JSON.stringify([
    input.accountId,
    input.networkId,
    input.asset.kind,
    input.asset.identifier,
    input.to,
    input.amount,
  ])
}

export type IdempotencyKeyStore = {
  /** The key for this transfer — the same one every time until `clear()`. */
  keyFor: (input: TransferIdentity) => string
  /** Forget every key. Call when the user starts a new transfer. */
  clear: () => void
}

/** `mint` is injectable so tests can assert identity without matching UUIDs. */
export function createIdempotencyKeyStore(mint: () => string = () => crypto.randomUUID()): IdempotencyKeyStore {
  const keys = new Map<string, string>()
  return {
    keyFor(input) {
      const fingerprint = transferFingerprint(input)
      const existing = keys.get(fingerprint)
      if (existing) return existing
      const key = mint()
      keys.set(fingerprint, key)
      return key
    },
    clear() {
      keys.clear()
    },
  }
}

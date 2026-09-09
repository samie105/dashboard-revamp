import { cryptoBackendClient } from "./client"
import type { CryptoBalanceSnapshot } from "./types"

const SUCCESS_CACHE_MS = 15_000
const REQUEST_TIMEOUT_MS = 20_000

type CacheEntry = {
  snapshot?: CryptoBalanceSnapshot
  successfulAt: number
  inFlight?: Promise<CryptoBalanceSnapshot>
}

const entries = new Map<string, CacheEntry>()

function entryFor(userId: string) {
  const existing = entries.get(userId)
  if (existing) return existing
  const entry: CacheEntry = { successfulAt: 0 }
  entries.set(userId, entry)
  return entry
}

function retryable(error: unknown) {
  const status = typeof error === "object" && error !== null && "status" in error
    ? Number((error as { status?: unknown }).status)
    : 0
  return status === 0 || status >= 500
}

/**
 * One process-wide balance request per user. React Query deduplicates within
 * one query key, but several dashboard surfaces use different keys; this
 * guard keeps all of them from issuing parallel wallet-balance requests.
 */
export function fetchCachedBalanceSnapshot(
  userId: string,
  _forceRefresh = false,
  _callerSignal?: AbortSignal,
): Promise<CryptoBalanceSnapshot> {
  const entry = entryFor(userId)
  const now = Date.now()

  if (entry.inFlight) return entry.inFlight
  if (entry.snapshot && now - entry.successfulAt < SUCCESS_CACHE_MS) {
    return Promise.resolve(entry.snapshot)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  const request = cryptoBackendClient
    .listBalanceSnapshot(true, controller.signal)
    .then((snapshot) => {
      entry.snapshot = snapshot
      entry.successfulAt = Date.now()
      return snapshot
    })
    .catch((error) => {
      // A 401/403/404 is terminal for this attempt. Network and 5xx errors
      // remain visible to React Query, which applies the explicit backoff.
      if (!retryable(error)) entry.successfulAt = 0
      throw error
    })
    .finally(() => {
      clearTimeout(timeout)
      entry.inFlight = undefined
    })

  entry.inFlight = request
  return request
}

export const BALANCE_POLL_INTERVAL_MS = SUCCESS_CACHE_MS
export const BALANCE_RETRY_DELAYS_MS = [5_000, 10_000, 20_000, 60_000] as const


"use client"

/**
 * The spot registry, fetched once and shared.
 *
 * `/trading/spot/markets` is 9,000+ rows and the single slowest thing the
 * trade screen waits on. It was requested twice — the workspace fetched it in
 * its own effect, `useSpotRegistry` fetched it again for the markets page and
 * the orders table — and always at the moment the screen was already needed,
 * so the rail spent the first seconds as skeleton rows.
 *
 * One module-level cache with an in-flight promise fixes both: concurrent
 * callers share a round-trip, and `prefetchSpotMarkets()` lets anything that
 * can see the user heading for the trade screen — a nav link under the
 * cursor, an idle moment after the shell mounts — pay that cost early.
 *
 * `peekSpotMarkets()` is the point of the whole thing: a warm cache is handed
 * over synchronously, so a second visit renders the list on the first frame
 * instead of flashing skeletons at data it already has.
 */

import { cryptoBackendClient, isCryptoBackendEnabled } from "@/lib/crypto-backend"

type SpotMarketsResponse = Awaited<
  ReturnType<typeof cryptoBackendClient.getModernSpotMarkets>
>

/** Long enough that moving between screens never refetches; short enough that
 *  a session left open overnight doesn't trade on yesterday's catalogue. */
const TTL_MS = 5 * 60_000

let cached: { value: SpotMarketsResponse; at: number } | null = null
let inflight: Promise<SpotMarketsResponse> | null = null

function fresh(): SpotMarketsResponse | null {
  if (!cached) return null
  return Date.now() - cached.at < TTL_MS ? cached.value : null
}

/** The cached registry, or `null`. Never triggers a fetch. */
export function peekSpotMarkets(): SpotMarketsResponse | null {
  return fresh()
}

/**
 * The registry, from cache when it is fresh and from the backend otherwise.
 * Concurrent callers share the one request.
 */
export function loadSpotMarkets(): Promise<SpotMarketsResponse> {
  const hit = fresh()
  if (hit) return Promise.resolve(hit)
  if (inflight) return inflight

  if (!isCryptoBackendEnabled) {
    return Promise.reject(new Error("Crypto backend is disabled"))
  }

  inflight = cryptoBackendClient
    .getModernSpotMarkets()
    .then((value) => {
      cached = { value, at: Date.now() }
      return value
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

/**
 * Warm the cache without waiting for it or caring if it fails.
 *
 * Safe to call on a hover, on every render, from several places at once — a
 * fresh cache returns immediately and an in-flight request is shared, so the
 * only thing repeated calls cost is a function call.
 */
export function prefetchSpotMarkets(): void {
  if (fresh() || inflight || !isCryptoBackendEnabled) return
  void loadSpotMarkets().catch(() => {
    /* A prefetch that fails is not an error anyone asked about; the real
       request will surface it when the screen actually needs the data. */
  })
}

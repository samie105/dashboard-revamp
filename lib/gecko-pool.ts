/**
 * Finding a token's DEX pool on GeckoTerminal — shared by the chart routes
 * (/api/charts/ohlcv for candles, /api/charts/trades for the trades tape), so
 * both read the same pool and its choice is cached once, server-side.
 *
 * Moved unchanged from app/api/charts/ohlcv/route.ts.
 */

import { pickBestPool } from "@/lib/chart-ohlcv"

export const GECKO = "https://api.geckoterminal.com/api/v2"

/** Our network ids → GeckoTerminal's own chain slugs. */
export const CHAIN_SLUG: Record<string, string> = {
  "solana-mainnet-beta": "solana",
  "ethereum-mainnet": "eth",
  "arbitrum-one": "arbitrum",
}

type CacheEntry<T> = { value: T; expires: number }
const poolCache = new Map<string, CacheEntry<string | null>>()

function cached<T>(store: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const hit = store.get(key)
  if (!hit) return undefined
  if (hit.expires <= Date.now()) {
    store.delete(key)
    return undefined
  }
  return hit.value
}

function put<T>(store: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number) {
  store.set(key, { value, expires: Date.now() + ttlMs })
  // The registry is large and long-tailed; without a bound this map is a slow
  // memory leak across every token anyone ever opens.
  if (store.size > 500) {
    const oldest = store.keys().next().value
    if (oldest !== undefined) store.delete(oldest)
  }
}

/** The pool to read for this token: the one that actually trades (pickBestPool). */
export async function findPool(slug: string, token: string, signal: AbortSignal): Promise<string | null> {
  const key = `${slug}:${token.toLowerCase()}`
  const hit = cached(poolCache, key)
  if (hit !== undefined) return hit

  const response = await fetch(`${GECKO}/networks/${slug}/tokens/${encodeURIComponent(token)}/pools?page=1`, {
    headers: { accept: "application/json" },
    signal,
  })
  if (!response.ok) {
    // A rate limit or upstream outage is not proof that the token has no
    // pool. Cache only a genuine 404; caching 429/5xx here made charts stay
    // empty for ten minutes after a transient provider failure.
    if (response.status === 404) put(poolCache, key, null, 10 * 60_000)
    return null
  }
  const body = (await response.json()) as { data?: Parameters<typeof pickBestPool>[0] }
  const pool = pickBestPool(body.data)
  put(poolCache, key, pool, pool ? 60 * 60_000 : 10 * 60_000)
  return pool
}

"use client"

/**
 * 7-day price curves for a set of symbols — one request, shared by everyone.
 *
 * The server action already batches and caches, but two components asking on
 * the same render would still fire two server actions, so the memo lives here
 * too. Symbols are accumulated into one key: a watchlist of seven coins costs
 * exactly one round-trip whether one component asks or three do.
 *
 * There is deliberately no fallback curve. When the fetch fails the map stays
 * empty and <Sparkline> renders nothing — a chart drawn from no data is a lie
 * a user can't detect, and the previous version told exactly that lie.
 */

import * as React from "react"
import { getSparklines, type SparklinePoint } from "@/lib/actions"

/** How long to wait before asking again after a failed request. Long enough
 *  that a rate limit has time to clear, short enough that a user who leaves
 *  the page open gets their charts without a reload. */
const RETRY_AFTER_MS = 60_000

const cache = new Map<string, SparklinePoint>()
const inflight = new Map<string, Promise<void>>()
const listeners = new Set<() => void>()
/** Set while a failed request is cooling off, so a dead feed isn't hammered. */
let retryAt = 0

/** Bumped on every successful merge so subscribers re-read the cache. */
let version = 0

function emit() {
  version++
  for (const l of listeners) l()
}

function load(symbols: string[]) {
  const missing = symbols.filter((s) => !cache.has(s))
  if (missing.length === 0) return
  if (Date.now() < retryAt) return
  const key = missing.slice().sort().join(",")
  if (inflight.has(key)) return

  const p = getSparklines(missing)
    .then((res) => {
      let changed = false
      for (const [sym, point] of Object.entries(res.data)) {
        cache.set(sym, point)
        changed = true
      }
      if (res.ok) {
        // The request succeeded and simply didn't cover these — remember that,
        // so a coin CoinGecko doesn't list isn't re-requested on every render.
        for (const sym of missing) {
          if (!cache.has(sym)) cache.set(sym, { prices: [], change24h: 0 })
        }
        retryAt = 0
      } else {
        // A failure says nothing about the coins. Caching it as "no data"
        // would silently disable every chart until a full page reload.
        retryAt = Date.now() + RETRY_AFTER_MS
      }
      if (changed || res.ok) emit()
    })
    .catch(() => {
      retryAt = Date.now() + RETRY_AFTER_MS
    })
    .finally(() => {
      inflight.delete(key)
    })

  inflight.set(key, p)
}

export function useSparklines(symbols: string[]) {
  // Sorted + joined so a re-ordered watchlist doesn't re-trigger the effect.
  const key = React.useMemo(
    () => [...new Set(symbols.map((s) => s.toUpperCase()))].sort().join(","),
    [symbols],
  )

  const subscribe = React.useCallback((cb: () => void) => {
    listeners.add(cb)
    return () => listeners.delete(cb)
  }, [])
  React.useSyncExternalStore(subscribe, () => version, () => 0)

  React.useEffect(() => {
    if (key) load(key.split(","))
  }, [key])

  /* Three answers, not two:
       undefined — still in flight, so hold the space with a skeleton
       null      — resolved and there's nothing to draw (a stablecoin, or a
                   coin CoinGecko doesn't cover), so draw nothing and stop
       point     — a real series
     Collapsing the last two into one made USDT and TON shimmer forever. */
  return React.useCallback(
    (symbol: string): SparklinePoint | null | undefined => {
      const hit = cache.get(symbol.toUpperCase())
      if (!hit) return undefined
      return hit.prices.length >= 2 ? hit : null
    },
    // The cache is mutated in place, so the version is what makes this fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  )
}

/**
 * Candles for any token we can trade, keyed by CONTRACT ADDRESS.
 *
 * The trade chart was fed by Hyperliquid's `candleSnapshot`, which is a
 * perps venue: it knows BTC, ETH and a few dozen majors by ticker. The spot
 * registry is 9,000+ rows of long-tail SPL and ERC-20 tokens, so `bookCoin`
 * was hardcoded to null for every one of them and the chart pane rendered a
 * paragraph of apology instead of a price.
 *
 * A symbol cannot be the key here. "TRUMP" names several unrelated tokens
 * across chains and none of them is on a centralised venue; the only thing
 * that identifies a market unambiguously is the mint/contract, which is
 * exactly what the registry already carries. GeckoTerminal indexes DEX pools
 * on every chain we route (Solana, Ethereum, Arbitrum) and is addressable that
 * way, needs no key, and returns OHLCV — so it is the source for spot, and
 * Hyperliquid stays the source for perps, where it is authoritative.
 *
 * This runs server-side rather than from the page so the upstream sees one
 * cached origin instead of every open tab, and so a rate limit degrades into
 * a stale-but-honest chart rather than a CORS failure in the console.
 */

import { NextResponse } from "next/server"
import { normalizeOhlcv, pickBestPool, stats24hFrom, num, type Candle } from "@/lib/chart-ohlcv"

const GECKO = "https://api.geckoterminal.com/api/v2"

/** Our network ids → GeckoTerminal's own chain slugs. */
const CHAIN_SLUG: Record<string, string> = {
  "solana-mainnet-beta": "solana",
  "ethereum-mainnet": "eth",
  "arbitrum-one": "arbitrum",
}

/**
 * Chart interval → GeckoTerminal's timeframe + aggregate. Their API only
 * accepts these aggregates (minute 1/5/15, hour 1/4/12, day 1), so the
 * ticket's interval buttons are constrained to what actually exists rather
 * than asking for a 30m bar that comes back empty.
 */
const TIMEFRAME: Record<string, { timeframe: string; aggregate: number }> = {
  "1m": { timeframe: "minute", aggregate: 1 },
  "5m": { timeframe: "minute", aggregate: 5 },
  "15m": { timeframe: "minute", aggregate: 15 },
  "1h": { timeframe: "hour", aggregate: 1 },
  "4h": { timeframe: "hour", aggregate: 4 },
  "1d": { timeframe: "day", aggregate: 1 },
}

type CacheEntry<T> = { value: T; expires: number }
const poolCache = new Map<string, CacheEntry<string | null>>()
const candleCache = new Map<string, CacheEntry<{ candles: Candle[]; stats: Stats | null }>>()

type Stats = { price: number | null; changePct24h: number | null; volume24h: number | null }

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

/**
 * The pool to chart: the one holding the most liquidity for this token.
 *
 * A token trades in many pools and the thin ones print noise — a $200 pool
 * will show a 60% "candle" that no one could have traded. Depth is the only
 * sane tiebreak, and it is also the pool an order actually routes through.
 */
async function findPool(slug: string, token: string, signal: AbortSignal): Promise<string | null> {
  const key = `${slug}:${token.toLowerCase()}`
  const hit = cached(poolCache, key)
  if (hit !== undefined) return hit

  const response = await fetch(
    `${GECKO}/networks/${slug}/tokens/${encodeURIComponent(token)}/pools?page=1`,
    { headers: { accept: "application/json" }, signal },
  )
  if (!response.ok) {
    // Cache the miss briefly too: an unlisted token would otherwise re-ask on
    // every poll, for every viewer, forever.
    put(poolCache, key, null, 60_000)
    return null
  }
  const body = (await response.json()) as {
    data?: { id?: string; attributes?: { address?: string; reserve_in_usd?: string } }[]
  }
  const pool = pickBestPool(body.data)
  put(poolCache, key, pool, pool ? 60 * 60_000 : 60_000)
  return pool
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const networkId = params.get("network") ?? ""
  const token = params.get("token") ?? ""
  const interval = params.get("interval") ?? "1h"

  const slug = CHAIN_SLUG[networkId]
  const timeframe = TIMEFRAME[interval]
  if (!slug || !token || !timeframe) {
    return NextResponse.json(
      { error: "Unsupported network, token or interval" },
      { status: 400 },
    )
  }

  const key = `${slug}:${token.toLowerCase()}:${interval}`
  const hit = cached(candleCache, key)
  if (hit) return NextResponse.json(hit)

  // Intraday bars move; a daily bar does not. One TTL for both would either
  // serve a stale 1m chart or hammer the upstream for a 1d one.
  const ttl = timeframe.timeframe === "day" ? 5 * 60_000 : 30_000
  const controller = AbortSignal.timeout(12_000)

  try {
    const pool = await findPool(slug, token, controller)
    if (!pool) {
      const empty = { candles: [] as Candle[], stats: null }
      put(candleCache, key, empty, 60_000)
      return NextResponse.json(empty)
    }

    const url = new URL(`${GECKO}/networks/${slug}/pools/${pool}/ohlcv/${timeframe.timeframe}`)
    url.searchParams.set("aggregate", String(timeframe.aggregate))
    url.searchParams.set("limit", "1000")
    url.searchParams.set("currency", "usd")
    // Price OUR token, not the pool's base. In a TOKEN/SOL pool the base is
    // the token, but in a USDC/TOKEN pool it is not, and charting the base
    // blindly would draw the price upside down.
    url.searchParams.set("token", token)

    const [ohlcvResponse, poolResponse] = await Promise.all([
      fetch(url, { headers: { accept: "application/json" }, signal: controller }),
      fetch(`${GECKO}/networks/${slug}/pools/${pool}`, {
        headers: { accept: "application/json" },
        signal: controller,
      }),
    ])

    if (!ohlcvResponse.ok) {
      return NextResponse.json({ candles: [], stats: null })
    }

    const body = (await ohlcvResponse.json()) as {
      data?: { attributes?: { ohlcv_list?: (number | string)[][] } }
    }
    const candles: Candle[] = normalizeOhlcv(body.data?.attributes?.ohlcv_list)

    // Price and change come from the series, which is priced in OUR token.
    // Volume is a property of the pool and is the same figure from either
    // side, so that one can be read off the pool directly.
    const derived = stats24hFrom(candles)
    let volume24h: number | null = null
    if (poolResponse.ok) {
      const poolBody = (await poolResponse.json()) as {
        data?: { attributes?: { volume_usd?: Record<string, string> } }
      }
      volume24h = num(poolBody.data?.attributes?.volume_usd?.h24)
    }
    const stats: Stats = { ...derived, volume24h }

    const payload = { candles, stats }
    if (candles.length > 0) put(candleCache, key, payload, ttl)
    return NextResponse.json(payload)
  } catch {
    // A timeout or upstream wobble must not blank a chart that is already on
    // screen: the client keeps its last data when this comes back empty.
    return NextResponse.json({ candles: [], stats: null })
  }
}

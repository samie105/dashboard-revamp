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
import {
  normalizeOhlcv,
  pickBestPool,
  stats24hFrom,
  bucketPrices,
  INTERVAL_SECONDS,
  num,
  type Candle,
} from "@/lib/chart-ohlcv"

const GECKO = "https://api.geckoterminal.com/api/v2"
const COINGECKO = "https://api.coingecko.com/api/v3"

/**
 * How many days of samples to ask CoinGecko for, per interval.
 *
 * Its free tier picks the sample spacing from the window: one day gives
 * 5-minutely points, up to ninety gives hourly, beyond that daily. These are
 * the smallest windows whose samples can still fill the requested bar — ask
 * for 90 days to draw 5-minute candles and you get one point per hour and a
 * chart of flat steps.
 *
 * `1m` is absent on purpose: the finest sample available is five minutes, and
 * no window makes a one-minute bar out of it. The response says so rather than
 * drawing something that looks like minute data.
 */
const COINGECKO_DAYS: Record<string, number> = {
  "5m": 1,
  "15m": 1,
  "1h": 90,
  "4h": 90,
  "1d": 365,
}

/** Every interval the pool source can serve; it returns true OHLC per bar. */
const ALL_INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d"]
const COINGECKO_INTERVALS = Object.keys(COINGECKO_DAYS)

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
const candleCache = new Map<string, CacheEntry<Payload>>()

type Stats = { price: number | null; changePct24h: number | null; volume24h: number | null }
type Payload = {
  candles: Candle[]
  stats: Stats | null
  /** Which upstream answered — the chart says so, and it changes what bars mean. */
  source: "geckoterminal" | "coingecko" | null
  /** Intervals this token can actually be drawn at, given its source. */
  intervals: string[]
}

/* One upstream round-trip per key, however many viewers ask at once. Without
   this, a market everyone opens at the same moment sends one request per tab
   and earns a rate limit for all of them. */
const inflight = new Map<string, Promise<Payload>>()

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
    // Cache the miss for a while: most of the catalogue has no pool, and
    // without this every poll from every viewer re-asks — which is how a
    // shared rate limit gets spent on questions already answered.
    put(poolCache, key, null, 10 * 60_000)
    return null
  }
  const body = (await response.json()) as {
    data?: { id?: string; attributes?: { address?: string; reserve_in_usd?: string } }[]
  }
  const pool = pickBestPool(body.data)
  put(poolCache, key, pool, pool ? 60 * 60_000 : 10 * 60_000)
  return pool
}

/**
 * The fallback source: CoinGecko, by the coin id the market registry already
 * stores as `chartSymbol`.
 *
 * This is not a second opinion, it is the ONLY source for most of the
 * catalogue. The registry admits a token when CoinGecko has a chart for it —
 * that is what `chartAvailable` tests — so a staked, wrapped or bridged token
 * has a price here and no DEX pool anywhere. Charting only pools left those
 * markets blank while quoting a price beside them, which is the contradiction
 * this repairs.
 */
async function fromCoingecko(
  coinId: string,
  interval: string,
  signal: AbortSignal,
): Promise<Payload | null> {
  const days = COINGECKO_DAYS[interval] ?? COINGECKO_DAYS["1h"]
  const url = new URL(`${COINGECKO}/coins/${encodeURIComponent(coinId)}/market_chart`)
  url.searchParams.set("vs_currency", "usd")
  url.searchParams.set("days", String(days))

  const response = await fetch(url, { headers: { accept: "application/json" }, signal })
  if (!response.ok) return null
  const body = (await response.json()) as { prices?: [number, number][] }
  const seconds = INTERVAL_SECONDS[interval] ?? INTERVAL_SECONDS["1h"]
  const candles = bucketPrices(body.prices, seconds)
  if (candles.length === 0) return null

  return {
    candles,
    // Volume is not in a price series, so it is absent rather than invented.
    stats: { ...stats24hFrom(candles), volume24h: null },
    source: "coingecko",
    intervals: COINGECKO_INTERVALS,
  }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const networkId = params.get("network") ?? ""
  const token = params.get("token") ?? ""
  const interval = params.get("interval") ?? "1h"
  /** The registry's `chartSymbol` — a CoinGecko coin id, when it has one. */
  const coinId = params.get("cg") ?? ""

  const slug = CHAIN_SLUG[networkId]
  if ((!slug && !coinId) || (!token && !coinId) || !INTERVAL_SECONDS[interval]) {
    return NextResponse.json(
      { error: "Unsupported network, token or interval" },
      { status: 400 },
    )
  }

  const key = `${slug}:${token.toLowerCase()}:${coinId}:${interval}`
  const hit = cached(candleCache, key)
  if (hit) return NextResponse.json(hit)

  const running = inflight.get(key)
  if (running) return NextResponse.json(await running)

  const work = resolveChart(slug, token, coinId, interval)
    .then((payload) => {
      // Intraday bars move; a daily bar does not. A source that answered with
      // nothing is cached briefly too, so an unlisted token is not re-asked on
      // every poll by every viewer.
      const ttl =
        payload.candles.length === 0
          ? 5 * 60_000
          : interval === "1d"
            ? 5 * 60_000
            : 45_000
      put(candleCache, key, payload, ttl)
      return payload
    })
    .finally(() => inflight.delete(key))

  inflight.set(key, work)
  return NextResponse.json(await work)
}

/**
 * Pools first, CoinGecko second.
 *
 * A pool is the better answer where one exists: real per-bar OHLC, real
 * volume, every interval. But most of the catalogue has no pool on the chain
 * it is listed on, and for those the coin id is the only way to draw anything
 * at all.
 */
async function resolveChart(
  slug: string | undefined,
  token: string,
  coinId: string,
  interval: string,
): Promise<Payload> {
  const empty: Payload = { candles: [], stats: null, source: null, intervals: ALL_INTERVALS }
  const signal = AbortSignal.timeout(12_000)
  const timeframe = TIMEFRAME[interval]

  if (slug && token && timeframe) {
    try {
      const pooled = await fromPool(slug, token, interval, timeframe, signal)
      if (pooled) return pooled
    } catch {
      // Fall through — an upstream wobble should reach for the other source,
      // not blank a chart that has one.
    }
  }

  if (coinId) {
    try {
      const listed = await fromCoingecko(coinId, interval, signal)
      if (listed) return listed
    } catch {
      /* nothing left to try */
    }
  }

  // Nothing could draw this token. Say which intervals a source COULD have
  // served so the chart does not disable every button on a transient miss.
  return { ...empty, intervals: coinId ? COINGECKO_INTERVALS : ALL_INTERVALS }
}

/** The on-chain source: OHLCV from the deepest pool holding this token. */
async function fromPool(
  slug: string,
  token: string,
  interval: string,
  timeframe: { timeframe: string; aggregate: number },
  signal: AbortSignal,
): Promise<Payload | null> {
  const pool = await findPool(slug, token, signal)
  if (!pool) return null

  const url = new URL(`${GECKO}/networks/${slug}/pools/${pool}/ohlcv/${timeframe.timeframe}`)
  url.searchParams.set("aggregate", String(timeframe.aggregate))
  url.searchParams.set("limit", "1000")
  url.searchParams.set("currency", "usd")
  // Price OUR token, not the pool's base. In a TOKEN/SOL pool the base is the
  // token, but in a USDC/TOKEN pool it is not, and charting the base blindly
  // would draw the price upside down.
  url.searchParams.set("token", token)

  const [ohlcvResponse, poolResponse] = await Promise.all([
    fetch(url, { headers: { accept: "application/json" }, signal }),
    fetch(`${GECKO}/networks/${slug}/pools/${pool}`, {
      headers: { accept: "application/json" },
      signal,
    }),
  ])
  if (!ohlcvResponse.ok) return null

  const body = (await ohlcvResponse.json()) as {
    data?: { attributes?: { ohlcv_list?: (number | string)[][] } }
  }
  const candles: Candle[] = normalizeOhlcv(body.data?.attributes?.ohlcv_list)
  if (candles.length === 0) return null

  // Price and change come from the series, which is priced in OUR token.
  // Volume is a property of the pool and reads the same from either side.
  let volume24h: number | null = null
  if (poolResponse.ok) {
    const poolBody = (await poolResponse.json()) as {
      data?: { attributes?: { volume_usd?: Record<string, string> } }
    }
    volume24h = num(poolBody.data?.attributes?.volume_usd?.h24)
  }

  return {
    candles,
    stats: { ...stats24hFrom(candles), volume24h },
    source: "geckoterminal",
    intervals: ALL_INTERVALS,
  }
}

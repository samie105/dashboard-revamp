/**
 * The pure parts of the DEX chart source — pool choice and candle
 * normalisation — kept out of the route handler so they can be tested without
 * standing up a request.
 *
 * Both are places a wrong answer is invisible rather than loud: charting a
 * thin pool draws real-looking candles nobody could have traded, and handing
 * lightweight-charts an out-of-order or duplicated timestamp makes it throw
 * mid-render.
 */

export type Candle = {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export function num(value: unknown): number | null {
  const n =
    typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN
  return Number.isFinite(n) ? n : null
}

type PoolRow = {
  id?: string
  attributes?: { address?: string; reserve_in_usd?: string | number }
}

/**
 * The pool to chart: the deepest one.
 *
 * A token trades in many pools and the thin ones print noise — a $200 pool
 * shows a 60% "candle" against a few dollars of flow. Depth is the only sane
 * tiebreak, and it is also the pool an order actually routes through. The
 * upstream does NOT return these sorted by liquidity, so this must sort.
 */
export function pickBestPool(rows: readonly PoolRow[] | undefined): string | null {
  const best = (rows ?? [])
    .map((row) => ({
      // `id` is "<chain>_<address>"; prefer the explicit attribute where given.
      address:
        row.attributes?.address ??
        String(row.id ?? "")
          .split("_")
          .slice(1)
          .join("_"),
      liquidity: num(row.attributes?.reserve_in_usd) ?? 0,
    }))
    .filter((row) => row.address)
    .sort((a, b) => b.liquidity - a.liquidity)[0]
  return best?.address ?? null
}

/**
 * `[timestamp, open, high, low, close, volume]` rows → candles the chart can
 * take: ascending, deduplicated, and free of unparseable entries.
 */
export function normalizeOhlcv(rows: readonly (number | string)[][] | undefined): Candle[] {
  return (rows ?? [])
    .map((row) => ({
      time: Number(row[0]),
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
      volume: Number(row[5]) || 0,
    }))
    .filter(
      (c) =>
        Number.isFinite(c.time) &&
        Number.isFinite(c.open) &&
        Number.isFinite(c.high) &&
        Number.isFinite(c.low) &&
        Number.isFinite(c.close),
    )
    // Upstream returns newest-first; the chart requires strictly ascending
    // time and throws on a duplicate timestamp.
    .sort((a, b) => a.time - b.time)
    .filter((c, i, all) => i === 0 || c.time !== all[i - 1].time)
}

/**
 * Last price and 24h change, taken from the candles themselves.
 *
 * The pool endpoint reports `base_token_price_usd` and an h24 change for its
 * BASE token — but the token we care about is the quote in roughly half of
 * these pools (a USDC/TOKEN pair as easily as a TOKEN/SOL one). The candle
 * series is already priced in our token, because the OHLCV request names it,
 * so deriving from the series cannot pick the wrong side.
 *
 * The change is `null` unless the series actually spans 24 hours — a 1m chart
 * holds about sixteen. Labelling a sixteen-hour move "24h" is the kind of
 * quiet wrongness this codebase refuses elsewhere.
 */
export function stats24hFrom(candles: readonly Candle[]): {
  price: number | null
  changePct24h: number | null
} {
  if (candles.length === 0) return { price: null, changePct24h: null }
  const last = candles[candles.length - 1]
  const cutoff = last.time - 24 * 60 * 60
  if (candles[0].time > cutoff) return { price: last.close, changePct24h: null }

  // The first bar at or after the cutoff — the open 24h ago.
  let reference = candles[0]
  for (const candle of candles) {
    if (candle.time >= cutoff) {
      reference = candle
      break
    }
  }
  const base = reference.open || reference.close
  if (!base) return { price: last.close, changePct24h: null }
  return { price: last.close, changePct24h: ((last.close - base) / base) * 100 }
}

/** Bar length in seconds for each interval the chart offers. */
export const INTERVAL_SECONDS: Record<string, number> = {
  "1m": 60,
  "5m": 5 * 60,
  "15m": 15 * 60,
  "1h": 60 * 60,
  "4h": 4 * 60 * 60,
  "1d": 24 * 60 * 60,
}

/**
 * Price samples → candles, bucketed to an exact interval.
 *
 * The pool source serves real OHLC. The fallback source serves a PRICE SERIES
 * — a sampled line, not trades — so bars are derived here: open is the first
 * sample in the bucket, close the last, high and low the extremes of what was
 * sampled. That is an honest summary of the samples and nothing more, which is
 * why a chart drawn this way reports its source rather than passing itself off
 * as tick data.
 *
 * Volume is not derivable from a price series and is left at zero rather than
 * invented; the histogram simply doesn't draw.
 */
export function bucketPrices(
  points: readonly (readonly [number, number])[] | undefined,
  intervalSeconds: number,
): Candle[] {
  if (!points?.length || intervalSeconds <= 0) return []
  const buckets = new Map<number, Candle>()

  for (const point of points) {
    const ms = Number(point?.[0])
    const price = Number(point?.[1])
    if (!Number.isFinite(ms) || !Number.isFinite(price)) continue
    const seconds = Math.floor(ms / 1000)
    const time = Math.floor(seconds / intervalSeconds) * intervalSeconds
    const existing = buckets.get(time)
    if (!existing) {
      buckets.set(time, { time, open: price, high: price, low: price, close: price, volume: 0 })
      continue
    }
    // Samples arrive in order, so the last one seen closes the bar.
    existing.high = Math.max(existing.high, price)
    existing.low = Math.min(existing.low, price)
    existing.close = price
  }

  return [...buckets.values()].sort((a, b) => a.time - b.time)
}

/**
 * Birdeye's `defi/ohlcv` items → candles.
 *
 * Real per-bar OHLC with volume, keyed by token address, on every chain we
 * route — so this is the source that lets the chart stop apologising: true
 * candles at every interval including 1m, where the price-series fallback
 * cannot go below five minutes.
 *
 * `vUsd` is the dollar volume and is the one worth plotting; some chains
 * return only the token-denominated `v`, and a bar with neither reports zero
 * rather than a guess.
 */
export function normalizeBirdeye(
  items: readonly Record<string, unknown>[] | undefined,
): Candle[] {
  return (items ?? [])
    .map((item) => ({
      time: Number(item.unixTime),
      open: Number(item.o),
      high: Number(item.h),
      low: Number(item.l),
      close: Number(item.c),
      volume: Number(item.vUsd ?? item.v) || 0,
    }))
    .filter(
      (c) =>
        Number.isFinite(c.time) &&
        Number.isFinite(c.open) &&
        Number.isFinite(c.high) &&
        Number.isFinite(c.low) &&
        Number.isFinite(c.close),
    )
    .sort((a, b) => a.time - b.time)
    .filter((c, i, all) => i === 0 || c.time !== all[i - 1].time)
}

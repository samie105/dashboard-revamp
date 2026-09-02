import { describe, it, expect } from "vitest"
import {
  pickBestPool,
  normalizeOhlcv,
  stats24hFrom,
  bucketPrices,
  INTERVAL_SECONDS,
  normalizeBirdeye,
} from "@/lib/chart-ohlcv"

const HOUR = 3600

describe("pickBestPool", () => {
  it("picks the deepest pool, not the first one returned", () => {
    // The upstream genuinely returns these unsorted — the live TRUMP response
    // leads with a $19.7M pool and lists a $21.3M one second.
    const rows = [
      { id: "solana_shallow", attributes: { address: "shallow", reserve_in_usd: "19747598.18" } },
      { id: "solana_deep", attributes: { address: "deep", reserve_in_usd: "21368304.03" } },
      { id: "solana_dust", attributes: { address: "dust", reserve_in_usd: "1002599.56" } },
    ]
    expect(pickBestPool(rows)).toBe("deep")
  })

  it("falls back to the address embedded in the id", () => {
    expect(pickBestPool([{ id: "solana_ABC123" }])).toBe("ABC123")
  })

  it("treats a missing reserve as zero rather than NaN-sorting the list", () => {
    const rows = [
      { id: "a", attributes: { address: "a" } },
      { id: "b", attributes: { address: "b", reserve_in_usd: "5" } },
    ]
    expect(pickBestPool(rows)).toBe("b")
  })

  it("returns null for no pools", () => {
    expect(pickBestPool([])).toBeNull()
    expect(pickBestPool(undefined)).toBeNull()
  })
})

describe("normalizeOhlcv", () => {
  it("reverses the upstream's newest-first order", () => {
    const rows = [
      [300, 3, 3, 3, 3, 1],
      [200, 2, 2, 2, 2, 1],
      [100, 1, 1, 1, 1, 1],
    ]
    expect(normalizeOhlcv(rows).map((c) => c.time)).toEqual([100, 200, 300])
  })

  it("drops duplicate timestamps — the chart throws on them", () => {
    const rows = [
      [100, 1, 1, 1, 1, 1],
      [100, 9, 9, 9, 9, 9],
      [200, 2, 2, 2, 2, 2],
    ]
    expect(normalizeOhlcv(rows).map((c) => c.time)).toEqual([100, 200])
  })

  it("drops unparseable rows rather than charting NaN", () => {
    const rows = [
      [100, 1, 1, 1, 1, 1],
      ["bad", "x", "x", "x", "x", "x"],
      [200, 2, 2, 2, 2, 2],
    ]
    expect(normalizeOhlcv(rows)).toHaveLength(2)
  })

  it("accepts the upstream's numeric strings", () => {
    const [candle] = normalizeOhlcv([["100", "1.5", "2", "1", "1.75", "42"]])
    expect(candle).toEqual({ time: 100, open: 1.5, high: 2, low: 1, close: 1.75, volume: 42 })
  })

  it("defaults a missing volume to zero, not NaN", () => {
    expect(normalizeOhlcv([[100, 1, 1, 1, 1]])[0].volume).toBe(0)
  })
})

describe("stats24hFrom", () => {
  const series = (count: number, step: number, closes: (i: number) => number) =>
    Array.from({ length: count }, (_, i) => {
      const value = closes(i)
      return { time: i * step, open: value, high: value, low: value, close: value, volume: 0 }
    })

  it("prices from the last bar, so it always matches the chart", () => {
    const candles = series(48, HOUR, (i) => 100 + i)
    expect(stats24hFrom(candles).price).toBe(147)
  })

  it("measures the change over exactly 24 hours", () => {
    // 48 hourly bars, last at t=47h closing 147. The cutoff is t=23h, whose
    // bar opens at 123 — that is the price 24 hours ago.
    const candles = series(48, HOUR, (i) => 100 + i)
    const { changePct24h } = stats24hFrom(candles)
    expect(changePct24h).toBeCloseTo(((147 - 123) / 123) * 100, 6)
  })

  it("refuses a change the series cannot support", () => {
    // Sixteen hours of 1m bars is not a 24h move, whatever the label says.
    const candles = series(16, HOUR, () => 100)
    const stats = stats24hFrom(candles)
    expect(stats.price).toBe(100)
    expect(stats.changePct24h).toBeNull()
  })

  it("reports a negative move as negative", () => {
    const candles = series(48, HOUR, (i) => 200 - i)
    expect(stats24hFrom(candles).changePct24h).toBeLessThan(0)
  })

  it("says nothing at all for an empty series", () => {
    expect(stats24hFrom([])).toEqual({ price: null, changePct24h: null })
  })
})

describe("bucketPrices", () => {
  /* The fallback source serves a sampled price line, not trades. These bars
     are a summary of the samples — which is why the chart names the source. */
  const at = (minutes: number, price: number): [number, number] => [minutes * 60_000, price]

  it("opens on the first sample of a bar and closes on the last", () => {
    const candles = bucketPrices(
      [at(0, 10), at(1, 12), at(2, 8), at(3, 11)],
      INTERVAL_SECONDS["1h"],
    )
    expect(candles).toHaveLength(1)
    expect(candles[0]).toMatchObject({ open: 10, high: 12, low: 8, close: 11 })
  })

  it("splits samples into the interval actually asked for", () => {
    const candles = bucketPrices(
      [at(0, 1), at(4, 2), at(5, 3), at(9, 4), at(10, 5)],
      INTERVAL_SECONDS["5m"],
    )
    expect(candles.map((c) => c.close)).toEqual([2, 4, 5])
    expect(candles.map((c) => c.time)).toEqual([0, 300, 600])
  })

  it("aligns bars to the interval, not to the first sample", () => {
    // A sample at 07:23 belongs to the 07:00 bar, not to a bar starting 07:23.
    const candles = bucketPrices([at(443, 5)], INTERVAL_SECONDS["1h"])
    expect(candles[0].time % INTERVAL_SECONDS["1h"]).toBe(0)
  })

  it("leaves volume at zero — a price series has none to report", () => {
    const candles = bucketPrices([at(0, 1), at(1, 2)], INTERVAL_SECONDS["15m"])
    expect(candles.every((c) => c.volume === 0)).toBe(true)
  })

  it("returns bars in ascending time even from unordered samples", () => {
    const candles = bucketPrices(
      [at(120, 3), at(0, 1), at(60, 2)],
      INTERVAL_SECONDS["1h"],
    )
    expect(candles.map((c) => c.time)).toEqual([0, 3600, 7200])
  })

  it("drops unparseable samples instead of charting NaN", () => {
    const points = [at(0, 1), [NaN, 5], [60_000, Number.NaN]] as [number, number][]
    const candles = bucketPrices(points, INTERVAL_SECONDS["1h"])
    expect(candles).toHaveLength(1)
    expect(candles[0].close).toBe(1)
  })

  it("says nothing for no samples", () => {
    expect(bucketPrices([], 3600)).toEqual([])
    expect(bucketPrices(undefined, 3600)).toEqual([])
  })
})

describe("normalizeBirdeye", () => {
  /* Shaped from a live response: real OHLC per bar, with `vUsd` alongside the
     token-denominated `v`. */
  const bar = (over: Record<string, unknown> = {}) => ({
    unixTime: 1788174000,
    address: "So11111111111111111111111111111111111111112",
    o: 103.63,
    h: 104.31,
    l: 102.86,
    c: 103.54,
    v: 2921511.52,
    vUsd: 303059348.82,
    type: "1H",
    ...over,
  })

  it("maps the venue's single-letter fields onto candles", () => {
    expect(normalizeBirdeye([bar()])[0]).toEqual({
      time: 1788174000,
      open: 103.63,
      high: 104.31,
      low: 102.86,
      close: 103.54,
      volume: 303059348.82,
    })
  })

  it("prefers dollar volume, and falls back to the token amount", () => {
    // Some chains return no `vUsd` at all — Ethereum did, in testing.
    expect(normalizeBirdeye([bar({ vUsd: undefined })])[0].volume).toBe(2921511.52)
    expect(normalizeBirdeye([bar({ vUsd: undefined, v: undefined })])[0].volume).toBe(0)
  })

  it("sorts ascending and drops duplicate timestamps", () => {
    const rows = [bar({ unixTime: 300 }), bar({ unixTime: 100 }), bar({ unixTime: 100 })]
    expect(normalizeBirdeye(rows).map((c) => c.time)).toEqual([100, 300])
  })

  it("drops bars that cannot be read rather than charting NaN", () => {
    expect(normalizeBirdeye([bar({ c: "n/a" }), bar({ unixTime: 200 })])).toHaveLength(1)
  })

  it("says nothing for an absent list", () => {
    expect(normalizeBirdeye(undefined)).toEqual([])
    expect(normalizeBirdeye([])).toEqual([])
  })
})

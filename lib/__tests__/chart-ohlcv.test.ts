import { describe, it, expect } from "vitest"
import { pickBestPool, normalizeOhlcv, stats24hFrom } from "@/lib/chart-ohlcv"

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

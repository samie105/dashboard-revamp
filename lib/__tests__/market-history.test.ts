import { describe, expect, it } from "vitest"

import { buildMarketHistory, dailyVolumes, listAssets, sumAligned, thin, type Points } from "@/lib/market-history"

const pts = (values: number[]): Points => values.map((v, i) => [i * 3_600_000, v])
const hourly = (n: number, f: (i: number) => number) => Array.from({ length: n }, (_, i) => f(i))

describe("sumAligned", () => {
  it("adds point by point from the newest end", () => {
    expect(sumAligned([[1, 2, 3], [10, 20]])).toEqual([12, 23])
    expect(sumAligned([])).toEqual([])
  })
})

describe("thin", () => {
  it("keeps short series and always the last point", () => {
    expect(thin([1, 2, 3])).toEqual([1, 2, 3])
    const out = thin(hourly(169, (i) => i), 48)
    expect(out.length).toBeLessThanOrEqual(50)
    expect(out[0]).toBe(0)
    expect(out[out.length - 1]).toBe(168)
  })
})

describe("dailyVolumes", () => {
  it("reads the rolling 24h value once a day, oldest first, latest last", () => {
    const series = hourly(169, (i) => i)
    expect(dailyVolumes(series)).toEqual([24, 48, 72, 96, 120, 144, 168])
  })
  it("needs a full week", () => {
    expect(dailyVolumes(hourly(100, () => 1))).toBeNull()
  })
})

describe("buildMarketHistory", () => {
  const chart = (cap: number, vol: number) => ({ market_caps: pts(hourly(169, () => cap)), total_volumes: pts(hourly(169, () => vol)) })

  it("sums the assets' caps and daily volumes", () => {
    const h = buildMarketHistory([chart(100, 10), chart(50, 5)], ["BTC", "ETH"])!
    expect(h.assets).toEqual(["BTC", "ETH"])
    expect(h.capSeries.every((v) => v === 150)).toBe(true)
    expect(h.volumeDays).toEqual([15, 15, 15, 15, 15, 15, 15])
  })
  it("draws nothing if any asset is missing data", () => {
    expect(buildMarketHistory([chart(100, 10), { market_caps: [], total_volumes: [] }], ["BTC", "ETH"])).toBeNull()
    expect(buildMarketHistory([], [])).toBeNull()
  })
})

describe("listAssets", () => {
  it("names the covered assets", () => {
    expect(listAssets(["BTC", "ETH", "USDT"])).toBe("BTC, ETH and USDT")
    expect(listAssets(["BTC"])).toBe("BTC")
  })
})

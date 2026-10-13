import { describe, expect, it } from "vitest"

import {
  activeOf,
  breadthOf,
  change7d,
  filterCoins,
  filterFutures,
  formatFunding,
  formatLarge,
  formatPrice,
  futuresTotals,
  gainersOf,
  losersOf,
  pageOf,
  subtitleFor,
} from "@/lib/markets-view"
import type { CoinData, FuturesMarket } from "@/lib/actions"

const coin = (symbol: string, over: Partial<CoinData> = {}): CoinData => ({
  id: symbol.toLowerCase(),
  symbol,
  name: `${symbol} coin`,
  price: 1,
  change24h: 0,
  marketCap: 0,
  volume24h: 0,
  image: "",
  ...over,
})

const fut = (symbol: string, over: Partial<FuturesMarket> = {}) =>
  ({ symbol, baseAsset: symbol.split("-")[0], markPrice: 1, change24h: 0, volume24h: 0, openInterest: 0, fundingRate: 0, maxLeverage: 10, ...over }) as FuturesMarket

const moves: Record<string, number> = { BTC: 2, ETH: -3, SOL: 5, USDT: 0 }
const changeOf = (c: CoinData) => moves[c.symbol] ?? 0
const COINS = ["BTC", "ETH", "SOL", "USDT"].map((s) => coin(s))

describe("formatting", () => {
  it("never prints a missing figure as $0", () => {
    expect(formatLarge(0)).toBe("—")
    expect(formatLarge(1_900_000_000_000)).toBe("$1.9T")
    expect(formatPrice(0)).toBe("—")
    expect(formatPrice(96420.5)).toBe("96,420.50")
    expect(formatPrice(0.000123)).toBe("0.000123")
    expect(formatFunding(0.0001)).toBe("+0.0100%")
    expect(formatFunding(-0.0001)).toBe("−0.0100%")
  })
})

describe("movers", () => {
  it("ranks on the page's own change resolver", () => {
    expect(gainersOf(COINS, changeOf).map((c) => c.symbol)).toEqual(["SOL", "BTC"])
    expect(losersOf(COINS, changeOf).map((c) => c.symbol)).toEqual(["ETH"])
    expect(activeOf(COINS, changeOf).map((c) => c.symbol).slice(0, 3)).toEqual(["SOL", "ETH", "BTC"])
  })
  it("reports no breadth when nothing moved", () => {
    expect(breadthOf(COINS, changeOf)).toEqual({ advancing: 2, declining: 1, pct: (2 / 3) * 100 })
    expect(breadthOf(COINS, () => 0)).toBeNull()
  })
})

describe("table", () => {
  const list = [coin("BTC", { marketCap: 3, volume24h: 1, price: 30 }), coin("ETH", { marketCap: 2, volume24h: 3, price: 20 }), coin("SOL", { marketCap: 1, volume24h: 2, price: 10 })]
  const base = { search: "", sortBy: "marketCap" as const, sortAsc: false, onChain: null }

  it("sorts by the chosen column outside Total", () => {
    expect(filterCoins(list, { ...base, tab: "Main" }).map((c) => c.symbol)).toEqual(["BTC", "ETH", "SOL"])
    expect(filterCoins(list, { ...base, tab: "Main", sortAsc: true }).map((c) => c.symbol)).toEqual(["SOL", "ETH", "BTC"])
  })
  it("keeps the previous Total-tab rule: descending orders by volume", () => {
    expect(filterCoins(list, { ...base, tab: "Total" }).map((c) => c.symbol)).toEqual(["ETH", "SOL", "BTC"])
  })
  it("searches symbol and name, and narrows to a chain", () => {
    expect(filterCoins(list, { ...base, tab: "Main", search: "eth" }).map((c) => c.symbol)).toEqual(["ETH"])
    expect(filterCoins(list, { ...base, tab: "Main", onChain: (s) => s === "SOL" }).map((c) => c.symbol)).toEqual(["SOL"])
  })
  it("caps Main at 20 unless searching", () => {
    const many = Array.from({ length: 30 }, (_, i) => coin(`C${i}`, { marketCap: i }))
    expect(filterCoins(many, { ...base, tab: "Main" })).toHaveLength(20)
    expect(filterCoins(many, { ...base, tab: "Main", search: "c" })).toHaveLength(30)
  })
  it("sorts futures, open interest by default", () => {
    const f = [fut("A-PERP", { openInterest: 1, volume24h: 9 }), fut("B-PERP", { openInterest: 5, volume24h: 1 })]
    expect(filterFutures(f, { search: "", sortBy: "marketCap", sortAsc: false }).map((m) => m.symbol)).toEqual(["B-PERP", "A-PERP"])
    expect(filterFutures(f, { search: "", sortBy: "volume24h", sortAsc: false }).map((m) => m.symbol)).toEqual(["A-PERP", "B-PERP"])
  })
  it("pages 50 at a time and never lands past the end", () => {
    expect(pageOf(120, 0)).toEqual({ pageCount: 3, safePage: 0, start: 0, end: 50 })
    expect(pageOf(120, 9)).toEqual({ pageCount: 3, safePage: 2, start: 100, end: 120 })
    expect(pageOf(0, 3).pageCount).toBe(1)
  })
})

describe("futures and headings", () => {
  it("totals the venue", () => {
    expect(futuresTotals([fut("A", { volume24h: 2, openInterest: 3, fundingRate: 0.1 }), fut("B", { volume24h: 4, openInterest: 1, fundingRate: 0.3 })])).toEqual({ volume: 6, openInterest: 4, avgFunding: 0.2, contracts: 2 })
    expect(futuresTotals([]).avgFunding).toBe(0)
  })
  it("titles each tab as before", () => {
    const n = { coins: 35, spot: 120, futures: 80 }
    expect(subtitleFor("Total", n, false)).toBe("Real-time prices for 35 assets")
    expect(subtitleFor("Spot", n, false)).toBe("Worldstreet spot markets · 120 assets")
    expect(subtitleFor("Futures", n, false)).toBe("Perpetual futures · 80 contracts")
    expect(subtitleFor("Futures", n, true)).toBe("Perpetual futures")
  })
})

describe("7-day move", () => {
  it("measures the series' last point against its first", () => {
    expect(change7d([100, 90, 110])).toBeCloseTo(10)
    expect(change7d([200, 150])).toBeCloseTo(-25)
  })
  it("has no move without a series", () => {
    expect(change7d(undefined)).toBeNull()
    expect(change7d(null)).toBeNull()
    expect(change7d([5])).toBeNull()
    expect(change7d([0, 5])).toBeNull()
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { __mockLaunchesAt, candlesFor, curveFor, holdersFor, priceAt, tradesFor, parseLaunchMockState, mockLaunchpadMarket } from "@/lib/launchpad-market/mock"
import { buyShare, compactUsd, searchBoard, signedPct, sortBoard, tinyPrice, type BoardRow } from "@/lib/launchpad-market/view"
import { cardView } from "@/lib/launchpad-view"
import { MarketUnavailableError, type LaunchMarketStats } from "@/lib/launchpad-market/types"

async function importUnderEnv<T>(env: Record<string, string | undefined>, loader: () => Promise<T>): Promise<T> {
  vi.resetModules()
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value ?? "")
  return loader()
}

beforeEach(() => vi.unstubAllEnvs())
afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

const NOW = Date.parse("2026-11-14T12:00:00Z")
const launches = __mockLaunchesAt(NOW)
const lion = launches.find((l) => l.token.symbol === "LION")!
const puff = launches.find((l) => l.token.symbol === "PUFF")!

describe("LAUNCHPAD_MOCKS_ENABLED gate", () => {
  it("is false in a production build even with the opt-in set", async () => {
    const { LAUNCHPAD_MOCKS_ENABLED } = await importUnderEnv({ NODE_ENV: "production", NEXT_PUBLIC_LAUNCHPAD_MOCKS: "true" }, () => import("@/lib/launchpad-mocks"))
    expect(LAUNCHPAD_MOCKS_ENABLED).toBe(false)
  })
  it("is true only in development with the opt-in set", async () => {
    expect((await importUnderEnv({ NODE_ENV: "development", NEXT_PUBLIC_LAUNCHPAD_MOCKS: "true" }, () => import("@/lib/launchpad-mocks"))).LAUNCHPAD_MOCKS_ENABLED).toBe(true)
    expect((await importUnderEnv({ NODE_ENV: "development", NEXT_PUBLIC_LAUNCHPAD_MOCKS: undefined }, () => import("@/lib/launchpad-mocks"))).LAUNCHPAD_MOCKS_ENABLED).toBe(false)
  })
})

describe("live source", () => {
  it("in production says market data isn't available instead of inventing it", async () => {
    const { launchpadMarket } = await importUnderEnv({ NODE_ENV: "production", NEXT_PUBLIC_LAUNCHPAD_MOCKS: "true" }, () => import("@/lib/launchpad-market/source"))
    expect(launchpadMarket.isMock).toBe(false)
    const results = await Promise.allSettled([launchpadMarket.stats("solana-mainnet-beta"), launchpadMarket.candles("x", "24h"), launchpadMarket.trades("x"), launchpadMarket.holders("x"), launchpadMarket.portfolio("solana-devnet")])
    // The module was re-imported, so compare by name rather than class identity.
    for (const r of results) expect(r).toMatchObject({ status: "rejected", reason: { name: "MarketUnavailableError" } })
    expect(new MarketUnavailableError("x").name).toBe("MarketUnavailableError")
  })
})

describe("mock market", () => {
  it("keeps mainnet and devnet launches apart", () => {
    const nets = new Set(launches.map((l) => l.token.networkId))
    expect(nets).toEqual(new Set(["solana-mainnet-beta", "solana-devnet"]))
    expect(launches.filter((l) => l.token.networkId === "solana-devnet").every((l) => l.token.launchId.startsWith("mock-dev-"))).toBe(true)
  })

  it("has no price before a launch existed", () => {
    expect(priceAt(lion, lion.createdMs - 1, NOW)).toBeNull()
    expect(priceAt(lion, NOW, NOW)).toBeGreaterThan(0)
  })

  it("draws candles inside the range, oldest first, with sane OHLC", () => {
    const candles = candlesFor(lion, "24h", NOW)
    expect(candles.length).toBeGreaterThan(80)
    expect(candles[0]!.t).toBeGreaterThanOrEqual(NOW - 24 * 3_600_000 - 15 * 60_000)
    for (let i = 1; i < candles.length; i++) expect(candles[i]!.t).toBeGreaterThan(candles[i - 1]!.t)
    for (const c of candles) {
      expect(c.h).toBeGreaterThanOrEqual(Math.max(c.o, c.c))
      expect(c.l).toBeLessThanOrEqual(Math.min(c.o, c.c))
      expect(c.v).toBeGreaterThanOrEqual(0)
    }
  })

  it("never draws history older than the launch", () => {
    const candles = candlesFor(puff, "7d", NOW)
    expect(candles.every((c) => c.t + 60 * 60_000 > puff.createdMs)).toBe(true)
    expect(candlesFor(puff, "all", NOW).length).toBeGreaterThan(0)
  })

  it("lists trades newest first, priced on the same curve", () => {
    const trades = tradesFor(lion, NOW)
    const times = trades.map((t) => Date.parse(t.at))
    expect(times).toEqual([...times].sort((a, b) => b - a))
    for (const t of trades) expect(t.priceSol).toBeCloseTo(priceAt(lion, Date.parse(t.at), NOW)!, 12)
  })

  it("splits holders into at most 100% with the curve first", () => {
    const holders = holdersFor(lion)
    expect(holders[0]!.kind).toBe("curve")
    expect(holders.reduce((s, h) => s + h.pct, 0)).toBeLessThanOrEqual(100.01)
  })

  it("curves rise with SOL raised", () => {
    const pts = curveFor(lion, NOW).points.map((p) => p.price)
    expect(pts).toEqual([...pts].sort((a, b) => a - b))
  })

  it("serves stats whose 24h change matches its own price function", async () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] })
    try {
      const stats = await mockLaunchpadMarket.stats("solana-mainnet-beta")
      const s = stats[lion.token.launchId]!
      const expected = (priceAt(lion, NOW, NOW)! / priceAt(lion, NOW - 86_400_000, NOW)! - 1) * 100
      expect(s.changePct["24h"]).toBeCloseTo(expected, 6)
      expect(stats[puff.token.launchId]!.changePct["24h"]).toBeNull() // younger than a day
      expect(Object.values(stats).every((x) => !x.launchId.startsWith("mock-dev-"))).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it("only accepts known mock states", () => {
    expect(parseLaunchMockState("empty")).toBe("empty")
    expect(parseLaunchMockState("nope")).toBe("ok")
  })
})

describe("board helpers", () => {
  const stats = (id: string, vol: number, change: number | null, mcap: number): LaunchMarketStats => ({
    launchId: id, priceSol: 1e-8, priceUsd: null, marketCapUsd: mcap, holders: 1,
    changePct: { "5m": change, "1h": change, "6h": change, "24h": change },
    volumeUsd: { "5m": vol, "1h": vol, "6h": vol, "24h": vol },
    txns: { "5m": { buys: 1, sells: 1 }, "1h": { buys: 1, sells: 1 }, "6h": { buys: 1, sells: 1 }, "24h": { buys: 1, sells: 1 } },
    spark: { "5m": [], "1h": [], "6h": [], "24h": [] },
  })
  const rows: BoardRow[] = launches.filter((l) => l.token.networkId === "solana-mainnet-beta").slice(0, 3).map((l, i) => ({
    card: cardView(l.token),
    stats: i === 2 ? null : stats(l.token.launchId, [500, 900][i]!, [-5, 30][i]!, [9e5, 2e5][i]!),
  }))

  it("sorts by the window's volume and change, with missing stats last", () => {
    expect(sortBoard(rows, "trending", "1h").map((r) => r.card.id)).toEqual([rows[1]!.card.id, rows[0]!.card.id, rows[2]!.card.id])
    expect(sortBoard(rows, "gainers", "1h")[0]!.card.id).toBe(rows[1]!.card.id)
    expect(sortBoard(rows, "mcap", "1h")[0]!.card.id).toBe(rows[0]!.card.id)
    expect(sortBoard(rows, "trending", "1h").at(-1)!.stats).toBeNull()
  })

  it("searches by name, ticker or exact mint", () => {
    expect(searchBoard(rows, "lion").map((r) => r.card.symbol)).toEqual(["LION"])
    expect(searchBoard(rows, rows[1]!.card.mint!).length).toBe(1)
    expect(searchBoard(rows, "")).toEqual(rows)
  })

  it("formats tiny prices with a subscript zero count", () => {
    expect(tinyPrice(0.000003015)).toBe("0.0₅302")
    expect(tinyPrice(2.84e-8, "SOL")).toBe("0.0₇284 SOL")
    expect(tinyPrice(9.9996e-6)).toBe("0.0₄1")
    expect(tinyPrice(0.0123)).toBe("0.0123")
    expect(tinyPrice(0)).toBe("—")
    expect(tinyPrice(null)).toBe("—")
  })

  it("formats money, changes and buy share", () => {
    expect(compactUsd(1_534_000)).toBe("$1.53M")
    expect(compactUsd(4_200)).toBe("$4.2K")
    expect(signedPct(12.44)).toBe("+12.4%")
    expect(signedPct(-3.06)).toBe("−3.1%")
    expect(signedPct(null)).toBe("—")
    expect(buyShare({ buys: 3, sells: 1 })).toBe(75)
    expect(buyShare({ buys: 0, sells: 0 })).toBe(50)
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { byMarket, bySide, exitCounts, fillsInRange, isClose, pnlCurve, protection, recentCloses, tradingTotals, triggerKind } from "@/lib/trading-analytics"
import { mockOrders, mockTrading, mockWalletRows } from "@/lib/analytics-mock"
import { outcomes } from "@/lib/analytics-view"
import type { HlFill, HlOpenOrder, HlPosition } from "@/lib/crypto-api"

let seq = 0
function fill(p: Partial<HlFill>): HlFill {
  seq += 1
  return { oid: seq, tid: `t${seq}`, symbol: "BTC", side: "sell", price: 100, size: 1, direction: "Close Long", closedPnl: 0, fee: 0, feeToken: "USDC", timestamp: 1_000 + seq, ...p }
}

describe("isClose", () => {
  it("counts fills that closed or reduced, including a break-even close", () => {
    expect(isClose(fill({ direction: "Open Long", closedPnl: 0 }))).toBe(false)
    expect(isClose(fill({ direction: "Close Long", closedPnl: 0 }))).toBe(true)
    expect(isClose(fill({ direction: "Long > Short", closedPnl: -4 }))).toBe(true)
  })
})

describe("tradingTotals", () => {
  it("sums realised P&L, USDC fees, volume and win rate", () => {
    const t = tradingTotals([
      fill({ direction: "Open Long", price: 100, size: 2, fee: 0.1 }),
      fill({ closedPnl: 30, price: 110, size: 2, fee: 0.1 }),
      fill({ closedPnl: -10, fee: 0.05 }),
      fill({ direction: "Close Short", closedPnl: 0 }),
      fill({ closedPnl: 5, fee: 1, feeToken: "HYPE" }),
    ])
    expect(t.realisedPnl).toBe(25)
    expect(t.feesUsdc).toBeCloseTo(0.25)
    expect(t.otherFeeFills).toBe(1)
    expect(t.netPnl).toBeCloseTo(24.75)
    expect(t.volumeUsd).toBe(200 + 220 + 100 + 100 + 100)
    expect(t.closed).toBe(4)
    expect([t.wins, t.losses]).toEqual([2, 1])
    expect(t.winRate).toBeCloseTo(2 / 3) // the break-even close counts as neither
    expect(t.avgWin).toBe(17.5)
    expect(t.avgLoss).toBe(-10)
    expect(t.profitFactor).toBe(3.5)
    expect(t.best?.closedPnl).toBe(30)
    expect(t.worst?.closedPnl).toBe(-10)
  })

  it("has no win rate, profit factor or best/worst without the trades to back them", () => {
    const t = tradingTotals([fill({ direction: "Open Long" })])
    expect([t.winRate, t.profitFactor, t.best, t.worst]).toEqual([null, null, null, null])
  })
})

describe("series", () => {
  it("runs the P&L total oldest first over closes only", () => {
    const c = pnlCurve([fill({ closedPnl: 5, timestamp: 30 }), fill({ direction: "Open Long", timestamp: 10 }), fill({ closedPnl: -2, timestamp: 20 })])
    expect(c.map((p) => p.pnl)).toEqual([-2, 3])
  })

  it("keeps the latest n closes, oldest first", () => {
    const r = recentCloses([1, 2, 3, 4].map((i) => fill({ closedPnl: i, timestamp: i })), 2)
    expect(r.map((f) => f.closedPnl)).toEqual([3, 4])
  })

  it("filters by days back and drops fills without a time", () => {
    const now = 10 * 86_400_000
    const f = [fill({ timestamp: now - 1 }), fill({ timestamp: now - 8 * 86_400_000 }), fill({ timestamp: 0 })]
    expect(fillsInRange(f, 7, now)).toHaveLength(1)
    expect(fillsInRange(f, Infinity, now)).toHaveLength(2)
  })
})

describe("breakdowns", () => {
  it("ranks markets by the size of their result", () => {
    const m = byMarket([fill({ symbol: "ETH", closedPnl: -50 }), fill({ symbol: "BTC", closedPnl: 20 }), fill({ symbol: "SOL", direction: "Open Long" })])
    expect(m.map((r) => [r.symbol, r.pnl])).toEqual([
      ["ETH", -50],
      ["BTC", 20],
    ])
  })

  it("splits longs and shorts by the fill's direction", () => {
    const s = bySide([fill({ direction: "Close Long", closedPnl: 4 }), fill({ direction: "Close Short", closedPnl: -1 }), fill({ direction: "Close Short", closedPnl: 2 })])
    expect(s.long).toMatchObject({ pnl: 4, closed: 1, winRate: 1 })
    expect(s.short).toMatchObject({ pnl: 1, closed: 2, winRate: 0.5 })
  })
})

describe("protection", () => {
  const pos = (symbol: string, side: "long" | "short", mark: number) => ({ symbol, side, markPrice: mark }) as HlPosition
  const order = (symbol: string, side: "buy" | "sell", orderType: string, triggerPrice: number | null, isTrigger = true) =>
    ({ symbol, side, orderType, triggerPrice, isTrigger }) as HlOpenOrder

  it("reads take-profit and stop orders from the order type", () => {
    expect(triggerKind(order("BTC", "sell", "Take Profit Market", 1))).toBe("tp")
    expect(triggerKind(order("BTC", "sell", "Stop Limit", 1))).toBe("sl")
    expect(triggerKind(order("BTC", "sell", "Limit", 1, false))).toBeNull()
  })

  it("matches triggers on the closing side of the same market, nearest first", () => {
    const [btc, eth] = protection(
      [pos("BTC", "long", 100), pos("ETH", "short", 50)],
      [
        order("BTC", "sell", "Stop Market", 90),
        order("BTC", "sell", "Stop Market", 95),
        order("BTC", "sell", "Take Profit Market", 120),
        order("BTC", "buy", "Stop Market", 105), // wrong side: would open, not close
        order("ETH", "sell", "Stop Market", 55), // wrong side for a short
      ],
    )
    expect(btc).toMatchObject({ stopLoss: 95, takeProfit: 120 })
    expect(btc.stopDistance).toBeCloseTo(0.05)
    expect(eth).toMatchObject({ stopLoss: null, takeProfit: null, stopDistance: null })
  })
})

describe("exitCounts", () => {
  it("counts and sums each exit reason", () => {
    const c = exitCounts([
      { reason: "take-profit", pnl: 10 },
      { reason: "take-profit", pnl: 5 },
      { reason: "liquidation", pnl: -40 },
    ])
    expect(c["take-profit"]).toEqual({ count: 2, pnl: 15 })
    expect(c["stop-loss"]).toEqual({ count: 0, pnl: 0 })
    expect(c.liquidation).toEqual({ count: 1, pnl: -40 })
  })
})

describe("confirm-time bands", () => {
  it("puts each confirmed row in one band", () => {
    const at = (s: number) => ({ id: String(s), type: "deposit" as const, amount: 1, token: "USDC", status: "completed" as const, createdAt: "2026-11-01T00:00:00Z", completedAt: new Date(Date.parse("2026-11-01T00:00:00Z") + s * 1000).toISOString() })
    expect(outcomes([at(3), at(15), at(45), at(200), at(900), at(9)]).settleBands).toEqual([2, 1, 1, 1, 1])
  })
})

describe("sample data gate", () => {
  beforeEach(() => vi.unstubAllEnvs())
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })
  const gate = async (env: Record<string, string>) => {
    vi.resetModules()
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v)
    return (await import("@/lib/analytics-mocks")).ANALYTICS_MOCKS_ENABLED
  }

  it("can never be on in a production build", async () => {
    expect(await gate({ NODE_ENV: "production", NEXT_PUBLIC_ANALYTICS_MOCKS: "true" })).toBe(false)
  })
  it("needs both next dev and the opt-in", async () => {
    expect(await gate({ NODE_ENV: "development", NEXT_PUBLIC_ANALYTICS_MOCKS: "true" })).toBe(true)
    expect(await gate({ NODE_ENV: "development", NEXT_PUBLIC_ANALYTICS_MOCKS: "" })).toBe(false)
  })

  it("draws the same sample on every load, all in the past", () => {
    const now = Date.parse("2026-11-16T12:00:00Z")
    expect(mockTrading(now).fills).toEqual(mockTrading(now).fills)
    expect(mockWalletRows(now).every((r) => Date.parse(r.createdAt) <= now)).toBe(true)
    expect(mockOrders(now).every((o) => Date.parse(o.createdAt) <= now)).toBe(true)
    expect(mockTrading(now).fills.every((f) => f.timestamp <= now)).toBe(true)
  })
})

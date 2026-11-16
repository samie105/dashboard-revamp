import { describe, expect, it } from "vitest"

import {
  bankSummary,
  byAsset,
  byKind,
  byNetwork,
  flowSeries,
  fmtDuration,
  inRange,
  outcomes,
  rhythm,
  totals,
} from "@/lib/analytics-view"
import type { FiatOrder } from "@/lib/crypto-backend/types"
import type { UnifiedTransaction } from "@/types/transactions"

const NOW = new Date(2026, 10, 15, 12, 0, 0) // Sun 15 Nov 2026, local noon

const at = (daysBack: number, hour = 10) => new Date(2026, 10, 15 - daysBack, hour, 0, 0).toISOString()

let seq = 0
function tx(p: Partial<UnifiedTransaction>): UnifiedTransaction {
  seq += 1
  return { id: `t${seq}`, type: "deposit", amount: 1, token: "USDC", status: "completed", createdAt: at(0), ...p }
}

describe("inRange", () => {
  it("counts whole local days, today being day 0", () => {
    const rows = [tx({ createdAt: at(0) }), tx({ createdAt: at(6) }), tx({ createdAt: at(7) }), tx({ createdAt: at(40) })]
    expect(inRange(rows, "7d", NOW)).toHaveLength(2)
    expect(inRange(rows, "30d", NOW)).toHaveLength(3)
    expect(inRange(rows, "all", NOW)).toHaveLength(4)
  })
})

describe("totals", () => {
  it("splits in, out and traded and leaves stopped rows out of volume", () => {
    const t = totals([
      tx({ type: "deposit", valueUsd: 100 }),
      tx({ type: "transfer", subType: "send", direction: "outgoing", valueUsd: 40 }),
      tx({ type: "swap", subType: "spot", valueUsd: 25 }),
      tx({ type: "deposit", valueUsd: 999, status: "failed" }),
    ])
    expect(t.moneyIn).toEqual({ usd: 100, count: 1, unpriced: 0 })
    expect(t.moneyOut).toEqual({ usd: 40, count: 1, unpriced: 0 })
    expect(t.traded).toEqual({ usd: 25, count: 1, unpriced: 0 })
    expect(t.transactions).toBe(4)
  })

  it("never counts an unpriced row as $0: it is reported as unpriced", () => {
    const t = totals([tx({ type: "deposit", valueUsd: 10 }), tx({ type: "deposit", valueUsd: undefined })])
    expect(t.moneyIn).toEqual({ usd: 10, count: 2, unpriced: 1 })
  })

  it("leaves internal transfers out of both sides", () => {
    const t = totals([tx({ type: "transfer", subType: "internal", direction: "internal", valueUsd: 50 })])
    expect(t.moneyIn.count + t.moneyOut.count).toBe(0)
  })
})

describe("flowSeries", () => {
  it("gives one bucket per day for 7D, oldest first, today last", () => {
    const s = flowSeries([tx({ createdAt: at(0), valueUsd: 5 }), tx({ createdAt: at(6), type: "withdrawal", valueUsd: 3 })], "7d", NOW)
    expect(s).toHaveLength(7)
    expect(s[6]).toMatchObject({ in: 5, out: 0, count: 1, span: "day" })
    expect(s[0]).toMatchObject({ in: 0, out: 3, count: 1 })
  })

  it("counts unpriced, stopped and trade rows without adding to flow", () => {
    const s = flowSeries(
      [tx({ valueUsd: undefined }), tx({ valueUsd: 9, status: "failed" }), tx({ type: "swap", valueUsd: 7 })],
      "7d",
      NOW,
    )
    expect(s[6]).toMatchObject({ in: 0, out: 0, count: 3 })
  })

  it("uses 13 weekly buckets for 90D", () => {
    const s = flowSeries([tx({ createdAt: at(80), valueUsd: 2 })], "90d", NOW)
    expect(s).toHaveLength(13)
    expect(s.every((b) => b.span === "week")).toBe(true)
    expect(s.reduce((n, b) => n + b.in, 0)).toBe(2)
  })

  it("switches All to months once the rows go back past half a year", () => {
    const s = flowSeries([tx({ createdAt: at(400), valueUsd: 1 }), tx({ createdAt: at(0), valueUsd: 1 })], "all", NOW)
    expect(s[0].span).toBe("month")
    expect(s.reduce((n, b) => n + b.count, 0)).toBe(2)
  })
})

describe("breakdowns", () => {
  it("ranks kinds by count with the transactions page's tab names", () => {
    const k = byKind([tx({ type: "swap" }), tx({ type: "swap" }), tx({ type: "deposit" })])
    expect(k.map((s) => [s.label, s.count])).toEqual([
      ["Swaps", 2],
      ["Deposits", 1],
    ])
  })

  it("folds networks past the limit into Other", () => {
    const rows = ["solana", "ethereum", "arbitrum", "sui", "tron"].map((chain) => tx({ chain, valueUsd: 1 }))
    const n = byNetwork(rows, 3)
    expect(n).toHaveLength(3)
    expect(n[2]).toMatchObject({ key: "other", count: 3, usd: 3 })
  })

  it("leaves out assets the ledger could not name", () => {
    expect(byAsset([tx({ token: "Unknown" }), tx({ token: "sol" })]).map((s) => s.key)).toEqual(["SOL"])
  })
})

describe("outcomes", () => {
  it("groups statuses as the transactions page does and takes the median settle time", () => {
    const o = outcomes([
      tx({ status: "completed", createdAt: "2026-11-01T10:00:00Z", completedAt: "2026-11-01T10:00:10Z" }),
      tx({ status: "completed", createdAt: "2026-11-01T10:00:00Z", completedAt: "2026-11-01T10:00:30Z" }),
      tx({ status: "processing" }),
      tx({ status: "expired" }),
    ])
    expect(o).toMatchObject({ completed: 2, pending: 1, failed: 1, medianSettleSeconds: 20, settledSample: 2 })
  })

  it("has no settle time when no row carries a confirmation", () => {
    expect(outcomes([tx({ status: "completed" })]).medianSettleSeconds).toBeNull()
  })
})

describe("fmtDuration", () => {
  it("reads at a glance", () => {
    expect(fmtDuration(12)).toBe("12s")
    expect(fmtDuration(240)).toBe("4m")
    expect(fmtDuration(4800)).toBe("1h 20m")
    expect(fmtDuration(3 * 86400)).toBe("3d")
  })
})

describe("rhythm", () => {
  it("places rows by local weekday (Monday first) and three-hour block", () => {
    const g = rhythm([{ createdAt: at(0, 10) }, { createdAt: at(6, 23) }])
    expect(g[6][3]).toBe(1) // Sunday, 09:00–12:00
    expect(g[0][7]).toBe(1) // Monday, 21:00–24:00
  })
})

describe("bankSummary", () => {
  it("counts buys and sells by outcome", () => {
    const o = (direction: string, state: string) => ({ id: state + direction, direction, state }) as unknown as FiatOrder
    const s = bankSummary([o("onramp", "completed"), o("onramp", "expired"), o("offramp", "completed")])
    expect(s.buys).toEqual({ total: 2, completed: 1, pending: 0, failed: 1 })
    expect(s.sells).toEqual({ total: 1, completed: 1, pending: 0, failed: 0 })
  })
})

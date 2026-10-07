import { describe, expect, it } from "vitest"

import {
  amountText,
  counterparty,
  dayLabel,
  directionOf,
  explorerUrl,
  filterBase,
  filterKind,
  glyphOf,
  netByDay,
  stepsFor,
  tradedSummary,
  transactionsCsv,
  typeLabel,
} from "@/lib/transactions-view"
import type { UnifiedTransaction } from "@/types/transactions"

const tx = (over: Partial<UnifiedTransaction>): UnifiedTransaction => ({
  id: "tx-000000abcdef",
  type: "transfer",
  amount: 1,
  token: "USDT",
  status: "completed",
  createdAt: "2026-10-07T10:00:00",
  ...over,
})

const NOW = new Date(2026, 9, 7, 15, 0, 0) // 7 Oct 2026, local

describe("direction, glyph and label", () => {
  it("keeps the previous page's money directions", () => {
    expect(directionOf(tx({ type: "deposit" }))).toBe("in")
    expect(directionOf(tx({ type: "withdrawal" }))).toBe("out")
    expect(directionOf(tx({ type: "transfer", subType: "send", direction: "outgoing" }))).toBe("out")
    expect(directionOf(tx({ type: "transfer", subType: "receive" }))).toBe("in")
    expect(directionOf(tx({ type: "transfer", subType: "internal", direction: "internal" }))).toBe("neutral")
    expect(directionOf(tx({ type: "swap" }))).toBe("neutral")
  })

  it("draws swaps and internal moves with the swap glyph, trades with the trade glyph", () => {
    expect(glyphOf(tx({ type: "swap" }))).toBe("swap")
    expect(glyphOf(tx({ type: "transfer", subType: "internal" }))).toBe("swap")
    expect(glyphOf(tx({ type: "spot_trade" }))).toBe("trade")
    expect(glyphOf(tx({ type: "deposit" }))).toBe("in")
    expect(glyphOf(tx({ type: "transfer", subType: "send" }))).toBe("out")
  })

  it("names rows as before", () => {
    expect(typeLabel(tx({ type: "transfer", subType: "send" }))).toBe("Sent")
    expect(typeLabel(tx({ type: "transfer", subType: "internal" }))).toBe("Internal transfer")
    expect(typeLabel(tx({ type: "spot_trade", pair: "BTC/USDT" }))).toBe("Trade BTC/USDT")
  })

  it("signs the amount by direction", () => {
    expect(amountText(tx({ type: "deposit", amount: 12.5 }))).toBe("+12.50 USDT")
    expect(amountText(tx({ type: "transfer", subType: "send", amount: 0.1, token: "ETH" }))).toBe("−0.10 ETH")
    expect(amountText(tx({ type: "swap", amount: 2 }))).toBe("2.00 USDT")
  })
})

describe("counterparty", () => {
  it("shows the far side of an on-chain move, truncated", () => {
    expect(counterparty(tx({ type: "deposit", fromAddress: "0x1234567890abcdef" }))).toBe("from 0x1234…cdef")
    expect(counterparty(tx({ type: "transfer", subType: "send", toAddress: "TLEvwMieGYSv8pBP" }))).toBe("to TLEvwM…8pBP")
  })
  it("never invents an amount for a swap's received leg", () => {
    expect(counterparty(tx({ type: "swap", toToken: "SOL" }))).toBe("→ SOL")
  })
  it("marks internal moves", () => {
    expect(counterparty(tx({ type: "transfer", subType: "internal", direction: "internal" }))).toBe("internal")
  })
})

describe("explorer", () => {
  it("links each chain to its explorer, as before", () => {
    expect(explorerUrl("ethereum", "0xabc")).toBe("https://etherscan.io/tx/0xabc")
    expect(explorerUrl("tron", "h")).toBe("https://tronscan.org/#/transaction/h")
    expect(explorerUrl(undefined, "h")).toBe("https://solscan.io/tx/h")
  })
})

describe("day labels", () => {
  it("says Today / Yesterday, then the weekday and date", () => {
    expect(dayLabel("2026-10-07T01:00:00", NOW)).toBe("Today")
    expect(dayLabel("2026-10-06T23:00:00", NOW)).toBe("Yesterday")
    expect(dayLabel("2026-10-05T12:00:00", NOW)).toBe("Monday, Oct 5")
    expect(dayLabel("2025-10-05T12:00:00", NOW)).toContain("2025")
  })
})

describe("net bars", () => {
  it("adds money in, subtracts money out, oldest day first", () => {
    const bars = netByDay(
      [
        tx({ type: "deposit", valueUsd: 100, createdAt: "2026-10-07T09:00:00" }),
        tx({ type: "transfer", subType: "send", valueUsd: 30, createdAt: "2026-10-07T11:00:00" }),
        tx({ type: "transfer", subType: "send", valueUsd: 40, createdAt: "2026-10-05T11:00:00" }),
      ],
      NOW,
    )
    expect(bars).toHaveLength(14)
    expect(bars[13]).toBe(70)
    expect(bars[11]).toBe(-40)
  })
  it("ignores stopped rows, unvalued rows, swaps and anything older than 14 days", () => {
    const bars = netByDay(
      [
        tx({ type: "deposit", valueUsd: 100, status: "failed" }),
        tx({ type: "deposit", valueUsd: 100, status: "cancelled" }),
        tx({ type: "deposit" }),
        tx({ type: "swap", valueUsd: 50 }),
        tx({ type: "deposit", valueUsd: 10, createdAt: "2026-09-20T10:00:00" }),
      ],
      NOW,
    )
    expect(bars.every((v) => v === 0)).toBe(true)
  })
})

describe("timeline", () => {
  it("follows the previous tracker for every status", () => {
    expect(stepsFor(tx({ status: "pending" })).map((s) => s.state)).toEqual(["current", "todo", "todo"])
    expect(stepsFor(tx({ status: "processing" })).map((s) => s.state)).toEqual(["done", "current", "todo"])
    expect(stepsFor(tx({ status: "completed" })).map((s) => s.state)).toEqual(["done", "done", "done"])
    expect(stepsFor(tx({ status: "failed" })).map((s) => [s.label, s.state])).toEqual([["Submitted", "done"], ["Failed", "failed"]])
    expect(stepsFor(tx({ status: "cancelled" }))[1].label).toBe("Cancelled")
    expect(stepsFor(tx({ status: "expired" }))[1].label).toBe("Expired")
  })
})

describe("traded", () => {
  it("sums swaps and trades that went through", () => {
    const t = tradedSummary([
      tx({ type: "swap", valueUsd: 10 }),
      tx({ type: "spot_trade", valueUsd: 5 }),
      tx({ type: "swap", valueUsd: 99, status: "failed" }),
      tx({ type: "deposit", valueUsd: 1000 }),
    ])
    expect(t).toEqual({ usd: 15, trades: 1, swaps: 1 })
  })
  it("is unknown while a leg has no valuation", () => {
    expect(tradedSummary([tx({ type: "swap", valueUsd: 10 }), tx({ type: "swap" })]).usd).toBeNull()
  })
})

describe("csv", () => {
  it("writes a header and one escaped line per row", () => {
    const csv = transactionsCsv([tx({ type: "deposit", token: "USDT", amount: 5, valueUsd: 5, fromAddress: "a,b" })])
    const [head, line] = csv.split("\n")
    expect(head.startsWith("Reference,Date,Type,Status")).toBe(true)
    expect(line).toContain('"a,b"')
    expect(line.endsWith("5.00")).toBe(true)
  })
  it("defuses formula-looking cells", () => {
    expect(transactionsCsv([tx({ token: "=HYPERLINK(1)" })])).toContain("'=HYPERLINK(1)")
  })
})

describe("history filters", () => {
  const rows = [
    tx({ id: "1", type: "deposit", status: "processing", token: "USDT", createdAt: "2026-10-07T09:00:00" }),
    tx({ id: "2", type: "transfer", subType: "send", status: "cancelled", token: "ETH", chain: "ethereum", createdAt: "2026-10-03T09:00:00" }),
    tx({ id: "3", type: "spot_trade", status: "completed", token: "BTC", createdAt: "2026-09-20T09:00:00" }),
    tx({ id: "4", type: "swap", status: "expired", token: "SOL", toToken: "USDC", createdAt: "2026-08-01T09:00:00" }),
  ]
  const ids = (r: UnifiedTransaction[]) => r.map((t) => t.id)
  it("folds all six statuses into the preview's three", () => {
    expect(ids(filterBase(rows, { status: "pending", range: "all", query: "" }, NOW))).toEqual(["1"])
    expect(ids(filterBase(rows, { status: "failed", range: "all", query: "" }, NOW))).toEqual(["2", "4"])
    expect(ids(filterBase(rows, { status: "completed", range: "all", query: "" }, NOW))).toEqual(["3"])
  })
  it("cuts by calendar days", () => {
    expect(ids(filterBase(rows, { status: "any", range: "7d", query: "" }, NOW))).toEqual(["1", "2"])
    expect(ids(filterBase(rows, { status: "any", range: "30d", query: "" }, NOW))).toEqual(["1", "2", "3"])
  })
  it("searches coin, both swap legs and network", () => {
    expect(ids(filterBase(rows, { status: "any", range: "all", query: "usdc" }, NOW))).toEqual(["4"])
    expect(ids(filterBase(rows, { status: "any", range: "all", query: "ethereum" }, NOW))).toEqual(["2"])
  })
  it("puts spot trades under Trades and keeps the other types as before", () => {
    expect(ids(filterKind(rows, "trade"))).toEqual(["3"])
    expect(ids(filterKind(rows, "transfer"))).toEqual(["2"])
    expect(filterKind(rows, "all")).toHaveLength(4)
  })
})

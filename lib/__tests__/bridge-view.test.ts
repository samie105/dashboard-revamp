import { describe, expect, it } from "vitest"

import type { CryptoTransactionRecord } from "@/lib/crypto-backend"
import { agoLabel, bridgeRows, stageOf, tookLabel } from "@/lib/bridge-view"

function rec(id: string, action: string, status: string, extra: Partial<CryptoTransactionRecord> = {}): CryptoTransactionRecord {
  return { id, status, summary: { action, amount: "100" }, networkId: "arbitrum-one", txHash: `0x${id}`, createdAt: "2026-10-07T10:00:00Z", ...extra }
}

describe("bridgeRows", () => {
  it("lists deposits only, split into in flight and done", () => {
    const { inFlight, done, awaitingApproval } = bridgeRows([
      rec("a", "bridge-deposit", "submitted"),
      rec("b", "bridge-deposit", "confirmed"),
      rec("c", "bridge-deposit", "failed"),
      rec("d", "bridge-approve", "confirmed"),
      rec("e", "transfer", "submitted"),
    ])
    expect(inFlight.map((r) => r.id)).toEqual(["a"])
    expect(done.map((r) => r.id)).toEqual(["b", "c"])
    expect(awaitingApproval).toBe(false)
  })

  it("reads amount, link and times off the record", () => {
    const [row] = bridgeRows([rec("a", "bridge-deposit", "confirmed", { submittedAt: "2026-10-07T10:01:00Z", confirmedAt: "2026-10-07T10:03:30Z" })]).done
    expect(row).toMatchObject({ amount: "100", networkId: "arbitrum-one", txHash: "0xa", at: "2026-10-07T10:01:00Z", endedAt: "2026-10-07T10:03:30Z" })
  })

  it("flags an approval still confirming only when no deposit is moving", () => {
    expect(bridgeRows([rec("x", "bridge-approve", "submitted")]).awaitingApproval).toBe(true)
    expect(bridgeRows([rec("x", "bridge-approve", "submitted"), rec("y", "bridge-deposit", "pending")]).awaitingApproval).toBe(false)
    expect(bridgeRows([rec("x", "bridge-approve", "confirmed")]).awaitingApproval).toBe(false)
  })

  it("keeps a missing amount as unknown, not zero", () => {
    const r = { id: "a", status: "submitted", summary: { action: "bridge-deposit" } } as CryptoTransactionRecord
    expect(bridgeRows([r]).inFlight[0].amount).toBeNull()
  })
})

describe("stages", () => {
  it("places a deposit by its status, never past minting", () => {
    expect(stageOf("submitted")).toBe(1)
    expect(stageOf("pending")).toBe(1)
    expect(stageOf("confirmed")).toBe(2)
    expect(stageOf("reverted")).toBe(-1)
  })
})

describe("times", () => {
  it("says how long a bridge took, or nothing", () => {
    expect(tookLabel({ at: "2026-10-07T10:00:00Z", endedAt: "2026-10-07T10:02:15Z" })).toBe("2m 15s")
    expect(tookLabel({ at: "2026-10-07T10:00:00Z", endedAt: "2026-10-07T10:00:40Z" })).toBe("40s")
    expect(tookLabel({ at: "2026-10-07T10:00:00Z", endedAt: null })).toBeNull()
    expect(tookLabel({ at: "2026-10-07T10:05:00Z", endedAt: "2026-10-07T10:00:00Z" })).toBeNull()
  })
  it("labels relative time", () => {
    const now = Date.parse("2026-10-07T12:00:00Z")
    expect(agoLabel(null, now)).toBe("")
    expect(agoLabel("2026-10-07T11:59:50Z", now)).toBe("Just now")
    expect(agoLabel("2026-10-07T11:30:00Z", now)).toBe("30m ago")
    expect(agoLabel("2026-10-06T11:00:00Z", now)).toBe("Yesterday")
    expect(agoLabel("2026-10-07T11:30:00Z", 0)).toBe("")
  })
})

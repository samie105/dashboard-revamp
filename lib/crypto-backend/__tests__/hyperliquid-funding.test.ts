import { describe, expect, it } from "vitest"
import {
  buildHyperliquidTransferRequest,
  exceedsFundingBalance,
  parseFundingAmount,
} from "@/lib/crypto-backend/hyperliquid-funding"

describe("Hyperliquid funding transfers", () => {
  it("maps Spot to Perps to the venue's toPerp flag", () => {
    expect(buildHyperliquidTransferRequest("toPerps", "12.5", "attempt-1")).toEqual({
      type: "usdClassTransfer",
      amount: 12.5,
      toPerp: true,
      idempotencyKey: "attempt-1",
    })
  })

  it("maps Perps to Spot to the opposite direction", () => {
    expect(buildHyperliquidTransferRequest("toSpot", 3, "attempt-2").toPerp).toBe(false)
  })

  it("rejects invalid amounts and missing attempt keys", () => {
    expect(parseFundingAmount("  ")).toBeNull()
    expect(parseFundingAmount("-1")).toBeNull()
    expect(() => buildHyperliquidTransferRequest("toPerps", "0", "key")).toThrow()
    expect(() => buildHyperliquidTransferRequest("toPerps", 1, " ")).toThrow()
  })

  it("blocks only amounts above a known available balance", () => {
    expect(exceedsFundingBalance(10, 9.99)).toBe(true)
    expect(exceedsFundingBalance(10, 10)).toBe(false)
    expect(exceedsFundingBalance(null, 10)).toBe(false)
    expect(exceedsFundingBalance(10, null)).toBe(false)
  })
})

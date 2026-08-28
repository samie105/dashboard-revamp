import { describe, expect, it } from "vitest"
import { FUNDING_STAGES, fundingStageIndex } from "@/lib/crypto-backend/funding-stages"

describe("FUNDING_STAGES", () => {
  it("tells the deposit's three-step story in the user's words", () => {
    expect(FUNDING_STAGES.map((stage) => stage.label)).toEqual([
      "USDC sent from your wallet",
      "Bridge transfer confirmed",
      "Trading account credited",
    ])
  })
})

describe("fundingStageIndex", () => {
  it("holds at stage 0 while the wallet's own transactions are still in flight", () => {
    expect(fundingStageIndex({ intentStatuses: ["created"], accountCredited: false })).toBe(0)
    expect(fundingStageIndex({ intentStatuses: ["created", "created"], accountCredited: false })).toBe(0)
    expect(fundingStageIndex({ intentStatuses: ["submitted", "submitted"], accountCredited: false })).toBe(0)
    expect(fundingStageIndex({ intentStatuses: ["signed", "pending"], accountCredited: false })).toBe(0)
  })

  it("needs EVERY intent confirmed before the money has left the wallet", () => {
    // An approve that landed and a bridge call that hasn't is not "sent".
    expect(fundingStageIndex({ intentStatuses: ["confirmed", "submitted"], accountCredited: false })).toBe(0)
  })

  it("moves to the bridge once every intent confirmed and nothing is credited yet", () => {
    expect(fundingStageIndex({ intentStatuses: ["confirmed"], accountCredited: false })).toBe(1)
    expect(fundingStageIndex({ intentStatuses: ["confirmed", "confirmed"], accountCredited: false })).toBe(1)
  })

  it("completes the checklist only when the trading account is credited", () => {
    expect(fundingStageIndex({ intentStatuses: ["confirmed", "confirmed"], accountCredited: true })).toBe(
      FUNDING_STAGES.length,
    )
    // A resumed deposit whose intent statuses haven't loaded yet still reads
    // the credit honestly — the money is either there or it isn't.
    expect(fundingStageIndex({ intentStatuses: [], accountCredited: true })).toBe(FUNDING_STAGES.length)
  })

  it("reports the stage a failure happened in rather than resetting", () => {
    expect(fundingStageIndex({ intentStatuses: ["failed"], accountCredited: false })).toBe(0)
    // Partial multi-intent failure: one landed, one died — the flow stopped in
    // stage 0, which is the stage the failure screen must name.
    expect(fundingStageIndex({ intentStatuses: ["confirmed", "failed"], accountCredited: false })).toBe(0)
    expect(fundingStageIndex({ intentStatuses: ["confirmed", "expired"], accountCredited: false })).toBe(0)
  })

  it("never lets an unrecognised status claim progress it hasn't made", () => {
    expect(fundingStageIndex({ intentStatuses: ["confirmed", "weird-new-status"], accountCredited: false })).toBe(0)
  })

  it("starts at 0 when there is nothing to report yet", () => {
    expect(fundingStageIndex({ intentStatuses: [], accountCredited: false })).toBe(0)
  })
})

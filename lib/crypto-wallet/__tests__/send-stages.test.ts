import { describe, expect, it } from "vitest"
import { SEND_STAGES, sendStageIndex } from "@/lib/crypto-wallet/send-stages"

describe("sendStageIndex", () => {
  it("orders backend statuses onto the visual stages", () => {
    expect(sendStageIndex("created")).toBe(0)      // Signing locally
    expect(sendStageIndex("submitted")).toBe(1)    // Submitted to the network
    expect(sendStageIndex("pending")).toBe(1)
    expect(sendStageIndex("confirmed")).toBe(SEND_STAGES.length) // all done
  })
  it("treats unknown statuses as still-submitting rather than crashing", () => {
    expect(sendStageIndex("weird-new-status")).toBe(1)
  })
})

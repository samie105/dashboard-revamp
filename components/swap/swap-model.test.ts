import { describe, expect, it } from "vitest"
import { routerForPair, unavailablePairMessage } from "./swap-model"

describe("swap route capability", () => {
  it("recognises the existing LI.FI lane", () => {
    expect(routerForPair("solana", "ethereum")).toBe("lifi")
  })

  it("does not confuse chain visibility with an executable route", () => {
    expect(routerForPair("tron", "solana")).toBe("lifi")
  })
})

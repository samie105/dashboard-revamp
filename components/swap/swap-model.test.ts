import { describe, expect, it } from "vitest"
import { routerForPair, unavailablePairMessage } from "./swap-model"

describe("swap route capability", () => {
  it("keeps TON/Solana out of the LI.FI quote path", () => {
    expect(routerForPair("ton", "solana")).toBeNull()
    expect(unavailablePairMessage("ton", "solana")).toMatch(/TON swaps are not supported/i)
  })

  it("recognises the existing LI.FI lane", () => {
    expect(routerForPair("solana", "ethereum")).toBe("lifi")
  })

  it("does not confuse chain visibility with an executable route", () => {
    expect(routerForPair("ton", "ton")).toBeNull()
    expect(routerForPair("tron", "solana")).toBe("lifi")
    expect(routerForPair("ton", "tron")).toBeNull()
  })
})

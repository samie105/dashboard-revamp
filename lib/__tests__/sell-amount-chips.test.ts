import { describe, expect, it } from "vitest"

import { percentOfBalance, sellableBalance } from "@/lib/sell-amount-chips"

const usdc = (networkId: string, amountBaseUnits: string) => ({ networkId, symbol: "USDC", amountBaseUnits, decimals: 6 })

describe("sellableBalance", () => {
  it("finds the one holding of the symbol on the network, case-insensitively", () => {
    const b = usdc("ethereum-mainnet", "1000000")
    expect(sellableBalance([usdc("solana-mainnet", "5"), b], "ethereum-mainnet", "usdc")).toBe(b)
  })
  it("returns null when there's no match", () => {
    expect(sellableBalance([usdc("solana-mainnet", "5")], "ethereum-mainnet", "USDC")).toBeNull()
  })
  it("returns null when the match is ambiguous", () => {
    expect(sellableBalance([usdc("ethereum-mainnet", "1"), usdc("ethereum-mainnet", "2")], "ethereum-mainnet", "USDC")).toBeNull()
  })
})

describe("percentOfBalance", () => {
  it("gives the whole balance for 100%", () => {
    expect(percentOfBalance("62450000", 6, 100, 6)).toBe("62.45")
  })
  it("rounds down, never up", () => {
    // 25% of 0.000003 = 0.00000075 → 0 at 6 digits
    expect(percentOfBalance("3", 6, 25, 6)).toBe("")
    // 50% of 1.000001 = 0.5000005 → 0.5 at 6 digits
    expect(percentOfBalance("1000001", 6, 50, 6)).toBe("0.5")
    // truncated to the field's precision
    expect(percentOfBalance("123456789", 8, 100, 6)).toBe("1.234567")
  })
  it("handles zero decimals and a zero balance", () => {
    expect(percentOfBalance("10", 0, 50, 6)).toBe("5")
    expect(percentOfBalance("0", 6, 100, 6)).toBe("")
  })
  it("rejects malformed input", () => {
    expect(percentOfBalance("1.5", 6, 50, 6)).toBe("")
    expect(percentOfBalance("100", 6, 0, 6)).toBe("")
    expect(percentOfBalance("100", 6, 101, 6)).toBe("")
  })
})

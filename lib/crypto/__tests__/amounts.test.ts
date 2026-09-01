import { describe, expect, it } from "vitest"
import { formatBaseUnits, isValidDisplayAmount } from "@/lib/crypto/amounts"

describe("formatBaseUnits", () => {
  it("formats the doc's example without precision loss", () => {
    // 60217243958644222840 > Number.MAX_SAFE_INTEGER — the whole point.
    expect(formatBaseUnits("60217243958644222840", 18)).toBe("60.217243")
  })
  it("trims trailing zeros and bare points", () => {
    expect(formatBaseUnits("1000000000000000000", 18)).toBe("1")
    expect(formatBaseUnits("1500000000000000000", 18)).toBe("1.5")
  })
  it("handles zero and small dust", () => {
    expect(formatBaseUnits("0", 18)).toBe("0")
    expect(formatBaseUnits("1", 18)).toBe("0") // below 6-dp display resolution
    expect(formatBaseUnits("1", 18, 18)).toBe("0.000000000000000001")
  })
  it("respects non-18 decimals (USDC-style)", () => {
    expect(formatBaseUnits("1234567", 6)).toBe("1.234567")
  })
})

describe("isValidDisplayAmount", () => {
  it("accepts positive decimal strings", () => {
    expect(isValidDisplayAmount("0.0001")).toBe(true)
    expect(isValidDisplayAmount("1000")).toBe(true)
    expect(isValidDisplayAmount("1.5")).toBe(true)
  })
  it("rejects zero, negatives, exponents, and junk", () => {
    for (const bad of ["0", "0.000", "-1", "1e18", ".5", "1.", "abc", ""]) {
      expect(isValidDisplayAmount(bad)).toBe(false)
    }
  })
})

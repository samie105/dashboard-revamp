import { describe, expect, it } from "vitest"

import { cleanDecimal } from "@/lib/decimal-input"

describe("cleanDecimal", () => {
  it("folds leading zeros", () => {
    expect(cleanDecimal("000")).toBe("0")
    expect(cleanDecimal("0005")).toBe("5")
    expect(cleanDecimal("00.5")).toBe("0.5")
    expect(cleanDecimal("0100")).toBe("100")
  })
  it("keeps decimals and the zero before the point", () => {
    expect(cleanDecimal("0.05")).toBe("0.05")
    expect(cleanDecimal("0.")).toBe("0.")
    expect(cleanDecimal("12.50")).toBe("12.50")
    expect(cleanDecimal(".5")).toBe("0.5")
  })
  it("drops anything that isn't a digit or the first point", () => {
    expect(cleanDecimal("1,2a3.4.5")).toBe("123.45")
    expect(cleanDecimal("")).toBe("")
  })
})

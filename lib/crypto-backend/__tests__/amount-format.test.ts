import { describe, expect, it } from "vitest"
import { groupDigits, readableAmount, stripGrouping } from "../amount-format"

describe("groupDigits", () => {
  it("groups thousands and keeps what the user is typing", () => {
    expect(groupDigits("100000")).toBe("100,000")
    expect(groupDigits("1234567.89")).toBe("1,234,567.89")
    expect(groupDigits("12.")).toBe("12.")
    expect(groupDigits("0.5")).toBe("0.5")
    expect(groupDigits("999")).toBe("999")
    expect(groupDigits("")).toBe("")
  })

  it("round-trips with stripGrouping", () => {
    for (const raw of ["1", "1000", "1234567.891", "12.", "0.000001"]) expect(stripGrouping(groupDigits(raw))).toBe(raw)
  })
})

describe("readableAmount", () => {
  it("drops trailing zeros and groups the rest", () => {
    expect(readableAmount("62.450000")).toBe("62.45")
    expect(readableAmount("100")).toBe("100")
    expect(readableAmount("100000")).toBe("100,000")
    expect(readableAmount("1602.564102")).toBe("1,602.564102")
    expect(readableAmount(137916.93)).toBe("137,916.93")
    expect(readableAmount("5.000000")).toBe("5")
  })

  it("limits decimals without rounding up into a wrong figure", () => {
    expect(readableAmount("1602.564102", 2)).toBe("1,602.56")
    expect(readableAmount("0.073999", 2)).toBe("0.07")
  })

  it("returns anything that is not a plain number untouched", () => {
    expect(readableAmount("—")).toBe("—")
    expect(readableAmount("abc")).toBe("abc")
  })
})

import { describe, expect, it } from "vitest"
import { addDecimalStrings, hasServiceFee, orderSentFigure, serviceFeeRows, totalSent } from "../fiat-fee"

const quote = { sourceAmount: "100", sourceCurrency: "USDC" }

describe("addDecimalStrings", () => {
  it("adds without floating-point error", () => {
    expect(addDecimalStrings("0.1", "0.2")).toBe("0.3")
    expect(addDecimalStrings("100", "1.2")).toBe("101.2")
    expect(addDecimalStrings("5", "0.072464")).toBe("5.072464")
    expect(addDecimalStrings("999999999999.999999", "0.000001")).toBe("1000000000000")
    expect(addDecimalStrings("9.99", "0.01")).toBe("10")
    expect(addDecimalStrings("0.5", "0.5")).toBe("1")
    expect(addDecimalStrings("0", "0")).toBe("0")
    expect(addDecimalStrings("99", "1")).toBe("100")
    expect(addDecimalStrings("0.07", "0.003")).toBe("0.073")
  })
})

describe("service fee display", () => {
  it("shows nothing when there is no fee", () => {
    for (const worldstreetFee of [undefined, "", "0", "0.0"]) {
      expect(hasServiceFee({ worldstreetFee })).toBe(false)
      expect(serviceFeeRows({ ...quote, worldstreetFee })).toEqual([])
    }
    expect(totalSent(quote)).toBe("100")
  })

  it("names the token on the fee and shows the true total", () => {
    expect(serviceFeeRows({ ...quote, worldstreetFee: "1", totalDebit: "101" })).toEqual([
      { label: "Service fee", value: "1 USDC" },
      { label: "Total you send", value: "101 USDC" },
    ])
  })

  it("computes the total itself when the backend did not send one", () => {
    expect(totalSent({ ...quote, worldstreetFee: "0.072464" })).toBe("100.072464")
  })

  it("makes the order screen show what leaves the wallet, with the fee called out", () => {
    expect(orderSentFigure({ symbol: "USDC", amount: "100", worldstreetFee: "1", totalDebit: "101" })).toBe("101 USDC (includes a 1 USDC service fee)")
    expect(orderSentFigure({ symbol: "USDC", amount: "100", worldstreetFee: "1" })).toBe("101 USDC (includes a 1 USDC service fee)")
  })

  it("leaves the order figure unchanged when there is no fee or no amount", () => {
    expect(orderSentFigure({ symbol: "USDT", amount: "50" })).toBe("50 USDT")
    expect(orderSentFigure({ symbol: "USDT", amount: "50", worldstreetFee: "0" })).toBe("50 USDT")
    expect(orderSentFigure({ symbol: "USDT" })).toBeUndefined()
  })
})

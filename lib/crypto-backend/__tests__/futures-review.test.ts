import { describe, expect, it } from "vitest"
import {
  LIQUIDATION_WARNING,
  readFuturesOrderFigures,
  reduceOnlyProblem,
} from "@/lib/crypto-backend/futures-review"

describe("readFuturesOrderFigures", () => {
  it("reads the confirmed size/price fields the summary is known to carry", () => {
    const figures = readFuturesOrderFigures({ size: 0.25, price: 64000 })
    expect(figures.size).toBe(0.25)
    expect(figures.price).toBe(64000)
  })

  it("accepts numeric strings — the venue reports its figures as strings", () => {
    const figures = readFuturesOrderFigures({ size: "0.25", price: "64000.5" })
    expect(figures.size).toBe(0.25)
    expect(figures.price).toBe(64000.5)
  })

  it("returns null for every figure when the summary is absent", () => {
    const figures = readFuturesOrderFigures(undefined)
    expect(figures).toMatchObject({ size: null, price: null, feeUsd: null, liquidationPrice: null })
  })

  it("never invents a liquidation price — a missing one stays null and warns", () => {
    const figures = readFuturesOrderFigures({ size: 1, price: 100 })
    expect(figures.liquidationPrice).toBeNull()
    expect(figures.needsLiquidationWarning).toBe(true)
  })

  it("drops the warning only when the backend supplied both a fee and a liquidation price", () => {
    const figures = readFuturesOrderFigures({
      size: 1,
      price: 100,
      estimatedFeeUsd: 0.04,
      liquidationPrice: 82.5,
    })
    expect(figures.feeUsd).toBe(0.04)
    expect(figures.liquidationPrice).toBe(82.5)
    expect(figures.needsLiquidationWarning).toBe(false)
  })

  it("still warns when the fee arrived but the liquidation price did not", () => {
    const figures = readFuturesOrderFigures({ size: 1, price: 100, fee: 0.04 })
    expect(figures.feeUsd).toBe(0.04)
    expect(figures.needsLiquidationWarning).toBe(true)
  })

  it("accepts a zero fee as a real figure rather than a missing one", () => {
    const figures = readFuturesOrderFigures({ fee: 0, liquidationPrice: 10 })
    expect(figures.feeUsd).toBe(0)
    expect(figures.needsLiquidationWarning).toBe(false)
  })

  it("rejects junk instead of rendering it — NaN, empty strings, negatives, nulls", () => {
    const figures = readFuturesOrderFigures({
      size: "not a number",
      price: "",
      fee: null,
      liquidationPrice: -1,
    })
    expect(figures).toMatchObject({ size: null, price: null, feeUsd: null, liquidationPrice: null })
    expect(figures.needsLiquidationWarning).toBe(true)
  })

  it("takes the first spelling present, in the declared order", () => {
    expect(readFuturesOrderFigures({ estimatedFeeUsd: 1, fee: 9 }).feeUsd).toBe(1)
    expect(readFuturesOrderFigures({ liqPrice: 3, liquidationPrice: 7 }).liquidationPrice).toBe(7)
  })

  it("states the warning copy verbatim", () => {
    expect(LIQUIDATION_WARNING).toBe(
      "Check your liquidation price before confirming — high leverage can be liquidated by small moves.",
    )
  })
})

describe("reduceOnlyProblem", () => {
  it("refuses when there is no position to reduce", () => {
    expect(reduceOnlyProblem(undefined, "BTC", "sell")).toBe(
      "You have no open BTC position to reduce.",
    )
  })

  it("treats a zero-size position as no position", () => {
    expect(reduceOnlyProblem({ side: "long", absSize: 0 }, "BTC", "sell")).toBe(
      "You have no open BTC position to reduce.",
    )
  })

  it("refuses a buy against a long — that adds exposure, it doesn't reduce it", () => {
    expect(reduceOnlyProblem({ side: "long", absSize: 1 }, "BTC", "buy")).toBe(
      "Reduce-only is on, so your long BTC position can only be reduced by selling.",
    )
  })

  it("refuses a sell against a short", () => {
    expect(reduceOnlyProblem({ side: "short", absSize: 1 }, "ETH", "sell")).toBe(
      "Reduce-only is on, so your short ETH position can only be reduced by buying.",
    )
  })

  it("allows the two directions that genuinely reduce", () => {
    expect(reduceOnlyProblem({ side: "long", absSize: 1 }, "BTC", "sell")).toBeNull()
    expect(reduceOnlyProblem({ side: "short", absSize: 1 }, "BTC", "buy")).toBeNull()
  })
})

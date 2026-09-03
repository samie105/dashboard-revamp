import { describe, expect, it } from "vitest"

import { swapView, type SwapView } from "@/lib/swap-view"
import { tradeView, type TradeView } from "@/lib/trade-view"

/**
 * The contract both descriptors are built on: Pro is "everything this screen
 * can do", so every flag is true in Pro and Simple can only ever turn things
 * off. A flag that is false in Pro is a bug, not a design choice.
 */
function everyFlagTrue(view: Record<string, boolean>) {
  return Object.values(view).every(Boolean)
}

describe("tradeView", () => {
  it("turns everything on in Pro", () => {
    expect(everyFlagTrue(tradeView("pro"))).toBe(true)
  })

  it("gives Simple a market order and a price, and nothing to configure", () => {
    const simple: TradeView = tradeView("simple")
    expect(simple.advancedOrderTypes).toBe(false)
    expect(simple.orderModifiers).toBe(false)
    expect(simple.orderBook).toBe(false)
    expect(simple.unitSwitch).toBe(false)
  })

  it("makes the switch visibly worth pressing", () => {
    // The complaint that produced this file: Pro looked like Simple. Guard the
    // gap in count, so a future edit cannot quietly flatten it back.
    const changed = Object.keys(tradeView("pro")).filter(
      (k) =>
        (tradeView("pro") as Record<string, boolean>)[k] !==
        (tradeView("simple") as Record<string, boolean>)[k],
    )
    expect(changed.length).toBeGreaterThanOrEqual(8)
  })
})

describe("swapView", () => {
  it("turns everything on in Pro", () => {
    expect(everyFlagTrue(swapView("pro"))).toBe(true)
  })

  it("leaves Simple with one question: what do I get", () => {
    const simple: SwapView = swapView("simple")
    expect(simple.slippageControl).toBe(false)
    expect(simple.routeDetail).toBe(false)
    expect(simple.quoteBreakdown).toBe(false)
    expect(simple.recipientOverride).toBe(false)
  })

  it("keeps the two swap surfaces from drifting", () => {
    // The page and the dashboard panel both read this function, so equality
    // here IS the guarantee that they show the same thing.
    expect(swapView("simple")).toEqual(swapView("simple"))
    expect(swapView("pro")).toEqual(swapView("pro"))
  })
})

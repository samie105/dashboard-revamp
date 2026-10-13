import { describe, expect, it } from "vitest"

import { DEFAULT_TRADE_PREFS, parseTradePrefs } from "@/lib/trade-prefs"

describe("parseTradePrefs", () => {
  it("defaults to spot with no extra review", () => {
    expect(parseTradePrefs(null)).toEqual({ defaultVenue: "spot", confirmSpot: false })
    expect(DEFAULT_TRADE_PREFS).toEqual({ defaultVenue: "spot", confirmSpot: false })
  })
  it("reads saved choices", () => {
    expect(parseTradePrefs(JSON.stringify({ defaultVenue: "futures", confirmSpot: true }))).toEqual({ defaultVenue: "futures", confirmSpot: true })
  })
  it("falls back on junk, field by field", () => {
    expect(parseTradePrefs("not json")).toEqual(DEFAULT_TRADE_PREFS)
    expect(parseTradePrefs(JSON.stringify({ defaultVenue: "margin", confirmSpot: "yes" }))).toEqual(DEFAULT_TRADE_PREFS)
    expect(parseTradePrefs(JSON.stringify({ confirmSpot: true }))).toEqual({ defaultVenue: "spot", confirmSpot: true })
  })
})

import { describe, expect, it } from "vitest"

import {
  UI_MODE_STORAGE_PREFIX,
  parseUiMode,
  resolveUiMode,
  simpleTradeView,
  simpleWalletView,
  uiModeStorageKey,
} from "@/lib/ui-mode"

describe("uiModeStorageKey", () => {
  it("keys the preference per user, under the ws: convention", () => {
    expect(uiModeStorageKey("user_123")).toBe(`${UI_MODE_STORAGE_PREFIX}user_123`)
  })

  it("falls back to a named anonymous bucket rather than a bare prefix", () => {
    expect(uiModeStorageKey(undefined)).toBe(`${UI_MODE_STORAGE_PREFIX}anonymous`)
  })
})

describe("parseUiMode", () => {
  it("accepts the two real values", () => {
    expect(parseUiMode("simple")).toBe("simple")
    expect(parseUiMode("pro")).toBe("pro")
  })

  it("treats anything else as no stored preference", () => {
    expect(parseUiMode(null)).toBeNull()
    expect(parseUiMode("")).toBeNull()
    expect(parseUiMode("advanced")).toBeNull()
    expect(parseUiMode("SIMPLE")).toBeNull()
  })
})

describe("resolveUiMode", () => {
  // The retention bet: a newcomer's first crypto screen is the calm one.
  it("defaults to simple when nothing has been stored", () => {
    expect(resolveUiMode({ stored: null })).toBe("simple")
  })

  it("honours a stored choice in both directions", () => {
    expect(resolveUiMode({ stored: "pro" })).toBe("pro")
    expect(resolveUiMode({ stored: "simple" })).toBe("simple")
  })
})

describe("simpleWalletView", () => {
  const pro = simpleWalletView("pro")
  const simple = simpleWalletView("simple")

  it("pro shows everything the page shows today", () => {
    expect(pro).toEqual({
      chainCards: true,
      heroAddress: true,
      heroNetworks: true,
      heroStats: true,
      shareColumn: true,
      networkPerRow: true,
      groupBySymbol: false,
      advancedSecurity: true,
    })
  })

  it("simple hides the chain metaphor, the counters and the raw address", () => {
    expect(simple.chainCards).toBe(false)
    expect(simple.heroAddress).toBe(false)
    expect(simple.heroNetworks).toBe(false)
    expect(simple.heroStats).toBe(false)
  })

  it("simple collapses the balance list to one row per asset", () => {
    expect(simple.groupBySymbol).toBe(true)
    expect(simple.networkPerRow).toBe(false)
    expect(simple.shareColumn).toBe(false)
  })

  it("simple puts the advanced security rows behind a disclosure", () => {
    expect(simple.advancedSecurity).toBe(false)
  })
})

describe("simpleTradeView", () => {
  it("pro leaves the workspace exactly as it is", () => {
    expect(simpleTradeView("pro")).toEqual({ marketStats: true, unitSwitch: true })
  })

  it("simple drops the 24h stat cluster and forces a single amount unit", () => {
    expect(simpleTradeView("simple")).toEqual({ marketStats: false, unitSwitch: false })
  })
})

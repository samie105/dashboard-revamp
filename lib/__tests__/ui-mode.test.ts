import { describe, expect, it } from "vitest"

import {
  UI_MODE_STORAGE_PREFIX,
  parseUiMode,
  resolveUiMode,
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

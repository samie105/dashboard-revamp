import { describe, expect, it } from "vitest"

import { SHOW_FROM, TONE_CLASSES, columnVisibility } from "@/lib/dash-ui"

describe("dash-ui class maps", () => {
  it("never uses gold for a status tone (gold means action)", () => {
    for (const classes of Object.values(TONE_CLASSES)) expect(classes).not.toMatch(/primary/)
  })

  it("maps money meanings to the money tokens", () => {
    expect(TONE_CLASSES.success).toContain("text-credit")
    expect(TONE_CLASSES.danger).toContain("text-debit")
    expect(TONE_CLASSES.warning).toContain("text-warning")
  })

  it("hides a progressive column below its breakpoint and shows it as a table cell above", () => {
    for (const [bp, classes] of Object.entries(SHOW_FROM)) {
      expect(classes).toBe(`hidden ${bp}:table-cell`)
    }
    expect(columnVisibility("lg")).toBe("hidden lg:table-cell")
    expect(columnVisibility(undefined)).toBe("")
  })
})

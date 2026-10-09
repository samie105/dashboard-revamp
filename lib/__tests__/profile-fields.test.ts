import { describe, expect, it } from "vitest"

import { isCountry, isTimezone, normalizeUsername, usernameProblem } from "@/lib/profile-fields"

describe("username", () => {
  it("normalises case, spaces and a leading @", () => {
    expect(normalizeUsername("  @Zen_Trader ")).toBe("zen_trader")
  })
  it("allows empty, and 3–20 lowercase letters, digits or _", () => {
    expect(usernameProblem("")).toBeNull()
    expect(usernameProblem("zen")).toBeNull()
    expect(usernameProblem("@Zen_99")).toBeNull()
    expect(usernameProblem("a".repeat(20))).toBeNull()
  })
  it("rejects too short, too long and other characters", () => {
    expect(usernameProblem("ab")).not.toBeNull()
    expect(usernameProblem("a".repeat(21))).not.toBeNull()
    expect(usernameProblem("zen trader")).not.toBeNull()
    expect(usernameProblem("zen-trader")).not.toBeNull()
  })
})

describe("country and time zone", () => {
  it("accepts the listed values and empty", () => {
    expect(isCountry("Nigeria")).toBe(true)
    expect(isCountry("")).toBe(true)
    expect(isTimezone("Africa/Lagos (GMT+1)")).toBe(true)
    expect(isTimezone("")).toBe(true)
  })
  it("rejects anything else", () => {
    expect(isCountry("Atlantis")).toBe(false)
    expect(isTimezone("Mars/Base")).toBe(false)
  })
})

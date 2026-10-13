import { describe, expect, it } from "vitest"

import { parseFearGreed } from "@/lib/fear-greed"

describe("parseFearGreed", () => {
  it("reads the latest reading", () => {
    // The API's own response shape.
    const body = { name: "Fear and Greed Index", data: [{ value: "71", value_classification: "Greed", timestamp: "1791331200" }], metadata: { error: null } }
    expect(parseFearGreed(body)).toEqual({ value: 71, classification: "Greed" })
  })
  it("adds yesterday and last week when the response lists them", () => {
    const days = [71, 66, 60, 55, 52, 48, 44, 38].map((v, i) => ({ value: String(v), value_classification: i === 7 ? "Fear" : "Greed" }))
    expect(parseFearGreed({ data: days })).toEqual({
      value: 71,
      classification: "Greed",
      yesterday: { value: 66, classification: "Greed" },
      lastWeek: { value: 38, classification: "Fear" },
    })
  })
  it("has no reading for an empty or broken response", () => {
    expect(parseFearGreed({ data: [] })).toBeNull()
    expect(parseFearGreed(null)).toBeNull()
    expect(parseFearGreed({ data: [{ value: "abc" }] })).toBeNull()
    expect(parseFearGreed({ data: [{ value: "140" }] })).toBeNull()
  })
})

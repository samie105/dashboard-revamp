import { describe, expect, it } from "vitest"

import { rangeSlice } from "@/hooks/useAccountHistory"

// 30 days of hourly points, valued by their own index so slices are checkable.
const thirtyDays = Array.from({ length: 30 * 24 + 1 }, (_, i) => i)

describe("rangeSlice", () => {
  it("1D is the last 24 hourly points, ending now", () => {
    const day = rangeSlice(thirtyDays, "today", 100)
    expect(day[0]).toBe(thirtyDays.length - 1 - 24)
    expect(day.at(-1)).toBe(thirtyDays.length - 1)
    expect(day).toHaveLength(25)
  })

  it("1W is the last 7 days, resampled to the requested width", () => {
    const week = rangeSlice(thirtyDays, "week", 40)
    expect(week).toHaveLength(40)
    expect(week[0]).toBe(thirtyDays.length - 1 - 7 * 24)
    expect(week.at(-1)).toBe(thirtyDays.length - 1)
  })

  it("1M is the whole series", () => {
    const month = rangeSlice(thirtyDays, "month", 40)
    expect(month[0]).toBe(0)
    expect(month.at(-1)).toBe(thirtyDays.length - 1)
  })

  it("never invents points when history is shorter than the range", () => {
    expect(rangeSlice([10, 11, 12], "week", 40)).toEqual([10, 11, 12])
  })

  it("returns an undrawable series unchanged", () => {
    expect(rangeSlice([5], "today")).toEqual([5])
    expect(rangeSlice([], "month")).toEqual([])
  })
})

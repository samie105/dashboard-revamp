import { describe, expect, it } from "vitest"

import { countryFlagForCode, countryLabelForCode, countryNameForCode } from "@/lib/crypto-backend/fiat-country"

describe("fiat country display metadata", () => {
  it("renders full names and flags for supported corridors", () => {
    expect(countryNameForCode("NG")).toBe("Nigeria")
    expect(countryFlagForCode("NG")).toBe("🇳🇬")
    expect(countryLabelForCode("NG")).toBe("🇳🇬 Nigeria")
  })

  it("uses a provider-supplied name when one is available", () => {
    expect(countryNameForCode("XX", "Example Republic")).toBe("Example Republic")
  })

  it("fails safely for an unknown code", () => {
    expect(countryFlagForCode("X")).toBe("🌍")
    expect(countryNameForCode("X")).toBe("X")
  })
})

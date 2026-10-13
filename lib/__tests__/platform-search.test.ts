import { describe, expect, it } from "vitest"

import { searchPlatform } from "@/lib/platform-search"

describe("platform search", () => {
  it("returns the same asset in both spot and futures with an explicit location", () => {
    const results = searchPlatform("BTC")

    expect(
      results.some(
        (result) => result.label === "BTC/USDT" && result.location === "Spot"
      )
    ).toBe(true)
    expect(
      results.some(
        (result) =>
          result.label === "BTC/USDT Perp" && result.location === "Futures"
      )
    ).toBe(true)
  })

  it("finds features by their product vocabulary", () => {
    expect(searchPlatform("fund wallet")[0]).toMatchObject({
      label: "Fund wallet",
      location: "Fiat",
    })
    expect(
      searchPlatform("wallet").some((result) => result.location === "Wallet")
    ).toBe(true)
  })

  it("keeps the venue in the destination URL", () => {
    const futures = searchPlatform("SOL futures").find(
      (result) => result.kind === "futures-market"
    )

    expect(futures).toMatchObject({ location: "Futures" })
    expect(futures?.href).toContain("market=futures")
    expect(futures?.href).toContain("pair=SOL-PERP")
  })
})

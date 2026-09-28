import { readFile } from "node:fs/promises"
import { afterEach, describe, expect, it, vi } from "vitest"

import { buySellImplementation, resolveBuyFlow, resolveSellFlow } from "@/lib/fiat-flags"

/** The Buy rollback flag (NEXT_PUBLIC_FIAT_BUY_FLOW). */

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe("resolveBuyFlow", () => {
  it.each([
    [undefined, "onswitch"],
    ["", "onswitch"],
    ["legacy", "legacy"],
    ["anything-else", "onswitch"],
    ["ONSWITCH", "onswitch"],
    ["onswitch", "onswitch"],
  ])("%j → %s", (value, expected) => {
    expect(resolveBuyFlow(value)).toBe(expected)
  })
})

describe("resolveSellFlow", () => {
  it.each([[undefined, "onswitch"], ["", "onswitch"], ["legacy", "legacy"], ["onswitch", "onswitch"], ["ONSWITCH", "onswitch"]] as const)("%j → %s", (value, expected) => {
    expect(resolveSellFlow(value)).toBe(expected)
  })
})

describe("buySellImplementation", () => {
  it("Buy uses the guide flow when the flag is onswitch", () => {
    expect(buySellImplementation("buy", "onswitch")).toBe("onswitch-buy")
  })

  it("the rollback flag restores the legacy Buy", () => {
    expect(buySellImplementation("buy", "legacy")).toBe("legacy")
  })

  it("Sell uses the released OnSwitch offramp unless rolled back", () => {
    expect(buySellImplementation("sell", "legacy", "onswitch")).toBe("onswitch-sell")
    expect(buySellImplementation("sell", "legacy", "legacy")).toBe("legacy")
  })

  it("Sell can be rolled out independently of the Buy flag", () => {
    expect(buySellImplementation("sell", "legacy", "onswitch")).toBe("onswitch-sell")
  })
})

describe("FIAT_BUY_FLOW reads the env var", () => {
  it("defaults to the released OnSwitch flow when unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIAT_BUY_FLOW", "")
    vi.resetModules()
    const flags = await import("@/lib/fiat-flags")
    expect(flags.FIAT_BUY_FLOW).toBe("onswitch")
    expect(flags.buySellImplementation("buy")).toBe("onswitch-buy")
  })

  it("keeps legacy available as an explicit rollback", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIAT_BUY_FLOW", "legacy")
    vi.resetModules()
    const flags = await import("@/lib/fiat-flags")
    expect(flags.FIAT_BUY_FLOW).toBe("legacy")
    expect(flags.buySellImplementation("buy")).toBe("legacy")
  })
})

describe("the legacy Buy/Sell code is kept, and BuySellClient switches on the flag", () => {
  it("buy-sell-client.tsx keeps LegacyBuySellClient and routes through buySellImplementation", async () => {
    const source = await readFile("components/buy-sell/buy-sell-client.tsx", "utf8")
    expect(source).toContain("function LegacyBuySellClient(")
    expect(source).toContain("buySellImplementation(props.mode)")
    expect(source).toContain("<LegacyBuySellClient {...props} />")
    expect(source).toContain("<FiatBuyFlow")
    expect(source).toContain("<FiatSellRouter")
    // The legacy submit path is still there.
    expect(source).toContain("initiateBuy(")
    expect(source).toContain("initiateSell(")
  })
})

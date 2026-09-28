import { readFile } from "node:fs/promises"
import { afterEach, describe, expect, it, vi } from "vitest"

import { buySellImplementation, resolveBuyFlow } from "@/lib/fiat-flags"

/** The Buy rollback flag (NEXT_PUBLIC_FIAT_BUY_FLOW). */

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe("resolveBuyFlow", () => {
  it.each([
    [undefined, "legacy"],
    ["", "legacy"],
    ["legacy", "legacy"],
    ["anything-else", "legacy"],
    ["ONSWITCH", "legacy"],
    ["onswitch", "onswitch"],
  ])("%j → %s", (value, expected) => {
    expect(resolveBuyFlow(value)).toBe(expected)
  })
})

describe("buySellImplementation", () => {
  it("Buy uses the guide flow when the flag is onswitch", () => {
    expect(buySellImplementation("buy", "onswitch")).toBe("onswitch-buy")
  })

  it("the rollback flag restores the legacy Buy", () => {
    expect(buySellImplementation("buy", "legacy")).toBe("legacy")
  })

  it("Sell stays legacy either way until the offramp ships", () => {
    expect(buySellImplementation("sell", "onswitch")).toBe("legacy")
    expect(buySellImplementation("sell", "legacy")).toBe("legacy")
  })
})

describe("FIAT_BUY_FLOW reads the env var", () => {
  it("defaults to legacy when unset (rollout decision pending)", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIAT_BUY_FLOW", "")
    vi.resetModules()
    const flags = await import("@/lib/fiat-flags")
    expect(flags.FIAT_BUY_FLOW).toBe("legacy")
    expect(flags.buySellImplementation("buy")).toBe("legacy")
  })

  it("is onswitch only when set to onswitch", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIAT_BUY_FLOW", "onswitch")
    vi.resetModules()
    const flags = await import("@/lib/fiat-flags")
    expect(flags.FIAT_BUY_FLOW).toBe("onswitch")
    expect(flags.buySellImplementation("buy")).toBe("onswitch-buy")
  })
})

describe("the legacy Buy/Sell code is kept, and BuySellClient switches on the flag", () => {
  it("buy-sell-client.tsx keeps LegacyBuySellClient and routes through buySellImplementation", async () => {
    const source = await readFile("components/buy-sell/buy-sell-client.tsx", "utf8")
    expect(source).toContain("function LegacyBuySellClient(")
    expect(source).toContain("buySellImplementation(props.mode)")
    expect(source).toContain("<LegacyBuySellClient {...props} />")
    expect(source).toContain("<OnswitchBuyFlow")
    // The legacy submit path is still there.
    expect(source).toContain("initiateBuy(")
    expect(source).toContain("initiateSell(")
  })
})

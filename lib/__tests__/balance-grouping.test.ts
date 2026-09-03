import { describe, expect, it } from "vitest"

import { groupBalancesBySymbol, type GroupableBalance } from "@/lib/balance-grouping"

/** A balance row as the wallet page holds it, trimmed to what grouping reads. */
function row(over: Partial<GroupableBalance> & { symbol: string }): GroupableBalance {
  return {
    symbol: over.symbol,
    amountBaseUnits: over.amountBaseUnits ?? "0",
    decimals: over.decimals ?? 6,
    networkId: over.networkId ?? "eth-mainnet",
    networkName: over.networkName ?? "Ethereum",
    logo: over.logo,
    value: over.value === undefined ? null : over.value,
  }
}

describe("groupBalancesBySymbol", () => {
  it("sums the same asset held on several networks into one row", () => {
    const groups = groupBalancesBySymbol([
      row({ symbol: "USDC", amountBaseUnits: "100000000", decimals: 6, networkId: "eth", networkName: "Ethereum", value: 100 }),
      row({ symbol: "USDC", amountBaseUnits: "250000000", decimals: 6, networkId: "arb", networkName: "Arbitrum", value: 250 }),
      row({ symbol: "USDC", amountBaseUnits: "50000000", decimals: 6, networkId: "sol", networkName: "Solana", value: 50 }),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0].symbol).toBe("USDC")
    expect(groups[0].amount).toBe("400")
    expect(groups[0].value).toBe(400)
    expect(groups[0].placeCount).toBe(3)
  })

  it("keeps different assets apart", () => {
    const groups = groupBalancesBySymbol([
      row({ symbol: "USDC", amountBaseUnits: "100000000", decimals: 6, value: 100 }),
      row({ symbol: "ETH", amountBaseUnits: "1000000000000000000", decimals: 18, value: 3000 }),
    ])

    expect(groups.map((g) => g.symbol)).toEqual(["ETH", "USDC"])
  })

  it("sums exactly across members whose decimals differ", () => {
    // The same symbol bridged to a chain with a different precision. Summing
    // the formatted decimal strings as floats is what this guards against.
    const groups = groupBalancesBySymbol([
      row({ symbol: "USDT", amountBaseUnits: "1000001", decimals: 6, networkId: "eth", value: 1 }),
      row({ symbol: "USDT", amountBaseUnits: "2000000000000000002", decimals: 18, networkId: "bsc", value: 2 }),
    ])

    expect(groups).toHaveLength(1)
    // 1.000001 + 2.000000000000000002 — carried at the finer scale, so the
    // 18-decimal tail survives instead of being rounded into the 6-decimal one.
    expect(groups[0].amount).toBe("3.000001")
  })

  it("orders by value, biggest first", () => {
    const groups = groupBalancesBySymbol([
      row({ symbol: "SOL", amountBaseUnits: "1000000000", decimals: 9, value: 150 }),
      row({ symbol: "ETH", amountBaseUnits: "1000000000000000000", decimals: 18, value: 3000 }),
      row({ symbol: "USDC", amountBaseUnits: "100000000", decimals: 6, value: 100 }),
    ])

    expect(groups.map((g) => g.symbol)).toEqual(["ETH", "SOL", "USDC"])
  })

  it("sinks an unpriced asset below every priced one and reports it as unpriced", () => {
    const groups = groupBalancesBySymbol([
      row({ symbol: "WMNA", amountBaseUnits: "5000000", decimals: 6, value: null }),
      row({ symbol: "USDC", amountBaseUnits: "100000", decimals: 6, value: 0.1 }),
    ])

    expect(groups.map((g) => g.symbol)).toEqual(["USDC", "WMNA"])
    expect(groups[1].value).toBeNull()
    expect(groups[1].unpricedCount).toBe(1)
  })

  it("prices a group from the members that priced, and counts the ones that didn't", () => {
    const groups = groupBalancesBySymbol([
      row({ symbol: "USDC", amountBaseUnits: "100000000", decimals: 6, networkId: "eth", value: 100 }),
      row({ symbol: "USDC", amountBaseUnits: "70000000", decimals: 6, networkId: "ton", value: null }),
    ])

    expect(groups[0].value).toBe(100)
    expect(groups[0].unpricedCount).toBe(1)
    // The amount is still the whole holding — only the valuation is partial.
    expect(groups[0].amount).toBe("170")
  })

  it("names the single network it came from, and stays silent about it when there are several", () => {
    const one = groupBalancesBySymbol([row({ symbol: "SOL", networkName: "Solana", value: 10 })])
    expect(one[0].placeCount).toBe(1)
    expect(one[0].networkName).toBe("Solana")

    const many = groupBalancesBySymbol([
      row({ symbol: "USDC", networkId: "eth", networkName: "Ethereum", value: 10 }),
      row({ symbol: "USDC", networkId: "arb", networkName: "Arbitrum", value: 10 }),
    ])
    expect(many[0].placeCount).toBe(2)
    expect(many[0].networkName).toBeNull()
  })

  it("matches symbols case-insensitively but presents the symbol as given", () => {
    const groups = groupBalancesBySymbol([
      row({ symbol: "USDC", amountBaseUnits: "1000000", decimals: 6, networkId: "eth", value: 1 }),
      row({ symbol: "usdc", amountBaseUnits: "1000000", decimals: 6, networkId: "arb", value: 1 }),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0].symbol).toBe("USDC")
    expect(groups[0].amount).toBe("2")
  })

  it("carries the representative network of the biggest member, so a deposit lands somewhere real", () => {
    const groups = groupBalancesBySymbol([
      row({ symbol: "USDC", networkId: "small", value: 5 }),
      row({ symbol: "USDC", networkId: "big", value: 500 }),
    ])

    expect(groups[0].networkId).toBe("big")
  })

  it("keeps the first logo it is given", () => {
    const groups = groupBalancesBySymbol([
      row({ symbol: "USDC", networkId: "eth", value: 5, logo: "https://example.test/usdc.png" }),
      row({ symbol: "USDC", networkId: "arb", value: 5 }),
    ])

    expect(groups[0].logo).toBe("https://example.test/usdc.png")
  })

  it("survives a malformed amount rather than poisoning the group with NaN", () => {
    const groups = groupBalancesBySymbol([
      row({ symbol: "USDC", amountBaseUnits: "not-a-number", decimals: 6, networkId: "eth", value: null }),
      row({ symbol: "USDC", amountBaseUnits: "3000000", decimals: 6, networkId: "arb", value: 3 }),
    ])

    expect(groups[0].amount).toBe("3")
    expect(groups[0].value).toBe(3)
  })

  it("returns nothing for an empty wallet", () => {
    expect(groupBalancesBySymbol([])).toEqual([])
  })
})

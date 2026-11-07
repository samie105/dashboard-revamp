import { describe, expect, it } from "vitest"
import { networkCostRank, networkLabel, preferredRoute } from "../network-label"

describe("networkLabel", () => {
  it("uses plain names for known networks", () => {
    expect(networkLabel("solana-mainnet-beta")).toBe("Solana")
    expect(networkLabel("ethereum-mainnet")).toBe("Ethereum")
    expect(networkLabel("tron-mainnet")).toBe("Tron")
    expect(networkLabel("arbitrum-one")).toBe("Arbitrum")
  })

  it("never shows a technical suffix for an unknown network", () => {
    for (const id of ["fantom-mainnet", "linea-mainnet", "zksync-one", "newchain-beta"]) {
      expect(networkLabel(id)).not.toMatch(/mainnet|beta|-one/i)
      expect(networkLabel(id).length).toBeGreaterThan(0)
    }
  })
})

describe("preferredRoute", () => {
  const route = (network: string, key = network) => ({ network, key })

  it("starts from the cheapest network", () => {
    expect(preferredRoute([route("ethereum-mainnet"), route("solana-mainnet-beta"), route("tron-mainnet")])?.network).toBe("solana-mainnet-beta")
    expect(preferredRoute([route("ethereum-mainnet"), route("tron-mainnet")])?.network).toBe("tron-mainnet")
    expect(preferredRoute([route("ethereum-mainnet"), route("arbitrum-one")])?.network).toBe("arbitrum-one")
  })

  it("ranks Ethereum last and unknown networks in between", () => {
    expect(networkCostRank("ethereum-mainnet")).toBeGreaterThan(networkCostRank("somenew-mainnet"))
    expect(networkCostRank("somenew-mainnet")).toBeGreaterThan(networkCostRank("arbitrum-one"))
  })

  it("keeps the original order among equals and handles empty input", () => {
    expect(preferredRoute([route("a-mainnet", "first"), route("b-mainnet", "second")])?.key).toBe("first")
    expect(preferredRoute([])).toBeUndefined()
  })
})

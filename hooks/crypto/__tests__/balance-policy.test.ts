import { describe, expect, it } from "vitest"

import { flattenSnapshot, unavailableNetworksOf } from "@/hooks/crypto/balance-policy"
import type { CryptoBalanceSnapshot } from "@/lib/crypto-backend"

const readyResult = {
  accountId: "acct-evm",
  networkId: "ethereum-mainnet",
  networkName: "Ethereum",
  family: "evm",
  address: "0xabc",
  status: "ready" as const,
  balances: [
    {
      asset: { kind: "native" as const, identifier: "ETH" },
      amountBaseUnits: "1234500000000000001",
      decimals: 18,
      symbol: "ETH",
    },
  ],
}

const unavailableResult = {
  accountId: "acct-sol",
  networkId: "solana-mainnet-beta",
  networkName: "Solana",
  family: "solana",
  address: "sol-address",
  status: "unavailable" as const,
  balances: [],
  error: { code: "provider_timeout", message: "Upstream provider timed out" },
}

describe("flattenSnapshot", () => {
  it("returns an empty array for an incomplete payload (missing results)", () => {
    expect(flattenSnapshot(undefined)).toEqual([])
    expect(flattenSnapshot(null)).toEqual([])
    expect(flattenSnapshot({} as CryptoBalanceSnapshot)).toEqual([])
  })

  it("excludes unavailable networks from the flattened balances", () => {
    const snapshot: CryptoBalanceSnapshot = {
      generatedAt: "2026-08-27T00:00:00.000Z",
      results: [readyResult, unavailableResult],
    }
    const balances = flattenSnapshot(snapshot)
    expect(balances).toHaveLength(1)
    expect(balances.map((b) => b.networkId)).toEqual(["ethereum-mainnet"])
  })

  it("keeps exact amountBaseUnits strings (no precision loss) and attaches account/network context", () => {
    const snapshot: CryptoBalanceSnapshot = {
      generatedAt: "2026-08-27T00:00:00.000Z",
      results: [readyResult],
    }
    const [balance] = flattenSnapshot(snapshot)
    expect(balance.amountBaseUnits).toBe("1234500000000000001")
    expect(balance.accountId).toBe("acct-evm")
    expect(balance.networkId).toBe("ethereum-mainnet")
    expect(balance.networkName).toBe("Ethereum")
  })
})

describe("unavailableNetworksOf", () => {
  it("returns an empty array for an incomplete payload (missing results)", () => {
    expect(unavailableNetworksOf(undefined)).toEqual([])
    expect(unavailableNetworksOf(null)).toEqual([])
  })

  it("reports only the unavailable results", () => {
    const snapshot: CryptoBalanceSnapshot = {
      generatedAt: "2026-08-27T00:00:00.000Z",
      results: [readyResult, unavailableResult],
    }
    const unavailable = unavailableNetworksOf(snapshot)
    expect(unavailable).toHaveLength(1)
    expect(unavailable[0].networkId).toBe("solana-mainnet-beta")
    expect(unavailable[0].status).toBe("unavailable")
  })
})

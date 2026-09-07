import { describe, expect, it } from "vitest"
import { spotBalanceAssets, spotBalanceRows } from "@/lib/crypto-backend/spot-balance"
import type { HlSpotMarket } from "@/lib/crypto-api"

const solMarket = {
  symbol: "SOL",
  networkId: "solana-mainnet-beta",
  inputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  outputMint: "So11111111111111111111111111111111111111112",
} as const

describe("spot balance identity", () => {
  it("does not ask the token endpoint for wrapped SOL", () => {
    expect(spotBalanceAssets(solMarket as HlSpotMarket)).toEqual([solMarket.inputMint])
  })

  it("matches a route's wrapped SOL identifier to both native and wrapped SOL", () => {
    const rows = spotBalanceRows([
      { networkId: solMarket.networkId, asset: { kind: "native", identifier: "SOL" }, amountBaseUnits: "4395000", decimals: 9, symbol: "SOL" },
      { networkId: solMarket.networkId, asset: { kind: "token", identifier: solMarket.outputMint }, amountBaseUnits: "9610512", decimals: 9, symbol: "wSOL" },
    ], solMarket.networkId, "SOL", solMarket.outputMint)
    expect(rows).toHaveLength(2)
    expect(rows[0]?.amountBaseUnits).toBe("4395000")
    expect(rows[1]?.amountBaseUnits).toBe("9610512")
  })

  it("keeps same-symbol assets isolated by their on-chain identifier", () => {
    const rows = spotBalanceRows([
      { networkId: "arbitrum-one", asset: { kind: "token", identifier: "0xaf88d065e77c8cc2239327c5edb3a432268e5831" }, amountBaseUnits: "666144", decimals: 6, symbol: "USDC" },
      { networkId: "solana-mainnet-beta", asset: { kind: "token", identifier: solMarket.inputMint }, amountBaseUnits: "2731714", decimals: 6, symbol: "USDC" },
    ], solMarket.networkId, "USDC", solMarket.inputMint)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.amountBaseUnits).toBe("2731714")
  })
})

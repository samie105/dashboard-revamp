import { describe, expect, it } from "vitest"
import { explorerTxUrl, networkMetaFor } from "@/lib/crypto-backend/network-meta"

describe("network-meta", () => {
  it("maps known backend ids to the display registry", () => {
    expect(networkMetaFor("arbitrum-one")?.key).toBe("arbitrum")
    expect(networkMetaFor("solana-mainnet-beta")?.key).toBe("solana")
  })
  it("builds explorer tx links", () => {
    expect(explorerTxUrl("ethereum-mainnet", "0xabc")).toBe("https://etherscan.io/tx/0xabc")
    expect(explorerTxUrl("solana-mainnet-beta", "sig")).toBe("https://solscan.io/tx/sig")
  })
  it("returns null (omit the link) for unknown networks instead of guessing", () => {
    expect(networkMetaFor("base-mainnet")).toBeNull()
    expect(explorerTxUrl("base-mainnet", "0xabc")).toBeNull()
  })
  it("falls back to matching by family + chainId from the live network list", () => {
    const live = [{ id: "eth-main", family: "evm", name: "Ethereum", environment: "mainnet", chainId: 1, nativeAsset: "ETH", capabilities: {} }]
    expect(networkMetaFor("eth-main", live)?.key).toBe("ethereum")
  })
})

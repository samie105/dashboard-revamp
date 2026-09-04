import { describe, expect, it } from "vitest"
import { swapAssetForToken } from "@/components/swap/swap-model"

describe("canonical swap assets", () => {
  it("does not treat a symbol as globally unique", () => {
    expect(swapAssetForToken("ethereum", "USDC")?.address).not.toBe(swapAssetForToken("arbitrum", "USDC")?.address)
  })

  it("keeps native assets scoped to their chain", () => {
    expect(swapAssetForToken("ton", "TON")?.assetId).toBe("ton-mainnet:TON:native")
    expect(swapAssetForToken("tron", "TRX")?.assetId).toBe("tron-mainnet:TRX:native")
  })
})

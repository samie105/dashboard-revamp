import { describe, expect, it } from "vitest"
import { tokensForChain } from "@/components/swap/swap-model"

describe("tokensForChain", () => {
  const coins = ["BTC", "ETH", "SOL", "USDC", "TRX"].map((symbol) => ({ symbol }))

  it("only returns tokens supported by the selected chain", () => {
    expect(tokensForChain("tron", coins).map((coin) => coin.symbol)).toEqual(["USDC", "TRX"])
    expect(tokensForChain("solana", coins).map((coin) => coin.symbol)).toEqual(["SOL", "USDC"])
  })

  it("returns no tokens for an unknown chain", () => {
    expect(tokensForChain("unknown", coins)).toEqual([])
  })
})

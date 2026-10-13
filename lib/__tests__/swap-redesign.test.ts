import { describe, expect, it } from "vitest"

import type { CoinData } from "@/lib/actions"
import type { QuoteData } from "@/components/swap/swap-model"
import { balanceOf, durationLabel, networkLabel, optionKey, quoteFigures, routeSteps, swapBucket, tokenOptions } from "@/lib/swap-redesign"

const coin = (symbol: string): CoinData => ({ id: symbol.toLowerCase(), symbol, name: symbol, price: 1, change24h: 0, marketCap: 0, volume24h: 0, image: "" })

function quote(over: Partial<QuoteData> = {}): QuoteData {
  return {
    toAmount: "5000000000",
    toAmountMin: "4975000000",
    toAmountUSD: "910",
    fromAmountUSD: "1000",
    priceImpact: 0.12,
    gasCostUSD: "0.61",
    tool: "1inch",
    executionData: {},
    fromToken: { chainId: 42161, address: "0xaf88", symbol: "USDC", decimals: 6 },
    toToken: { chainId: 1151111081099710, address: "native", symbol: "SOL", decimals: 9 },
    ...over,
  }
}

describe("tokenOptions", () => {
  it("lists each routable chain's whitelisted tokens, keyed by chain", () => {
    const opts = tokenOptions([coin("ETH"), coin("USDC"), coin("SOL"), coin("DOGE")])
    const keys = opts.map((o) => o.key)
    expect(keys).toContain(optionKey("arbitrum", "USDC"))
    expect(keys).toContain(optionKey("ethereum", "ETH"))
    expect(keys).toContain(optionKey("solana", "SOL"))
    expect(keys.some((k) => k.endsWith(":DOGE"))).toBe(false)
    // The same symbol on two chains is two options.
    expect(opts.filter((o) => o.coin.symbol === "USDC").map((o) => o.chain)).toEqual(expect.arrayContaining(["ethereum", "arbitrum", "solana"]))
  })
})

describe("balanceOf", () => {
  const fmt = (base: string, d: number) => String(Number(base) / 10 ** d)
  const balances = [
    { networkId: "arbitrum-one", symbol: "USDC", asset: { identifier: "0xAF88D065E77C8CC2239327C5EDB3A432268E5831" }, amountBaseUnits: "2500000", decimals: 6 },
    { networkId: "arbitrum-one", symbol: "USDC", asset: { identifier: "0xaf88d065e77c8cc2239327c5edb3a432268e5831" }, amountBaseUnits: "500000", decimals: 6 },
    { networkId: "arbitrum-one", symbol: "ETH", asset: { identifier: "ETH" }, amountBaseUnits: "120000000000000000", decimals: 18 },
    { networkId: "ethereum-mainnet", symbol: "USDC", asset: { identifier: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" }, amountBaseUnits: "9000000", decimals: 6 },
  ]
  it("matches a token by contract on its own chain, summed across accounts", () => {
    expect(balanceOf(balances, "arbitrum", "USDC", fmt)).toBe(3)
  })
  it("matches a native coin by symbol", () => {
    expect(balanceOf(balances, "arbitrum", "ETH", fmt)).toBeCloseTo(0.12)
  })
  it("is zero for an unknown chain", () => {
    expect(balanceOf(balances, "ton", "TON", fmt)).toBe(0)
  })
})

describe("quoteFigures", () => {
  it("is all null without a quote", () => {
    expect(quoteFigures(null, 1, 1)).toEqual({ rate: null, minReceived: null, impact: null, feesUsd: null, arrivesSeconds: null })
  })
  it("reads every figure off the quote", () => {
    const f = quoteFigures(
      quote({ feeCosts: [{ name: "LI.FI", amountUSD: "2.5", included: false }, { name: "inside", amountUSD: "9", included: true }], executionDuration: 25, priceImpact: -0.4 }),
      1000,
      5,
    )
    expect(f.rate).toBe(0.005)
    expect(f.minReceived).toBeCloseTo(4.975)
    expect(f.impact).toBeCloseTo(0.4)
    expect(f.feesUsd).toBeCloseTo(3.11)
    expect(f.arrivesSeconds).toBe(25)
  })
  it("leaves out what the quote doesn't carry", () => {
    const f = quoteFigures(quote({ gasCostUSD: "", executionDuration: undefined }), 0, 5)
    expect(f.rate).toBeNull()
    expect(f.feesUsd).toBeNull()
    expect(f.arrivesSeconds).toBeNull()
  })
  it("labels durations", () => {
    expect(durationLabel(8)).toBe("~8s")
    expect(durationLabel(190)).toBe("~3 min")
  })
})

describe("routeSteps", () => {
  it("uses the quote's legs and marks a chain change as a bridge", () => {
    const steps = routeSteps(
      quote({ steps: [{ tool: "uniswap", type: "swap", fromSymbol: "ETH", toSymbol: "USDC" }, { tool: "across", type: "cross", fromSymbol: "USDC", toSymbol: "USDC" }] }),
      "ETH",
      "USDC",
    )
    expect(steps.map((s) => [s.kind, s.venue, s.detail])).toEqual([
      ["swap", "uniswap", "ETH → USDC"],
      ["bridge", "across", "USDC → USDC"],
    ])
  })
  it("falls back to the single tool on an older backend", () => {
    expect(routeSteps(quote(), "USDC", "SOL")).toEqual([{ kind: "swap", venue: "1inch", logo: undefined, detail: "USDC → SOL" }])
  })
  it("is empty without a quote", () => {
    expect(routeSteps(null, "A", "B")).toEqual([])
  })
})

describe("history", () => {
  it("buckets statuses", () => {
    expect(swapBucket("completed")).toBe("completed")
    expect(swapBucket("failed")).toBe("failed")
    expect(swapBucket("expired")).toBe("failed")
    expect(swapBucket("submitted")).toBe("pending")
  })
  it("names networks", () => {
    expect(networkLabel("arbitrum-one")).toBe("Arbitrum")
    expect(networkLabel("solana-mainnet-beta")).toBe("Solana")
    expect(networkLabel("weird-net")).toBe("weird-net")
    expect(networkLabel(undefined)).toBeNull()
  })
})

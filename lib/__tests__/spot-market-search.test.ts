import { describe, it, expect } from "vitest"
import {
  ALL_CHAINS,
  buildSpotIndex,
  chainOptionsFor,
  searchSpotMarkets,
} from "@/lib/spot-market-search"
import type { HlSpotMarket } from "@/lib/crypto-api"

const ETH_MAINNET = "ethereum-mainnet"
const ARBITRUM = "arbitrum-one"
const SOLANA = "solana-mainnet-beta"

function m(over: Partial<HlSpotMarket> & { symbol: string; id: string }): HlSpotMarket {
  return {
    coinName: over.symbol,
    price: 1,
    quote: "USDC",
    networkId: ETH_MAINNET,
    ...over,
  }
}

/* Registry order is deliberately hostile: the row a user means is never first. */
const REGISTRY: HlSpotMarket[] = [
  m({ id: "wbtc-eth", symbol: "WBTC" }),
  m({ id: "tbtc-eth", symbol: "TBTC" }),
  m({ id: "btc-sol", symbol: "BTC", networkId: SOLANA }),
  m({ id: "weth-arb", symbol: "WETH", networkId: ARBITRUM }),
  m({ id: "weth-eth", symbol: "WETH", networkId: ETH_MAINNET }),
  m({ id: "sol-sol", symbol: "SOL", networkId: SOLANA, inputMint: "So11111111111111111111111111111111111111112" }),
  m({ id: "usdt-eth", symbol: "USDT", quote: "USDC" }),
]

const index = buildSpotIndex(REGISTRY)
const keys = (list: readonly { symbol: string }[]) => list.map((x) => x.symbol)
const ids = (list: readonly HlSpotMarket[]) => list.map((x) => x.id)

describe("searchSpotMarkets", () => {
  it("returns the registry untouched when nothing is asked of it", () => {
    expect(ids(searchSpotMarkets(index) as HlSpotMarket[])).toEqual(ids(REGISTRY))
  })

  it("ranks an exact symbol above rows that merely contain it", () => {
    // The old substring filter returned WBTC, TBTC, BTC in that order.
    expect(keys(searchSpotMarkets(index, { query: "btc" }))[0]).toBe("BTC")
  })

  it("prefers a prefix match over a mid-string one", () => {
    expect(keys(searchSpotMarkets(index, { query: "wb" }))).toEqual(["WBTC"])
  })

  it("matches the SYMBOL/QUOTE pair", () => {
    expect(keys(searchSpotMarkets(index, { query: "sol/usdc" }))).toEqual(["SOL"])
  })

  it("finds a market by a pasted token address", () => {
    const hit = searchSpotMarkets(index, {
      query: "So11111111111111111111111111111111111111112",
    })
    expect(ids(hit as HlSpotMarket[])).toEqual(["sol-sol"])
  })

  it("matches on chain name, but never above a symbol match", () => {
    // "sol" is SOL the asset first and Solana the network second.
    const hit = keys(searchSpotMarkets(index, { query: "sol" }))
    expect(hit[0]).toBe("SOL")
    expect(hit).toContain("BTC") // the other Solana row, ranked below
  })

  it("separates same-symbol rows by chain", () => {
    const arb = searchSpotMarkets(index, { query: "weth", chain: ARBITRUM })
    expect(ids(arb as HlSpotMarket[])).toEqual(["weth-arb"])
    const eth = searchSpotMarkets(index, { query: "weth", chain: ETH_MAINNET })
    expect(ids(eth as HlSpotMarket[])).toEqual(["weth-eth"])
  })

  it("applies the chain filter with no query", () => {
    expect(ids(searchSpotMarkets(index, { chain: SOLANA }) as HlSpotMarket[])).toEqual([
      "btc-sol",
      "sol-sol",
    ])
  })

  it("floats pinned rows to the top of an unqueried list", () => {
    const favorites = new Set(["usdt-eth"])
    expect(ids(searchSpotMarkets(index, { favorites }) as HlSpotMarket[])[0]).toBe("usdt-eth")
  })

  it("does not let a pin outrank a better match", () => {
    const favorites = new Set(["wbtc-eth"])
    expect(keys(searchSpotMarkets(index, { query: "btc", favorites }))[0]).toBe("BTC")
  })

  it("returns nothing rather than everything when a query matches nothing", () => {
    expect(searchSpotMarkets(index, { query: "zzzz" })).toEqual([])
  })

  it("treats ALL_CHAINS as the absence of a filter", () => {
    expect(ids(searchSpotMarkets(index, { chain: ALL_CHAINS }) as HlSpotMarket[])).toEqual(
      ids(REGISTRY),
    )
  })
})

describe("chainOptionsFor", () => {
  it("counts only the chains the list actually contains", () => {
    const opts = chainOptionsFor(REGISTRY)
    expect(opts.map((o) => [o.id, o.count])).toEqual([
      [ETH_MAINNET, 4],
      [SOLANA, 2],
      [ARBITRUM, 1],
    ])
  })

  it("is empty for rows that carry no network (futures)", () => {
    expect(chainOptionsFor([{ symbol: "BTC", price: 1, maxLeverage: 20 }])).toEqual([])
  })
})

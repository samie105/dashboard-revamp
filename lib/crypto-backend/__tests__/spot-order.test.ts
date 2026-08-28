import { describe, expect, it } from "vitest"
import {
  buildSpotOrderPlan,
  SLIPPAGE_BPS,
  SLIPPAGE_PERCENTAGE,
  tokenDecimalsFor,
  type ModernSpotMarketRow,
} from "@/lib/crypto-backend/spot-order"

const ARB_USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
const ARB_WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"
const SOL_MINT = "So11111111111111111111111111111111111111112"
const SOL_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

/** A row exactly as `/trading/spot/markets` returns it (0x venue). */
const wethRow: ModernSpotMarketRow = {
  id: "arbitrum-one:weth-usdc",
  symbol: "WETH",
  quote: "USDC",
  networkId: "arbitrum-one",
  venue: "0x",
  chartSymbol: "WETHUSD",
  chartSupported: true,
  price: 2500,
  sellToken: ARB_USDC,
  buyToken: ARB_WETH,
}

/** A row exactly as `/trading/spot/markets` returns it (Jupiter venue). */
const solRow: ModernSpotMarketRow = {
  id: "solana-mainnet-beta:sol-usdc",
  symbol: "SOL",
  quote: "USDC",
  networkId: "solana-mainnet-beta",
  venue: "jupiter",
  chartSymbol: "SOLUSD",
  chartSupported: true,
  price: 200,
  inputMint: SOL_USDC,
  outputMint: SOL_MINT,
}

describe("buildSpotOrderPlan — 0x rows", () => {
  it("buys the base by selling the quote token, sized in quote base units", () => {
    const plan = buildSpotOrderPlan(wethRow, "buy", 100, 2500)
    expect(plan.kind).toBe("evm")
    if (plan.kind !== "evm") return
    expect(plan.input.networkId).toBe("arbitrum-one")
    expect(plan.input.sellToken).toBe(ARB_USDC)
    expect(plan.input.buyToken).toBe(ARB_WETH)
    // 100 USDC at 6 decimals — exact, never a float scaling.
    expect(plan.input.sellAmountBaseUnits).toBe("100000000")
    expect(plan.input.slippagePercentage).toBe(SLIPPAGE_PERCENTAGE)
    expect(plan.input.idempotencyKey).toEqual(expect.any(String))
    expect(plan.input.idempotencyKey).not.toBe("")
  })

  it("sells the base for the quote, sized as amountUsd / price in base-token units", () => {
    const plan = buildSpotOrderPlan(wethRow, "sell", 100, 2500)
    expect(plan.kind).toBe("evm")
    if (plan.kind !== "evm") return
    expect(plan.input.sellToken).toBe(ARB_WETH)
    expect(plan.input.buyToken).toBe(ARB_USDC)
    // 100 / 2500 = 0.04 WETH at 18 decimals.
    expect(plan.input.sellAmountBaseUnits).toBe("40000000000000000")
  })

  it("prints only the double's honest digits — no binary noise in the base units", () => {
    // 10 / 3 is 3.3333333333333335 as a double; the order must carry the
    // quantity, not the float's tail. (100 / 2500).toFixed(18) has the same
    // disease: it reads 0.040000000000000001.
    const plan = buildSpotOrderPlan(wethRow, "sell", 10, 3)
    if (plan.kind !== "evm") throw new Error("expected an evm plan")
    expect(plan.input.sellAmountBaseUnits).toBe("3333333333333330000")
  })

  it("mints a fresh idempotency key per attempt", () => {
    const a = buildSpotOrderPlan(wethRow, "buy", 100, 2500)
    const b = buildSpotOrderPlan(wethRow, "buy", 100, 2500)
    if (a.kind !== "evm" || b.kind !== "evm") throw new Error("expected evm plans")
    expect(a.input.idempotencyKey).not.toBe(b.input.idempotencyKey)
  })
})

describe("buildSpotOrderPlan — Jupiter rows", () => {
  it("buys the base by spending the quote mint", () => {
    const plan = buildSpotOrderPlan(solRow, "buy", 50, 200)
    expect(plan.kind).toBe("solana")
    if (plan.kind !== "solana") return
    expect(plan.input.inputMint).toBe(SOL_USDC)
    expect(plan.input.outputMint).toBe(SOL_MINT)
    expect(plan.input.amountBaseUnits).toBe("50000000")
    expect(plan.input.slippageBps).toBe(SLIPPAGE_BPS)
    expect(plan.input.idempotencyKey).toEqual(expect.any(String))
  })

  it("sells the base mint, sized at 9 decimals", () => {
    const plan = buildSpotOrderPlan(solRow, "sell", 50, 200)
    expect(plan.kind).toBe("solana")
    if (plan.kind !== "solana") return
    expect(plan.input.inputMint).toBe(SOL_MINT)
    expect(plan.input.outputMint).toBe(SOL_USDC)
    // 50 / 200 = 0.25 SOL at 9 decimals.
    expect(plan.input.amountBaseUnits).toBe("250000000")
  })
})

describe("buildSpotOrderPlan — refuses rather than guesses", () => {
  it("refuses a token whose decimals it does not know", () => {
    const plan = buildSpotOrderPlan(
      { ...wethRow, symbol: "MYSTERY", buyToken: "0x0000000000000000000000000000000000000dead" },
      "sell",
      100,
      2500,
    )
    expect(plan.kind).toBe("unavailable")
    if (plan.kind !== "unavailable") return
    expect(plan.reason).toMatch(/precision/i)
  })

  it("refuses when the registry row carries no token addresses", () => {
    const plan = buildSpotOrderPlan({ ...wethRow, sellToken: undefined, buyToken: undefined }, "buy", 100, 2500)
    expect(plan.kind).toBe("unavailable")
    if (plan.kind !== "unavailable") return
    expect(plan.reason).toMatch(/token address/i)
  })

  it("refuses when a Jupiter row carries no mints", () => {
    const plan = buildSpotOrderPlan({ ...solRow, inputMint: undefined, outputMint: undefined }, "buy", 50, 200)
    expect(plan.kind).toBe("unavailable")
    if (plan.kind !== "unavailable") return
    expect(plan.reason).toMatch(/mint/i)
  })

  it("refuses a sell with no live price instead of dividing by zero", () => {
    const plan = buildSpotOrderPlan(wethRow, "sell", 100, 0)
    expect(plan.kind).toBe("unavailable")
    if (plan.kind !== "unavailable") return
    expect(plan.reason).toMatch(/price/i)
  })

  it("still builds a buy with no live price — a buy spends a known USD amount", () => {
    expect(buildSpotOrderPlan(wethRow, "buy", 100, 0).kind).toBe("evm")
  })

  it("refuses a market that is not quoted in a USD stablecoin", () => {
    const plan = buildSpotOrderPlan({ ...wethRow, quote: "WBTC" }, "buy", 100, 2500)
    expect(plan.kind).toBe("unavailable")
    if (plan.kind !== "unavailable") return
    expect(plan.reason).toMatch(/USD/)
  })

  it("refuses a row whose spend-side address contradicts the quote it names", () => {
    // A registry row stating the pair backwards would trade backwards. Where
    // the address is one we recognise, the orientation is checked, not trusted.
    const plan = buildSpotOrderPlan({ ...wethRow, sellToken: ARB_WETH, buyToken: ARB_USDC }, "buy", 100, 2500)
    expect(plan.kind).toBe("unavailable")
    if (plan.kind !== "unavailable") return
    expect(plan.reason).toMatch(/don't line up with the USDC quote/i)
  })

  it("refuses a Jupiter row whose input mint contradicts the quote it names", () => {
    const plan = buildSpotOrderPlan({ ...solRow, inputMint: SOL_MINT, outputMint: SOL_USDC }, "buy", 50, 200)
    expect(plan.kind).toBe("unavailable")
  })

  it("refuses a venue it cannot execute", () => {
    expect(buildSpotOrderPlan({ ...wethRow, venue: "uniswap" }, "buy", 100, 2500).kind).toBe("unavailable")
  })

  it("refuses a network the EVM spot endpoint does not accept", () => {
    const plan = buildSpotOrderPlan({ ...wethRow, networkId: "base-mainnet" }, "buy", 100, 2500)
    expect(plan.kind).toBe("unavailable")
    if (plan.kind !== "unavailable") return
    expect(plan.reason).toMatch(/base-mainnet/)
  })

  it("refuses an amount that rounds away to nothing", () => {
    const plan = buildSpotOrderPlan(wethRow, "buy", 0.0000001, 2500)
    expect(plan.kind).toBe("unavailable")
    if (plan.kind !== "unavailable") return
    expect(plan.reason).toMatch(/too small/i)
  })

  it("refuses a non-finite or non-positive amount", () => {
    expect(buildSpotOrderPlan(wethRow, "buy", 0, 2500).kind).toBe("unavailable")
    expect(buildSpotOrderPlan(wethRow, "buy", Number.NaN, 2500).kind).toBe("unavailable")
  })
})

describe("tokenDecimalsFor", () => {
  it("is case-insensitive for EVM addresses and exact for Solana mints", () => {
    expect(tokenDecimalsFor("arbitrum-one", ARB_USDC)).toBe(6)
    expect(tokenDecimalsFor("arbitrum-one", ARB_USDC.toLowerCase())).toBe(6)
    expect(tokenDecimalsFor("solana-mainnet-beta", SOL_MINT)).toBe(9)
    expect(tokenDecimalsFor("solana-mainnet-beta", SOL_MINT.toLowerCase())).toBeUndefined()
  })

  it("returns undefined for anything it has not been told", () => {
    expect(tokenDecimalsFor("arbitrum-one", "0x0000000000000000000000000000000000000dead")).toBeUndefined()
    expect(tokenDecimalsFor("base-mainnet", ARB_USDC)).toBeUndefined()
  })
})

import { describe, expect, it } from "vitest"
import {
  buildSpotOrderPlanFromTokenAmount,
  buildSpotOrderPlan,
  SLIPPAGE_PERCENTAGE,
  SLIPPAGE_MAX,
  SLIPPAGE_MIN,
  normalizeSlippage,
  spotOrderTokens,
  spotOrderProblem,
  spentTokenSymbol,
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

describe("buildSpotOrderPlan — Solana rows", () => {
  it("buys the base by spending the quote mint", () => {
    const plan = buildSpotOrderPlan(solRow, "buy", 50, 200)
    expect(plan.kind).toBe("lifi")
    if (plan.kind !== "lifi") return
    expect(plan.input.sellToken).toBe(SOL_USDC)
    expect(plan.input.buyToken).toBe(SOL_MINT)
    expect(plan.input.sellAmountBaseUnits).toBe("50000000")
    expect(plan.input.slippagePercentage).toBe(SLIPPAGE_PERCENTAGE)
    expect(plan.input.idempotencyKey).toEqual(expect.any(String))
  })

  it("sells the base mint, sized at 9 decimals", () => {
    const plan = buildSpotOrderPlan(solRow, "sell", 50, 200)
    expect(plan.kind).toBe("lifi")
    if (plan.kind !== "lifi") return
    expect(plan.input.sellToken).toBe(SOL_MINT)
    expect(plan.input.buyToken).toBe(SOL_USDC)
    // 50 / 200 = 0.25 SOL at 9 decimals.
    expect(plan.input.sellAmountBaseUnits).toBe("250000000")
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

describe("token-denominated sizing works on BOTH venues", () => {
  /* This path used to be Solana-only, which is why sizing an order in the
     token you are spending needed a second form that only appeared on Solana
     pairs. One resolver now serves both venues, so the ticket can offer the
     unit everywhere. */
  it("sizes an EVM sell in the base token's own units", () => {
    const plan = buildSpotOrderPlanFromTokenAmount(wethRow, "sell", "0.25")
    expect(plan.kind).toBe("evm")
    if (plan.kind !== "evm") return
    expect(plan.input.sellToken).toBe(ARB_WETH)
    expect(plan.input.buyToken).toBe(ARB_USDC)
    expect(plan.input.sellAmountBaseUnits).toBe("250000000000000000") // 0.25 at 18dp
  })

  it("sizes an EVM buy in the quote token's own units", () => {
    const plan = buildSpotOrderPlanFromTokenAmount(wethRow, "buy", "40")
    if (plan.kind !== "evm") throw new Error("expected an evm plan")
    expect(plan.input.sellToken).toBe(ARB_USDC)
    expect(plan.input.sellAmountBaseUnits).toBe("40000000") // 40 USDC at 6dp
  })

  it("needs no price, which is the point", () => {
    // The USD path refuses a sell without one; the token path never asks.
    expect(buildSpotOrderPlan({ ...wethRow, price: 0 }, "sell", 100, 0).kind).toBe("unavailable")
    expect(buildSpotOrderPlanFromTokenAmount({ ...wethRow, price: 0 }, "sell", "0.25").kind).toBe("evm")
  })

  it("refuses more decimals than the token can carry rather than rounding", () => {
    const tooPrecise = buildSpotOrderPlanFromTokenAmount(solRow, "buy", "1.0000001")
    expect(tooPrecise.kind).toBe("unavailable")
    if (tooPrecise.kind !== "unavailable") return
    expect(tooPrecise.reason).toMatch(/at most 6 decimal places/i)
  })
})

describe("spentTokenSymbol names the unit the amount field spends", () => {
  it("is the quote on a buy and the base on a sell", () => {
    expect(spentTokenSymbol(wethRow, "buy")).toBe("USDC")
    expect(spentTokenSymbol(wethRow, "sell")).toBe("WETH")
    expect(spentTokenSymbol(solRow, "sell")).toBe("SOL")
  })

  it("is null for a row that cannot be traded, so no unit switch is offered", () => {
    expect(spentTokenSymbol({ ...solRow, venue: "uniswap" }, "buy")).toBeNull()
  })
})

describe("token-denominated Solana swaps share the one refuse-don't-guess path", () => {
  it("sizes a buy in the quote mint's own units", () => {
    const plan = buildSpotOrderPlanFromTokenAmount(solRow, "buy", "10")
    expect(plan.kind).toBe("lifi")
    if (plan.kind !== "lifi") return
    expect(plan.input.sellToken).toBe(SOL_USDC)
    expect(plan.input.buyToken).toBe(SOL_MINT)
    expect(plan.input.sellAmountBaseUnits).toBe("10000000") // 10 USDC at 6dp
    expect(plan.input.slippagePercentage).toBe(SLIPPAGE_PERCENTAGE)
  })

  it("sizes a sell in the base mint's own units", () => {
    const plan = buildSpotOrderPlanFromTokenAmount(solRow, "sell", "0.5")
    if (plan.kind !== "lifi") throw new Error("expected a lifi plan")
    expect(plan.input.sellToken).toBe(SOL_MINT)
    expect(plan.input.sellAmountBaseUnits).toBe("500000000") // 0.5 SOL at 9dp
  })

  it("refuses a misoriented row instead of spending the wrong token's scale", () => {
    // The failure this guards: field says "USDC amount", 10 typed, SOL's 9
    // decimals applied → 10 SOL (10e9 lamports) spent for a 10 USDC order.
    const misoriented = { ...solRow, inputMint: SOL_MINT, outputMint: SOL_USDC }
    expect(spotOrderProblem(misoriented, "buy")).toMatch(/don't line up with the USDC quote/i)
    expect(buildSpotOrderPlanFromTokenAmount(misoriented, "buy", "10").kind).toBe("unavailable")
  })

  it("refuses an unknown mint, a foreign venue and a missing quote", () => {
    expect(spotOrderProblem({ ...solRow, inputMint: "Mystery1111111111111111111111111111111111" }, "buy")).toMatch(/precision/i)
    // The resolver dispatches on venue, so a Solana row mislabelled "0x" is
    // now refused by the EVM branch — for its network, which is the honest
    // reason — rather than by a Solana-only guard.
    expect(spotOrderProblem({ ...solRow, venue: "0x" }, "buy")).toMatch(/solana-mainnet-beta/i)
    expect(spotOrderProblem({ ...solRow, venue: "uniswap" }, "buy")).toMatch(/route/i)
    expect(spotOrderProblem({ ...solRow, quote: undefined }, "buy")).toMatch(/quoted in/i)
  })

  it("passes a healthy row", () => {
    expect(spotOrderProblem(solRow, "buy")).toBeNull()
    expect(spotOrderProblem(solRow, "sell")).toBeNull()
  })

  it("refuses amounts the mint cannot represent", () => {
    const tooPrecise = buildSpotOrderPlanFromTokenAmount(solRow, "buy", "1.1234567")
    expect(tooPrecise.kind).toBe("unavailable")
    if (tooPrecise.kind !== "unavailable") return
    expect(tooPrecise.reason).toMatch(/decimal places/i)

    const zero = buildSpotOrderPlanFromTokenAmount(solRow, "buy", "0")
    expect(zero.kind).toBe("unavailable")
    if (zero.kind !== "unavailable") return
    expect(zero.reason).toMatch(/above zero/i)
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

/* The tolerance used to be a constant nothing could reach. It is a ticket
   setting now, which makes it a money path: whatever the screen sends has to
   arrive on the intent, and anything outside the band has to be pulled back
   into it BEFORE it can reach the backend — a typed "50" must never become a
   50% tolerance. */
describe("price-protection tolerance", () => {
  it("defaults to the house figure when the caller says nothing", () => {
    const usd = buildSpotOrderPlan(wethRow, "buy", 100, 2500)
    const token = buildSpotOrderPlanFromTokenAmount(solRow, "buy", "10")
    expect(usd.kind === "evm" && usd.input.slippagePercentage).toBe(SLIPPAGE_PERCENTAGE)
    expect(token.kind === "lifi" && token.input.slippagePercentage).toBe(SLIPPAGE_PERCENTAGE)
  })

  it("carries the caller's figure through to both venues", () => {
    const evm = buildSpotOrderPlan(wethRow, "buy", 100, 2500, 0.005)
    const lifi = buildSpotOrderPlan(solRow, "buy", 100, 200, 0.02)
    const byToken = buildSpotOrderPlanFromTokenAmount(solRow, "buy", "10", 0.005)
    expect(evm.kind === "evm" && evm.input.slippagePercentage).toBe(0.005)
    expect(lifi.kind === "lifi" && lifi.input.slippagePercentage).toBe(0.02)
    expect(byToken.kind === "lifi" && byToken.input.slippagePercentage).toBe(0.005)
  })

  it("clamps anything outside the band rather than sending it", () => {
    const tooWide = buildSpotOrderPlan(wethRow, "buy", 100, 2500, 0.5)
    const tooTight = buildSpotOrderPlan(wethRow, "buy", 100, 2500, 0.00001)
    const negative = buildSpotOrderPlan(wethRow, "buy", 100, 2500, -1)
    expect(tooWide.kind === "evm" && tooWide.input.slippagePercentage).toBe(SLIPPAGE_MAX)
    expect(tooTight.kind === "evm" && tooTight.input.slippagePercentage).toBe(SLIPPAGE_MIN)
    expect(negative.kind === "evm" && negative.input.slippagePercentage).toBe(SLIPPAGE_MIN)
  })

  /* A value that isn't a finite number is unreadable, not merely out of range,
     so it falls back to the house figure rather than being clamped to the
     widest one — "we couldn't read this" must never resolve to the most
     permissive setting on a money path. */
  it("falls back to the default for a figure that is not a number", () => {
    expect(normalizeSlippage(Number.NaN)).toBe(SLIPPAGE_PERCENTAGE)
    expect(normalizeSlippage(Number.POSITIVE_INFINITY)).toBe(SLIPPAGE_PERCENTAGE)
    expect(normalizeSlippage(undefined)).toBe(SLIPPAGE_PERCENTAGE)
  })
})

describe("spotOrderTokens", () => {
  it("names the token spent and the token received, flipping with the side", () => {
    const buy = spotOrderTokens(wethRow, "buy")
    const sell = spotOrderTokens(wethRow, "sell")
    expect(buy).toEqual({ spend: ARB_USDC, receive: ARB_WETH, networkId: "arbitrum-one" })
    expect(sell).toEqual({ spend: ARB_WETH, receive: ARB_USDC, networkId: "arbitrum-one" })
  })

  it("is null for a row that cannot be routed, rather than a guess", () => {
    expect(spotOrderTokens({ symbol: "NOPE", venue: "kraken" }, "buy")).toBeNull()
  })
})

import { describe, it, expect } from "vitest"
import { resolveOrder } from "@/components/trade/orders-panel"
import { addressKey, type RegistryRow, type SpotRegistry } from "@/hooks/useSpotRegistry"
import type { SpotOrder } from "@/hooks/useSpotOrders"

const SOLANA = "solana-mainnet-beta"
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
const TRUMP = "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN"
const DOLLAR = "D1111111111111111111111111111111111111111111"
/** LI.FI's spelling of native SOL: the System Program id. */
const NATIVE_SOL = "11111111111111111111111111111111"
const WSOL = "So11111111111111111111111111111111111111112"

function market(over: Partial<RegistryRow> & { symbol: string; address: string }): RegistryRow {
  return {
    id: `${SOLANA}:${over.symbol}`,
    networkId: SOLANA,
    quote: "USDC",
    price: 0,
    quoteAddress: USDC,
    icon: null,
    baseDecimals: 6,
    quoteDecimals: 6,
    ...over,
  }
}

/* Two USDC-quoted markets. "$1" is indexed first, which is exactly the
   collision that made every sell render as "$1" on the live screen. */
const trump = market({ symbol: "TRUMP", address: TRUMP, price: 2.25, baseDecimals: 6 })
const dollar = market({ symbol: "$1", address: DOLLAR, price: 1 })
/** The registry lists SOL by its WRAPPED mint — never the sentinel. */
const sol = market({ symbol: "SOL", address: WSOL, price: 130, baseDecimals: 9 })

const registry: SpotRegistry = {
  loading: false,
  bySymbol: new Map(),
  chains: [],
  byAddress: new Map([
    [addressKey(SOLANA, DOLLAR), dollar],
    [addressKey(SOLANA, TRUMP), trump],
    [addressKey(SOLANA, WSOL), sol],
  ]),
}

function order(over: Partial<SpotOrder>): SpotOrder {
  return {
    id: "o1",
    status: "confirmed",
    networkId: SOLANA,
    txHash: "sig",
    createdAt: "2026-09-02T00:16:00.000Z",
    sellToken: null,
    buyToken: null,
    amount: null,
    router: "LI.FI",
    ...over,
  }
}

describe("resolveOrder", () => {
  it("reads a buy from the token received", () => {
    const row = resolveOrder(
      order({ sellToken: USDC, buyToken: TRUMP, amount: "442194" }),
      registry,
    )
    expect(row.side).toBe("buy")
    expect(row.symbol).toBe("TRUMP")
    expect(row.size).toBeCloseTo(0.442194, 9)
    expect(row.unit).toBe("TRUMP")
    expect(row.valueUsd).toBeCloseTo(0.442194 * 2.25, 6)
  })

  it("reads a SELL from the token spent, not the one received", () => {
    /* The bug this guards: a sell receives USDC, and every USDC-quoted market
       shares that address — so matching on the received token labelled every
       sell with whichever market was indexed first ("$1"). */
    const row = resolveOrder(
      order({ sellToken: TRUMP, buyToken: USDC, amount: "499555" }),
      registry,
    )
    expect(row.symbol).toBe("TRUMP")
    expect(row.symbol).not.toBe("$1")
    expect(row.side).toBe("sell")
  })

  it("denominates a sell in the quote and treats the proceeds as dollars", () => {
    const row = resolveOrder(
      order({ sellToken: TRUMP, buyToken: USDC, amount: "499555" }),
      registry,
    )
    expect(row.unit).toBe("USDC")
    expect(row.size).toBeCloseTo(0.499555, 9)
    // Already dollars — not multiplied by the base's price.
    expect(row.valueUsd).toBeCloseTo(0.499555, 9)
  })

  it("still resolves a genuine $1 trade as $1", () => {
    const row = resolveOrder(
      order({ sellToken: USDC, buyToken: DOLLAR, amount: "1000000" }),
      registry,
    )
    expect(row.symbol).toBe("$1")
    expect(row.side).toBe("buy")
  })

  it("refuses a size when the registry never stated the precision", () => {
    const noDecimals: SpotRegistry = {
      ...registry,
      byAddress: new Map([
        [addressKey(SOLANA, TRUMP), { ...trump, baseDecimals: undefined }],
      ]),
    }
    const row = resolveOrder(
      order({ sellToken: USDC, buyToken: TRUMP, amount: "442194" }),
      noDecimals,
    )
    expect(row.symbol).toBe("TRUMP")
    expect(row.size).toBeNull()
    expect(row.valueUsd).toBeNull()
  })

  it("degrades to a short address for a token outside the registry", () => {
    const row = resolveOrder(
      order({ sellToken: USDC, buyToken: "1111111111111111111111111111", amount: "1" }),
      registry,
    )
    expect(row.side).toBeNull()
    expect(row.size).toBeNull()
    expect(row.symbol).toMatch(/^1111….*$/)
  })

  /* These three are the live rows that rendered as a bare `1111…1111`: LI.FI
     names native SOL with the System Program id, and the registry lists the
     wrapped mint, so nothing matched on either leg. */
  it("resolves a native-SOL buy through the wrapped market", () => {
    const row = resolveOrder(
      order({ sellToken: USDC, buyToken: NATIVE_SOL, amount: "8563066" }),
      registry,
    )
    expect(row.symbol).toBe("SOL")
    expect(row.side).toBe("buy")
    // 9 decimals, from the native token — not the 6 a USDC market would give.
    expect(row.size).toBeCloseTo(0.008563066, 12)
    expect(row.unit).toBe("SOL")
    expect(row.valueUsd).toBeCloseTo(0.008563066 * 130, 9)
  })

  it("resolves a native-SOL sell from the leg that was spent", () => {
    const row = resolveOrder(
      order({ sellToken: NATIVE_SOL, buyToken: USDC, amount: "1121279" }),
      registry,
    )
    expect(row.symbol).toBe("SOL")
    expect(row.side).toBe("sell")
    // Proceeds are USDC at 6dp, and already dollars.
    expect(row.unit).toBe("USDC")
    expect(row.size).toBeCloseTo(1.121279, 9)
    expect(row.valueUsd).toBeCloseTo(1.121279, 9)
  })

  it("names the native coin even when its market is absent", () => {
    const noSol: SpotRegistry = { ...registry, byAddress: new Map() }
    const row = resolveOrder(
      order({ sellToken: USDC, buyToken: NATIVE_SOL, amount: "8563066" }),
      noSol,
    )
    // The sentinel states the symbol and precision itself; only the price
    // needed the registry.
    expect(row.symbol).toBe("SOL")
    expect(row.side).toBe("buy")
    expect(row.size).toBeCloseTo(0.008563066, 12)
    expect(row.valueUsd).toBeNull()
  })

  it("omits a buy's value rather than pricing it at zero", () => {
    const unpriced: SpotRegistry = {
      ...registry,
      byAddress: new Map([[addressKey(SOLANA, TRUMP), { ...trump, price: 0 }]]),
    }
    const row = resolveOrder(
      order({ sellToken: USDC, buyToken: TRUMP, amount: "442194" }),
      unpriced,
    )
    expect(row.size).toBeCloseTo(0.442194, 9)
    expect(row.valueUsd).toBeNull()
  })
})

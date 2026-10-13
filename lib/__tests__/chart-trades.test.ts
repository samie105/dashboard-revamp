import { describe, expect, it } from "vitest"

import { normalizeGeckoTrades } from "@/lib/chart-trades"

const SOL = "So11111111111111111111111111111111111111112"
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

describe("normalizeGeckoTrades", () => {
  // Shaped like the live SOL/USDC pool response.
  const sell = { id: "a", attributes: { block_timestamp: "2026-10-07T13:04:41Z", from_token_address: SOL, to_token_address: USDC, from_token_amount: "83.4", to_token_amount: "9704.1", price_from_in_usd: "116.38", price_to_in_usd: "1.0006" } }
  const buy = { id: "b", attributes: { block_timestamp: "2026-10-07T13:05:00Z", from_token_address: USDC, to_token_address: SOL, from_token_amount: "500", to_token_amount: "4.29", price_from_in_usd: "1.0006", price_to_in_usd: "116.40" } }

  it("prices each trade in our token, whichever side it sits on, newest first", () => {
    expect(normalizeGeckoTrades([sell, buy], SOL)).toEqual([
      { id: "b", side: "buy", price: 116.4, size: 4.29, time: Date.parse("2026-10-07T13:05:00Z") },
      { id: "a", side: "sell", price: 116.38, size: 83.4, time: Date.parse("2026-10-07T13:04:41Z") },
    ])
  })
  it("matches the token case-insensitively and skips unrelated or broken rows", () => {
    expect(normalizeGeckoTrades([sell], SOL.toLowerCase())).toHaveLength(1)
    expect(normalizeGeckoTrades([{ id: "x", attributes: { from_token_address: "other", to_token_address: "else" } }], SOL)).toEqual([])
    expect(normalizeGeckoTrades([{ id: "y", attributes: { ...sell.attributes, price_from_in_usd: "nope" } }], SOL)).toEqual([])
    expect(normalizeGeckoTrades(undefined, SOL)).toEqual([])
  })
})

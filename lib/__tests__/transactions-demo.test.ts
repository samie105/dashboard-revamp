import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { describeLedgerRecord } from "@/lib/ledger-rows"
import { walletTokensFrom } from "@/lib/token-resolver"
import { MOCK_MINTS, mockLedgerRecords, mockWalletBalances } from "@/lib/transactions-mock"
import type { SpotRegistry } from "@/hooks/useSpotRegistry"

const NOW = Date.parse("2026-11-17T12:00:00Z")
/** No registry at all: the demo has to read right on the wallet feed alone. */
const EMPTY: SpotRegistry = { loading: false, bySymbol: new Map(), chains: [], byAddress: new Map() }
const wallet = walletTokensFrom(mockWalletBalances())
const rows = new Map(mockLedgerRecords(NOW).map((r) => [r.id, describeLedgerRecord(r, EMPTY, wallet)!]))

describe("sample-data gate", () => {
  beforeEach(() => vi.unstubAllEnvs())
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })
  const gate = async (env: Record<string, string>) => {
    vi.resetModules()
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v)
    return (await import("@/lib/transactions-mocks")).TRANSACTIONS_MOCKS_ENABLED
  }
  it("can never be on in a production build", async () => {
    expect(await gate({ NODE_ENV: "production", NEXT_PUBLIC_TRANSACTIONS_MOCKS: "true" })).toBe(false)
  })
  it("needs both next dev and the opt-in", async () => {
    expect(await gate({ NODE_ENV: "development", NEXT_PUBLIC_TRANSACTIONS_MOCKS: "true" })).toBe(true)
    expect(await gate({ NODE_ENV: "development", NEXT_PUBLIC_TRANSACTIONS_MOCKS: "" })).toBe(false)
  })
})

describe("sample records through the real mapping", () => {
  it("are all describable, dated in the past, and stable across loads", () => {
    const records = mockLedgerRecords(NOW)
    expect(records.every((r) => describeLedgerRecord(r, EMPTY, wallet))).toBe(true)
    expect(records.every((r) => Date.parse(r.createdAt!) <= NOW)).toBe(true)
    expect(mockLedgerRecords(NOW)).toEqual(records)
  })
  it("show an unlisted buy as a buy, named from the wallet", () => {
    expect(rows.get("demo-buy-puff")).toMatchObject({ label: "Bought", symbol: "PUFF", amount: 4821930, unit: "PUFF" })
    expect(rows.get("demo-buy-lion")).toMatchObject({ label: "Bought", symbol: "LION", amount: 125 })
  })
  it("keep an unnameable token unnamed and unsized", () => {
    expect(rows.get("demo-buy-mystery")).toMatchObject({ label: "Bought", symbol: "7GCi…W2hr", amount: null })
  })
  it("cover sales, token-for-token and the mint-named deposit", () => {
    expect(rows.get("demo-sell-puff")).toMatchObject({ label: "Sold", symbol: "PUFF", amount: 38.25, unit: "USDC", valueUsd: 38.25 })
    expect(rows.get("demo-swap-puff-lion")).toMatchObject({ label: "Swapped", amount: 40 })
    expect(rows.get("demo-recv-puff")).toMatchObject({ label: "Received", symbol: "PUFF" })
    expect(rows.get("demo-recv-puff")?.token.address).toBe(MOCK_MINTS.PUFF)
  })
})

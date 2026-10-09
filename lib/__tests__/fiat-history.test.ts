import { describe, expect, it } from "vitest"

import {
  mergeHistory,
  networkLabel,
  orderAmountText,
  orderAmounts,
  orderAssetSymbol,
  orderChip,
  orderLabel,
  orderRecovery,
  orderStatus,
  orderToRow,
  orderWalletNote,
  quotedReceive,
} from "@/lib/fiat-history"
import { filterBase, filterKind, labelOf, transactionsCsv } from "@/lib/transactions-view"
import type { FiatOrder } from "@/lib/crypto-backend/types"
import type { UnifiedTransaction } from "@/types/transactions"

// Shaped like the guide's illustrative orders (lines 795-858).
const order = (over: Partial<FiatOrder>): FiatOrder => ({
  id: "66f000000000000000000051",
  publicReference: "WS-ONSWITCH-000051",
  provider: "onswitch",
  direction: "onramp",
  country: "NG",
  currency: "NGN",
  channel: "BANK",
  asset: "ethereum:usdc",
  network: "ethereum-mainnet",
  state: "awaiting_bank_deposit",
  expectedDepositAmount: "80000",
  createdAt: "2026-10-07T09:00:00.000Z",
  updatedAt: "2026-10-07T09:05:00.000Z",
  ...over,
})

const NOW = new Date("2026-10-07T15:00:00.000Z")

// Every state guide §11 lists (lines 1028-1037).
const GUIDE_STATES = [
  "created", "quoted", "awaiting_bank_deposit", "awaiting_crypto_deposit", "crypto_intent_ready", "crypto_submitted",
  "provider_processing", "scheduled", "completed", "manual_review", "blocked", "failed", "reversed", "refund_in_flight",
  "refunded", "refund_failed",
]

describe("names", () => {
  it("reads the asset symbol from the order", () => {
    expect(orderAssetSymbol(order({}))).toBe("USDC")
    expect(orderAssetSymbol(order({ provider: "bridge", asset: "0x<canonical-worldstreet-usdc-address>" }))).toBe("USDC")
    expect(orderAssetSymbol(order({ asset: "0x1234567890abcdef" }))).toBe("0x1234…cdef")
  })
  it("labels by what the user did, with no provider name", () => {
    expect(orderLabel(order({}))).toBe("Buy USDC with NGN")
    const sell = orderLabel(order({ direction: "offramp", provider: "bridge", currency: "USD", asset: "0xabc" }))
    expect(sell).toBe("Sell USDC for USD")
    for (const s of [orderLabel(order({})), sell]) expect(s).not.toMatch(/onswitch|bridge/i)
  })
  it("formats the network id", () => {
    expect(networkLabel("ethereum-mainnet")).toBe("Ethereum Mainnet")
  })
})

describe("states", () => {
  it("gives every §11 state a chip and a status filter", () => {
    for (const state of GUIDE_STATES) {
      expect(orderChip(state).label.length).toBeGreaterThan(0)
      expect(["pending", "processing", "completed", "failed", "cancelled", "expired"]).toContain(orderStatus(state))
    }
  })
  it("puts §11's problem states under Failed and review under Pending", () => {
    for (const s of ["failed", "reversed", "refunded", "refund_failed"]) expect(orderStatus(s)).toBe("failed")
    expect(orderStatus("manual_review")).toBe("pending")
    expect(orderChip("manual_review").label).toBe("In review")
    expect(orderChip("crypto_intent_ready").label).toBe("Action needed")
    expect(orderStatus("completed")).toBe("completed")
  })
})

describe("recovery", () => {
  it("offers Continue only for unfinished, unpaused orders, as before", () => {
    expect(orderRecovery(order({}))?.href).toBe("/buy")
    expect(orderRecovery(order({ direction: "offramp", state: "crypto_intent_ready" }))?.kind).toBe("fiat-sell")
    expect(orderRecovery(order({ provider: "bridge", direction: "offramp", state: "crypto_intent_ready" }))?.kind).toBe("fiat-bridge-sell")
    expect(orderRecovery(order({ state: "completed" }))).toBeNull()
    expect(orderRecovery(order({ state: "manual_review" }))).toBeNull()
  })
})

describe("the second row", () => {
  it("explains it on a completed buy and on a sent sell", () => {
    expect(orderWalletNote(order({ state: "completed" }))).toContain("Received")
    expect(orderWalletNote(order({ direction: "offramp", state: "crypto_submitted" }))).toContain("Sent")
    expect(orderWalletNote(order({}))).toBeNull()
  })
})

describe("rows", () => {
  const wallet: UnifiedTransaction = { id: "w1", type: "deposit", amount: 5, token: "USDT", status: "completed", createdAt: "2026-10-07T12:00:00.000Z" }

  it("maps an order to a history row with its amount and reference", () => {
    const row = orderToRow(order({}))
    expect(row.type).toBe("deposit")
    expect(row.order?.publicReference).toBe("WS-ONSWITCH-000051")
    expect(orderAmountText(order({}))).toBe("80,000 NGN")
    expect(labelOf(row)).toBe("Buy USDC with NGN")
  })

  it("shows a sell's amount from its intent", () => {
    const sell = order({
      direction: "offramp",
      state: "crypto_intent_ready",
      expectedDepositAmount: undefined,
      cryptoIntent: { id: "i", status: "prepared", amount: "62.450000", asset: "USDC" } as FiatOrder["cryptoIntent"],
    })
    expect(orderAmountText(sell)).toBe("62.45 USDC")
    // The shape the sell flows read.
    const summarised = order({
      direction: "offramp",
      state: "crypto_intent_ready",
      expectedDepositAmount: undefined,
      cryptoIntent: { id: "i", status: "prepared", normalizedSummary: { amount: "10.5" } },
    })
    expect(orderAmountText(summarised)).toBe("10.5 USDC")
  })

  it("shows a buy's requested amount and nothing else from its payment instructions", () => {
    // The guide's onramp example (lines 809-816).
    const buy = order({
      expectedDepositAmount: undefined,
      providerDisplay: {
        paymentInstructions: { amount: "100000", currency: "NGN", bankName: "Example Bank", accountName: "WorldStreet Settlement", accountNumber: "******1234" },
      },
    })
    expect(orderAmountText(buy)).toBe("100,000 NGN")
    expect(transactionsCsv([orderToRow(buy)])).toContain('"100,000 NGN"')
    const shown = JSON.stringify([orderAmounts(buy), orderToRow(buy).amount, transactionsCsv([orderToRow(buy)])])
    for (const secret of ["Example Bank", "WorldStreet Settlement", "1234"]) expect(shown).not.toContain(secret)
    expect(orderAmountText(order({ expectedDepositAmount: undefined }))).toBeNull()
  })

  it("merges newest first and leaves the wallet list alone without orders", () => {
    expect(mergeHistory([wallet], undefined)).toEqual([wallet])
    expect(mergeHistory([wallet], [order({})]).map((r) => r.id)).toEqual(["w1", "66f000000000000000000051"])
  })

  it("files buys under Deposits, sells under Withdrawals, and finds them by reference", () => {
    const rows = mergeHistory([wallet], [order({}), order({ id: "s1", publicReference: "WS-X-9", direction: "offramp", state: "crypto_intent_ready" })])
    expect(filterKind(rows, "deposit").map((r) => r.id)).toEqual(["w1", "66f000000000000000000051"])
    expect(filterKind(rows, "withdrawal").map((r) => r.id)).toEqual(["s1"])
    expect(filterBase(rows, { status: "any", range: "all", query: "ws-x-9" }, NOW).map((r) => r.id)).toEqual(["s1"])
  })

  it("exports orders with their reference and state", () => {
    const csv = transactionsCsv([orderToRow(order({}))])
    expect(csv).toContain("WS-ONSWITCH-000051")
    expect(csv).toContain("Awaiting bank deposit")
    expect(csv).toContain('"80,000 NGN"')
  })
})

describe("quoted receive", () => {
  // The guide's quote example (lines 742-766).
  const quote = { id: "66f000000000000000000031", direction: "onramp" as const, destinationAmount: "62.450000", destinationCurrency: "USDC" }
  it("shows what the order's own quote delivers", () => {
    expect(quotedReceive(order({ quoteId: quote.id }), quote)).toBe("62.45 USDC")
  })
  it("ignores a missing, foreign or opposite-direction quote", () => {
    expect(quotedReceive(order({ quoteId: quote.id }), undefined)).toBeNull()
    expect(quotedReceive(order({ quoteId: "other" }), quote)).toBeNull()
    expect(quotedReceive(order({ quoteId: quote.id, direction: "offramp" }), quote)).toBeNull()
    expect(quotedReceive(order({ quoteId: undefined }), quote)).toBeNull()
  })
  it("shows a sell's payout only in the order's own currency", () => {
    const sell = order({ direction: "offramp", quoteId: "q2", currency: "NGN" })
    expect(quotedReceive(sell, { id: "q2", direction: "offramp", destinationAmount: "100000", destinationCurrency: "NGN" })).toBe("100,000 NGN")
    // A placeholder that still says USDC on the bank side is not shown.
    expect(quotedReceive(sell, { id: "q2", direction: "offramp", destinationAmount: "62.45", destinationCurrency: "USDC" })).toBeNull()
  })
})

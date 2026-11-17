import { describe, expect, it } from "vitest"

import { describeLedgerRecord } from "@/lib/ledger-rows"
import { cleanSymbol, looksLikeAddress, resolveToken, walletTokensFrom } from "@/lib/token-resolver"
import { chainLabel, explorerUrl, subjectOf, tokenExplorerUrl, isUnlisted } from "@/lib/transactions-view"
import { addressKey, type RegistryRow, type SpotRegistry } from "@/hooks/useSpotRegistry"
import type { CryptoTransactionRecord } from "@/lib/crypto-backend"
import type { UnifiedTransaction } from "@/types/transactions"

const SOLANA = "solana-mainnet-beta"
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
const TRUMP = "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN"
const WSOL = "So11111111111111111111111111111111111111112"
const NATIVE_SOL = "11111111111111111111111111111111"
/** A memecoin WorldStreet doesn't list. */
const MEME = "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr"
const OTHER = "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E"

function market(over: Partial<RegistryRow> & { symbol: string; address: string }): RegistryRow {
  return { id: `${SOLANA}:${over.symbol}`, networkId: SOLANA, quote: "USDC", price: 0, quoteAddress: USDC, icon: null, baseDecimals: 6, quoteDecimals: 6, ...over }
}
const registry: SpotRegistry = {
  loading: false,
  bySymbol: new Map(),
  chains: [],
  byAddress: new Map([
    [addressKey(SOLANA, TRUMP), market({ symbol: "TRUMP", address: TRUMP, price: 2 })],
    [addressKey(SOLANA, WSOL), market({ symbol: "SOL", address: WSOL, price: 150, baseDecimals: 9, icon: "sol.png" })],
  ]),
}

const wallet = walletTokensFrom([
  { networkId: SOLANA, asset: { kind: "token", identifier: MEME }, amountBaseUnits: "1", decimals: 5, symbol: "MEME", name: "Meme Coin", logo: "meme.png" },
  // The backend's placeholder for a token it couldn't name.
  { networkId: SOLANA, asset: { kind: "token", identifier: OTHER }, amountBaseUnits: "1", decimals: 8, symbol: "Token 9n4nbM…" },
  { networkId: SOLANA, asset: { kind: "native", identifier: "SOL" }, amountBaseUnits: "1", decimals: 9, symbol: "SOL" },
] as never)

const swap = (sellToken: string, buyToken: string, amount: string): CryptoTransactionRecord => ({
  id: "r",
  networkId: SOLANA,
  status: "confirmed",
  summary: { action: "jupiter-swap", sellToken, buyToken, amount },
})

describe("resolveToken", () => {
  it("resolves native coins by sentinel and by wrapped address, with the market's price", () => {
    for (const a of [NATIVE_SOL, WSOL]) {
      expect(resolveToken(SOLANA, a, registry)).toMatchObject({ symbol: "SOL", decimals: 9, role: "native", listed: true, price: 150, icon: "sol.png" })
    }
  })
  it("knows a quote token as a listed stablecoin", () => {
    expect(resolveToken(SOLANA, USDC, registry)).toMatchObject({ symbol: "USDC", decimals: 6, role: "stable", listed: true, price: 1 })
  })
  it("names an unlisted token the user holds from the wallet's balance feed", () => {
    expect(resolveToken(SOLANA, MEME, registry, wallet)).toMatchObject({ symbol: "MEME", name: "Meme Coin", decimals: 5, icon: "meme.png", listed: false, price: null, role: "token" })
  })
  it("never shows the backend's placeholder as a symbol, but keeps its precision", () => {
    expect(resolveToken(SOLANA, OTHER, registry, wallet)).toMatchObject({ symbol: null, decimals: 8 })
  })
  it("knows nothing about a token nothing knows", () => {
    expect(resolveToken(SOLANA, OTHER, registry)).toMatchObject({ symbol: null, decimals: undefined, listed: false })
  })
})

describe("swap side", () => {
  it("reads buying an UNLISTED token as a buy, not a sale (the bug)", () => {
    const row = describeLedgerRecord(swap(USDC, MEME, "1234500"), registry, wallet)!
    expect(row).toMatchObject({ label: "Bought", side: "buy", direction: "in", symbol: "MEME", icon: "meme.png", amount: 12.345, unit: "MEME", valueUsd: null })
    expect(row.paid?.symbol).toBe("USDC")
  })
  it("still reads it as a buy when the token can't be named, with no amount", () => {
    const row = describeLedgerRecord(swap(USDC, MEME, "1234500"), registry)!
    expect(row).toMatchObject({ label: "Bought", side: "buy", symbol: "7GCi…W2hr", amount: null, amountText: null })
  })
  it("reads paying with SOL for a token as a buy", () => {
    expect(describeLedgerRecord(swap(NATIVE_SOL, MEME, "100000"), registry, wallet)).toMatchObject({ side: "buy", symbol: "MEME" })
  })
  it("reads receiving the more money-like token as a sale of the other", () => {
    const toUsdc = describeLedgerRecord(swap(MEME, USDC, "2500000"), registry, wallet)!
    expect(toUsdc).toMatchObject({ label: "Sold", side: "sell", direction: "out", symbol: "MEME", amount: 2.5, unit: "USDC", valueUsd: 2.5 })
    const toSol = describeLedgerRecord(swap(MEME, NATIVE_SOL, "2000000000"), registry, wallet)!
    expect(toSol).toMatchObject({ side: "sell", symbol: "MEME", amount: 2, unit: "SOL", valueUsd: 300 })
  })
  it("calls token-for-token a swap and sizes the received side", () => {
    expect(describeLedgerRecord(swap(TRUMP, MEME, "100000"), registry, wallet)).toMatchObject({ label: "Swapped", side: "swap", direction: "neutral", symbol: "MEME", amount: 1 })
  })
  it("prices a listed buy from its market", () => {
    expect(describeLedgerRecord(swap(USDC, TRUMP, "1500000"), registry)).toMatchObject({ side: "buy", amount: 1.5, valueUsd: 3 })
  })
})

describe("transfers", () => {
  const transfer = (asset: Record<string, unknown>, amount = "3") =>
    ({ id: "t", networkId: SOLANA, status: "confirmed", direction: "incoming", summary: { action: "transfer", amount, asset } }) as CryptoTransactionRecord
  it("never shows a mint as the symbol (Solana deposits are named by mint)", () => {
    const row = describeLedgerRecord(transfer({ kind: "token", identifier: MEME, symbol: MEME }), registry, wallet)!
    expect(row.symbol).toBe("MEME")
    const unknown = describeLedgerRecord(transfer({ kind: "token", identifier: OTHER, symbol: OTHER }), registry)!
    expect(unknown.symbol).toBe("9n4n…eJ9E")
  })
  it("keeps a native transfer as before", () => {
    expect(describeLedgerRecord(transfer({ kind: "native", identifier: "SOL" }, "0.5"), registry)).toMatchObject({ label: "Received", symbol: "SOL", amount: 0.5 })
  })
})

describe("symbols and addresses", () => {
  it("tells an address from a symbol", () => {
    expect(looksLikeAddress(MEME)).toBe(true)
    expect(looksLikeAddress("0x" + "ab".repeat(20))).toBe(true)
    expect(looksLikeAddress("BONK")).toBe(false)
    expect(cleanSymbol("Token 7GCihg…")).toBeNull()
    expect(cleanSymbol(" WIF ")).toBe("WIF")
  })
})

describe("network ids", () => {
  it("names the ledger's full network ids", () => {
    expect(chainLabel("solana-mainnet-beta")).toBe("Solana")
    expect(chainLabel("arbitrum-one")).toBe("Arbitrum")
    expect(chainLabel("ethereum")).toBe("Ethereum")
  })
  it("sends each network's transactions to its own explorer", () => {
    expect(explorerUrl("ethereum-mainnet", "0xabc")).toBe("https://etherscan.io/tx/0xabc")
    expect(explorerUrl("arbitrum-one", "0xabc")).toBe("https://arbiscan.io/tx/0xabc")
    expect(explorerUrl("sui-mainnet", "h")).toBe("https://suiscan.xyz/mainnet/tx/h")
    expect(explorerUrl("tron-mainnet", "h")).toBe("https://tronscan.org/#/transaction/h")
  })
  it("links a token to its explorer page", () => {
    expect(tokenExplorerUrl("solana-mainnet-beta", MEME)).toEqual({ url: `https://solscan.io/token/${MEME}`, name: "Solscan" })
    expect(tokenExplorerUrl("ton-mainnet", "x")).toBeNull()
    expect(tokenExplorerUrl("solana-mainnet-beta", null)).toBeNull()
  })
})

describe("row subject", () => {
  const tx = (p: Partial<UnifiedTransaction>) => ({ id: "1", type: "swap", amount: 1, token: "MEME", status: "completed", createdAt: "", ...p }) as UnifiedTransaction
  it("titles a buy by what was bought and a sale by what was sold", () => {
    expect(subjectOf(tx({ subType: "buy", fromToken: "USDC", toToken: "MEME" }))).toBe("MEME")
    expect(subjectOf(tx({ subType: "sell", fromToken: "MEME", toToken: "USDC" }))).toBe("MEME")
    expect(subjectOf(tx({ subType: "swap", fromToken: "TRUMP", toToken: "MEME" }))).toBe("TRUMP → MEME")
  })
  it("flags only contract tokens WorldStreet doesn't list", () => {
    const info = { networkId: SOLANA, address: MEME, symbol: "MEME", name: null, icon: null, role: "token" as const }
    expect(isUnlisted(tx({ tokenInfo: { ...info, listed: false } }))).toBe(true)
    expect(isUnlisted(tx({ tokenInfo: { ...info, listed: true } }))).toBe(false)
    expect(isUnlisted(tx({ tokenInfo: { ...info, listed: false, role: "native", address: null } }))).toBe(false)
  })
})

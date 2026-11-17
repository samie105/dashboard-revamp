/**
 * Invented ledger records for the transactions page in local development
 * only (TRANSACTIONS_MOCKS_ENABLED). Imported behind NODE_ENV ===
 * "development" in hooks/use-unified-transactions.ts, so production bundles
 * never contain it.
 *
 * They are RAW records in the backend's own shape (CryptoTransactionRecord,
 * with the `summary` fields the swap and transfer routes write), so they run
 * through the real mapping: what shows on screen is what real records of the
 * same shape would show. Dated relative to `now`.
 *
 * The invented tokens (PUFF, LION, the unnamed one) use made-up mints, so
 * they're unlisted by construction. The wallet entries play the balance feed,
 * which is how a held unlisted token gets its name, logo and precision.
 */

import type { CryptoBalance, CryptoTransactionRecord } from "@/lib/crypto-backend"

const SOLANA = "solana-mainnet-beta"
const ETHEREUM = "ethereum-mainnet"
const ARBITRUM = "arbitrum-one"

export const MOCK_MINTS = {
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  SOL: "11111111111111111111111111111111",
  WSOL: "So11111111111111111111111111111111111111112",
  ETH: "0x0000000000000000000000000000000000000000",
  /** Invented, unlisted, held: named through the wallet. */
  PUFF: "PuFFxQ7mR4dragnWq1sYvH8tL2cJk5nB3eZoA6uMwVd",
  LION: "L1onKz8wP3hT6rYqN2vB9xCdF4gJ7mS5uEaR1oWtZkH",
  /** Invented, unlisted, not held: nothing can name it. */
  MYSTERY: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",
}

const ME_SOL = "Fq8kU7JtyKvnJsZJafXa6GfgjciFDKiNCDSYc5D2FfWy"
const ME_EVM = "0x3f5401b76080CB31B74A7ed98e38daE13c01c516"
const FRIEND_SOL = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
const FRIEND_EVM = "0x8ba1f109551bD432803012645Ac136ddd64DBA72"

type Spec = {
  id: string
  minsAgo: number
  networkId: string
  status?: "confirmed" | "failed" | "submitted"
  direction?: "incoming" | "outgoing" | "internal"
  from?: string
  to?: string
  summary: Record<string, unknown>
}

const swap = (sellToken: string, buyToken: string, amount: string, extra: Record<string, unknown> = {}) => ({ action: "jupiter-swap", sellToken, buyToken, amount, router: "Jupiter", ...extra })
const transfer = (amount: string, asset: Record<string, unknown>) => ({ action: "transfer", amount, asset })

const SPECS: Spec[] = [
  // Unlisted token bought with USDC: named from the wallet.
  { id: "buy-puff", minsAgo: 22, networkId: SOLANA, summary: swap(MOCK_MINTS.USDC, MOCK_MINTS.PUFF, "4821930000000") },
  // Unlisted token bought with SOL.
  { id: "buy-lion", minsAgo: 95, networkId: SOLANA, summary: swap(MOCK_MINTS.SOL, MOCK_MINTS.LION, "125000000000") },
  // Unlisted token nothing can name: bought, but no name and no amount.
  { id: "buy-mystery", minsAgo: 180, networkId: SOLANA, summary: swap(MOCK_MINTS.USDC, MOCK_MINTS.MYSTERY, "98765432100") },
  // A sale of an unlisted token: proceeds are dollars.
  { id: "sell-puff", minsAgo: 300, networkId: SOLANA, summary: swap(MOCK_MINTS.PUFF, MOCK_MINTS.USDC, "38250000") },
  // Token for token.
  { id: "swap-puff-lion", minsAgo: 26 * 60, networkId: SOLANA, summary: swap(MOCK_MINTS.PUFF, MOCK_MINTS.LION, "40000000000") },
  // Mainstream: SOL sold for USDC, USDC into SOL.
  { id: "sell-sol", minsAgo: 27 * 60, networkId: SOLANA, summary: swap(MOCK_MINTS.WSOL, MOCK_MINTS.USDC, "182400000") },
  { id: "buy-sol", minsAgo: 50 * 60, networkId: SOLANA, summary: swap(MOCK_MINTS.USDC, MOCK_MINTS.SOL, "1500000000") },
  // Cross-chain: SOL into ETH on Arbitrum.
  {
    id: "bridge-eth",
    minsAgo: 52 * 60,
    networkId: SOLANA,
    summary: { action: "spot-swap", sellToken: MOCK_MINTS.WSOL, buyToken: MOCK_MINTS.ETH, destinationNetworkId: ARBITRUM, amount: "210000000000000000", router: "LI.FI" },
  },
  // A Solana deposit of an unlisted token, named by its mint as the backend does.
  {
    id: "recv-puff",
    minsAgo: 3 * 24 * 60,
    networkId: SOLANA,
    direction: "incoming",
    from: FRIEND_SOL,
    to: ME_SOL,
    summary: transfer("250000", { kind: "token", identifier: MOCK_MINTS.PUFF, symbol: MOCK_MINTS.PUFF }),
  },
  { id: "recv-usdc", minsAgo: 4 * 24 * 60, networkId: SOLANA, direction: "incoming", from: FRIEND_SOL, to: ME_SOL, summary: transfer("500", { kind: "token", identifier: MOCK_MINTS.USDC, symbol: "USDC" }) },
  { id: "send-eth", minsAgo: 5 * 24 * 60, networkId: ETHEREUM, direction: "outgoing", from: ME_EVM, to: FRIEND_EVM, summary: transfer("0.25", { kind: "native", identifier: "ETH" }) },
  { id: "move-sol", minsAgo: 6 * 24 * 60, networkId: SOLANA, direction: "internal", from: ME_SOL, to: ME_SOL, summary: transfer("1.2", { kind: "native", identifier: "SOL" }) },
  // In flight, and one that failed.
  { id: "pending-lion", minsAgo: 3, networkId: SOLANA, status: "submitted", summary: swap(MOCK_MINTS.USDC, MOCK_MINTS.LION, "60000000000") },
  { id: "failed-puff", minsAgo: 8 * 24 * 60, networkId: SOLANA, status: "failed", summary: swap(MOCK_MINTS.USDC, MOCK_MINTS.PUFF, "1000000000000") },
]

/** A tx-hash-looking string per row, stable across reloads. */
function hashFor(id: string, evm: boolean) {
  const alphabet = evm ? "0123456789abcdef" : "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
  let h = 2166136261
  let out = ""
  for (let i = 0; i < (evm ? 64 : 88); i++) {
    h = Math.imul(h ^ id.charCodeAt(i % id.length) ^ i, 16777619) >>> 0
    out += alphabet[h % alphabet.length]
  }
  return evm ? `0x${out}` : out
}

export function mockLedgerRecords(now: number): CryptoTransactionRecord[] {
  return SPECS.map((s) => {
    const created = new Date(now - s.minsAgo * 60_000)
    const status = s.status ?? "confirmed"
    const evm = s.networkId !== SOLANA
    return {
      id: `demo-${s.id}`,
      status,
      networkId: s.networkId,
      txHash: hashFor(s.id, evm),
      direction: s.direction ?? "outgoing",
      fromAddress: s.from ?? (evm ? ME_EVM : ME_SOL),
      toAddress: s.to,
      summary: s.summary,
      createdAt: created.toISOString(),
      submittedAt: created.toISOString(),
      ...(status === "confirmed" ? { confirmedAt: new Date(created.getTime() + (evm ? 48_000 : 9_000)).toISOString() } : {}),
      ...(status === "failed" ? { failedAt: new Date(created.getTime() + 20_000).toISOString() } : {}),
    }
  })
}

/** What the balance feed would say about the held tokens. */
export function mockWalletBalances(): (CryptoBalance & { networkId: string })[] {
  return [
    { networkId: SOLANA, asset: { kind: "token", identifier: MOCK_MINTS.USDC }, amountBaseUnits: "212400000", decimals: 6, symbol: "USDC", name: "USD Coin" },
    { networkId: SOLANA, asset: { kind: "token", identifier: MOCK_MINTS.PUFF }, amountBaseUnits: "4500000000000", decimals: 6, symbol: "PUFF", name: "Puff Dragon" },
    { networkId: SOLANA, asset: { kind: "token", identifier: MOCK_MINTS.LION }, amountBaseUnits: "165000000000", decimals: 9, symbol: "LION", name: "Lion Cub" },
  ] as (CryptoBalance & { networkId: string })[]
}

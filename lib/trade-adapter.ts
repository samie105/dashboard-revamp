"use client"

/**
 * Adapter from the old spotv2 ledger-actions call signatures to the crypto
 * service. The six dashboard surfaces that showed "Spot" figures were built
 * against getSpotV2Balance/getSpotV2Positions/getTokenPrices; those now read
 * the user's REAL Hyperliquid trading account (GET /api/trade/account) and the
 * service's price feed — the same sources the mobile app uses.
 *
 * spotv2 (the ledger-CFD engine) is deleted; this file is what its consumers
 * import instead.
 */

import { fetchHlAccount, fetchPrices, fetchTransactions } from "@/lib/crypto-api"

export interface LedgerBalance {
  token: string
  available: number
  locked: number
}

export interface PositionInfo {
  token: string
  quantity: number
  avgEntryPrice: number
}

/** USDC sitting in the Hyperliquid spot account. */
export async function getSpotBalances(): Promise<LedgerBalance[]> {
  const account = await fetchHlAccount()
  const b = account.balances
  if (!b) return []
  return [{ token: "USDC", available: b.spotUsdc, locked: b.spotUsdcHold ?? 0 }]
}

/** Spot token holdings (non-USDC). Entry price isn't served — 0 keeps the shape. */
export async function getSpotPositions(): Promise<PositionInfo[]> {
  const account = await fetchHlAccount()
  const tokens = account.balances?.spotTokens ?? []
  return tokens
    .filter((t) => t.total > 0)
    .map((t) => ({ token: t.symbol, quantity: t.total, avgEntryPrice: 0 }))
}

/** Symbol → USD price map from the service's cached feed. */
export async function getTokenPrices(tokens: string[]): Promise<Map<string, number>> {
  const res = await fetchPrices()
  const map = new Map<string, number>()
  for (const t of tokens) {
    const direct = res.prices[t] ?? res.prices[t.toUpperCase()] ?? res.prices[t.toLowerCase()]
    if (direct !== undefined) {
      map.set(t, direct)
      continue
    }
    const coin = res.coins.find((c) => c.symbol.toLowerCase() === t.toLowerCase())
    if (coin) map.set(t, coin.price)
  }
  return map
}

export interface SpotTradeItem {
  id: string
  pair: string
  token: string
  side: string
  quantity: number
  price: number
  quoteAmount: number
  realizedPnl: number
  fee: number
  createdAt: Date
}

/**
 * Recent trade-ish history. The unified feed doesn't carry HL fills (mobile
 * has no fill history either), so this surfaces swaps/transfers as activity
 * rather than pretending to be a fill log.
 */
export async function getSpotTradeHistory(limit = 10): Promise<SpotTradeItem[]> {
  const page = await fetchTransactions({ limit: String(limit), type: "swap" })
  return page.transactions.map((t) => ({
    id: t.id,
    pair: t.token,
    token: t.token,
    side: t.side ?? t.direction ?? "swap",
    quantity: t.amount,
    price: 0,
    quoteAmount: t.fiatAmount ?? 0,
    realizedPnl: 0,
    fee: 0,
    createdAt: new Date(t.createdAt),
  }))
}

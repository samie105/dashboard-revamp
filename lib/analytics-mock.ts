/**
 * Invented records for /analytics in local development only.
 *
 * Imported behind NODE_ENV === "development" (see useAnalyticsData), so a
 * production bundle never contains it. Seeded, so a reload draws the same
 * page; dated relative to `now`, so every range has something in it.
 *
 * Shapes are the real ones: UnifiedTransaction rows as useUnifiedTransactions
 * returns them, FiatOrder's direction/state/createdAt, HlFill / HlPosition /
 * HlOpenOrder as the trading routes map them. The one invented field is each
 * close's exit reason, which no backend route serves yet.
 */

import type { FiatOrder } from "@/lib/crypto-backend/types"
import type { HlFill, HlOpenOrder, HlPosition } from "@/lib/crypto-api"
import type { ExitReason } from "@/lib/trading-analytics"
import type { UnifiedTransaction } from "@/types/transactions"

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = <T,>(r: () => number, xs: readonly T[]) => xs[Math.floor(r() * xs.length)]
function weighted<T>(r: () => number, xs: readonly (readonly [T, number])[]): T {
  const total = xs.reduce((n, [, w]) => n + w, 0)
  let x = r() * total
  for (const [v, w] of xs) if ((x -= w) < 0) return v
  return xs[xs.length - 1][0]
}

const DAY = 86_400_000
/** Busier on weekday evenings, like a real person with a job. */
function when(r: () => number, now: number, maxDays: number) {
  const daysBack = Math.floor(Math.pow(r(), 1.4) * maxDays)
  const d = new Date(now - daysBack * DAY)
  const hour = weighted(r, [[8, 1], [10, 2], [13, 2], [17, 2], [19, 4], [20, 4], [21, 3], [23, 1], [2, 0.4]] as const)
  d.setHours(Math.min(23, hour + Math.floor(r() * 2)), Math.floor(r() * 60), 0, 0)
  return Math.min(d.getTime(), now - 60_000)
}

const PRICES: Record<string, number> = { USDC: 1, USDT: 1, SOL: 182, ETH: 3420, SUI: 3.6, BONK: 0.000027, WIF: 2.1, JUP: 0.94, BTC: 97_500, HYPE: 31, DOGE: 0.38, ARB: 0.71 }

export function mockWalletRows(now: number): UnifiedTransaction[] {
  const r = rng(7)
  const chains = [["solana", 5], ["ethereum", 2], ["arbitrum", 2], ["sui", 1], ["tron", 1]] as const
  const tokensFor: Record<string, string[]> = {
    solana: ["USDC", "SOL", "BONK", "WIF", "JUP"],
    ethereum: ["ETH", "USDC", "USDT"],
    arbitrum: ["ETH", "USDC", "ARB"],
    sui: ["SUI", "USDC"],
    tron: ["USDT"],
  }
  return Array.from({ length: 96 }, (_, i) => {
    const chain = weighted(r, chains)
    const token = pick(r, tokensFor[chain])
    const kind = weighted(r, [["in", 4], ["out", 3], ["swap", 4]] as const)
    const usd = Math.round((15 + Math.pow(r(), 2.2) * 1400) * 100) / 100
    const status = weighted(r, [["completed", 16], ["processing", 1], ["pending", 1], ["failed", 2]] as const)
    const created = when(r, now, 150)
    const priced = r() > 0.08
    const row: UnifiedTransaction = {
      id: `sample-${i}`,
      type: kind === "in" ? "deposit" : kind === "out" ? "transfer" : "swap",
      subType: kind === "in" ? "receive" : kind === "out" ? "send" : "spot",
      direction: kind === "in" ? "incoming" : "outgoing",
      amount: usd / (PRICES[token] ?? 1),
      token,
      chain,
      status,
      valueUsd: priced ? usd : undefined,
      location: kind === "swap" ? "spot" : "wallet",
      createdAt: new Date(created).toISOString(),
      completedAt: status === "completed" ? new Date(created + (chain === "ethereum" ? 40 + r() * 200 : 4 + r() * 40) * 1000).toISOString() : undefined,
    }
    return row
  })
}

export function mockOrders(now: number): FiatOrder[] {
  const r = rng(11)
  return Array.from({ length: 11 }, (_, i) => {
    const created = when(r, now, 120)
    return {
      id: `sample-order-${i}`,
      direction: r() > 0.4 ? "onramp" : "offramp",
      state: weighted(r, [["completed", 7], ["awaiting_deposit", 1], ["processing", 1], ["expired", 1], ["failed", 1]] as const),
      createdAt: new Date(created).toISOString(),
    } as unknown as FiatOrder
  })
}

export type MockTrading = {
  fills: HlFill[]
  positions: HlPosition[]
  openOrders: HlOpenOrder[]
  /** Exit reason per closing fill, by tid. Sample data only. */
  exits: Map<string, ExitReason>
}

export function mockTrading(now: number): MockTrading {
  const r = rng(23)
  const markets = [["BTC", 4], ["ETH", 4], ["SOL", 3], ["HYPE", 2], ["DOGE", 1], ["ARB", 1]] as const
  const fills: HlFill[] = []
  const exits = new Map<string, ExitReason>()
  let oid = 900_000
  for (let i = 0; i < 64; i++) {
    const symbol = weighted(r, markets)
    const long = r() > 0.42
    const entry = PRICES[symbol] * (0.85 + r() * 0.3)
    const notional = 150 + Math.pow(r(), 1.8) * 2600
    const size = notional / entry
    const reason = weighted(r, [["take-profit", 34], ["stop-loss", 28], ["manual", 33], ["liquidation", 5]] as const)
    const move =
      reason === "take-profit" ? 0.02 + r() * 0.07 : reason === "stop-loss" ? -(0.01 + r() * 0.035) : reason === "liquidation" ? -(0.09 + r() * 0.05) : (r() - 0.45) * 0.06
    const exit = entry * (1 + (long ? move : -move))
    const openedAt = when(r, now, 88)
    const closedAt = Math.min(now - 30_000, openedAt + (0.3 + r() * 40) * 3_600_000)
    const lev = pick(r, [2, 3, 5, 5, 10])
    const pnl = (exit - entry) * size * (long ? 1 : -1)
    const feeOf = (px: number) => Math.round(px * size * 0.00045 * 1e4) / 1e4
    fills.push({ oid: ++oid, tid: `o${oid}`, symbol, side: long ? "buy" : "sell", price: entry, size, direction: long ? "Open Long" : "Open Short", closedPnl: 0, fee: feeOf(entry), feeToken: "USDC", timestamp: openedAt })
    const tid = `c${++oid}`
    fills.push({ oid, tid, symbol, side: long ? "sell" : "buy", price: exit, size, direction: long ? "Close Long" : "Close Short", closedPnl: Math.round(pnl * lev * 0.35 * 100) / 100 || 0.01, fee: feeOf(exit), feeToken: "USDC", timestamp: closedAt })
    exits.set(tid, reason)
  }
  fills.sort((a, b) => b.timestamp - a.timestamp)

  const pos = (symbol: string, side: "long" | "short", size: number, entry: number, mark: number, lev: number): HlPosition => {
    const signed = side === "long" ? size : -size
    const upnl = (mark - entry) * signed
    const notional = size * mark
    return {
      symbol, size: signed, absSize: size, side, entryPrice: entry, markPrice: mark, notionalUsd: notional, unrealizedPnl: upnl,
      returnOnEquity: upnl / (notional / lev), liquidationPrice: side === "long" ? entry * (1 - 0.9 / lev) : entry * (1 + 0.9 / lev),
      marginUsed: notional / lev, leverage: { type: "cross", value: lev },
    }
  }
  const positions = [
    pos("BTC", "long", 0.012, 95_800, 97_510, 5),
    pos("ETH", "short", 0.35, 3_510, 3_421, 3),
    pos("SOL", "long", 6, 176.4, 182.2, 10),
    pos("HYPE", "long", 22, 33.1, 31.05, 5),
  ]
  const trig = (symbol: string, side: "buy" | "sell", size: number, px: number, kind: "tp" | "sl"): HlOpenOrder => ({
    oid: ++oid, market: "futures", symbol, side, limitPrice: 0, size, origSize: size, isTrigger: true, triggerPrice: px,
    orderType: kind === "tp" ? "Take Profit Market" : "Stop Market", reduceOnly: true, timestamp: now - 3_600_000, known: true,
  })
  const openOrders = [
    trig("BTC", "sell", 0.012, 102_000, "tp"),
    trig("BTC", "sell", 0.012, 93_900, "sl"),
    trig("ETH", "buy", 0.35, 3_190, "tp"),
    trig("ETH", "buy", 0.35, 3_600, "sl"),
    trig("SOL", "sell", 6, 171, "sl"),
  ]
  return { fills, positions, openOrders, exits }
}

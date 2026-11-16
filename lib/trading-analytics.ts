/**
 * Trading analytics, from the futures account's own records.
 *
 * Sources: GET /trading/hyperliquid/fills (the latest 200 executions; the
 * backend maps each to symbol, side, price, size, `direction` such as
 * "Open Long" / "Close Short", `closedPnl`, `fee`, `feeToken`, `timestamp`),
 * and GET /trading/hyperliquid/account (open positions, and open orders with
 * `isTrigger`, `triggerPrice`, `orderType`, `reduceOnly`).
 *
 * A closed trade is a fill that closed or reduced a position: the backend's
 * own note on the fills route says `closedPnl` is 0 on a fill that only
 * opened or added and nonzero on one that closed or reduced. A "Close …"
 * direction counts too, so a close at exactly break-even isn't lost.
 *
 * What these sources cannot say is WHY a position closed (stop-loss,
 * take-profit, liquidation or by hand): fills carry no trigger flag. That
 * figure needs order history from the backend, so it stays null here and the
 * page shows it as coming soon. The dev sample data fills it in to show the
 * design.
 */

import type { HlFill, HlOpenOrder, HlPosition } from "@/lib/crypto-api"

export type ExitReason = "take-profit" | "stop-loss" | "liquidation" | "manual"

export const EXIT_LABELS: Record<ExitReason, string> = {
  "take-profit": "Take profit",
  "stop-loss": "Stop loss",
  liquidation: "Liquidated",
  manual: "Closed by you",
}

export const isClose = (f: HlFill) => f.closedPnl !== 0 || /^close/i.test(f.direction)
const isLongSide = (f: HlFill) => /long/i.test(f.direction)
const isShortSide = (f: HlFill) => /short/i.test(f.direction)

/** Fills within the last `days` days (Infinity for all). */
export function fillsInRange(fills: HlFill[], days: number, now: number): HlFill[] {
  return fills.filter((f) => f.timestamp > 0 && f.timestamp <= now && now - f.timestamp < days * 86_400_000)
}

export type TradingTotals = {
  /** Sum of closedPnl over closing fills, before fees. */
  realisedPnl: number
  /** Fees paid in USDC. Fees in another token are counted separately. */
  feesUsdc: number
  otherFeeFills: number
  /** Realised P&L minus USDC fees. */
  netPnl: number
  /** Price × size over every fill. */
  volumeUsd: number
  fills: number
  closed: number
  wins: number
  losses: number
  /** wins / (wins + losses); break-even closes count as neither. */
  winRate: number | null
  avgWin: number | null
  avgLoss: number | null
  /** Gross wins / gross losses; null without a loss to divide by. */
  profitFactor: number | null
  best: HlFill | null
  worst: HlFill | null
}

export function tradingTotals(fills: HlFill[]): TradingTotals {
  let realisedPnl = 0, feesUsdc = 0, otherFeeFills = 0, volumeUsd = 0, closed = 0, wins = 0, losses = 0, grossWin = 0, grossLoss = 0
  let best: HlFill | null = null
  let worst: HlFill | null = null
  for (const f of fills) {
    volumeUsd += Math.abs(f.price * f.size)
    if (f.fee) {
      if (f.feeToken.toUpperCase() === "USDC") feesUsdc += f.fee
      else otherFeeFills += 1
    }
    if (!isClose(f)) continue
    closed += 1
    realisedPnl += f.closedPnl
    if (f.closedPnl > 0) {
      wins += 1
      grossWin += f.closedPnl
    } else if (f.closedPnl < 0) {
      losses += 1
      grossLoss += -f.closedPnl
    }
    if (!best || f.closedPnl > best.closedPnl) best = f
    if (!worst || f.closedPnl < worst.closedPnl) worst = f
  }
  return {
    realisedPnl,
    feesUsdc,
    otherFeeFills,
    netPnl: realisedPnl - feesUsdc,
    volumeUsd,
    fills: fills.length,
    closed,
    wins,
    losses,
    winRate: wins + losses > 0 ? wins / (wins + losses) : null,
    avgWin: wins ? grossWin / wins : null,
    avgLoss: losses ? -grossLoss / losses : null,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
    best: best && best.closedPnl > 0 ? best : null,
    worst: worst && worst.closedPnl < 0 ? worst : null,
  }
}

/** Running realised P&L after each close, oldest first. */
export function pnlCurve(fills: HlFill[]): { t: number; pnl: number; fill: HlFill }[] {
  let run = 0
  return fills
    .filter(isClose)
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((f) => {
      run += f.closedPnl
      return { t: f.timestamp, pnl: run, fill: f }
    })
}

/** The latest `n` closes, oldest first, for the per-trade result bars. */
export function recentCloses(fills: HlFill[], n = 30): HlFill[] {
  return fills
    .filter(isClose)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-n)
}

export type MarketResult = { symbol: string; pnl: number; closed: number; wins: number; volumeUsd: number }

/** Realised P&L per market, biggest absolute result first. */
export function byMarket(fills: HlFill[], limit = 6): MarketResult[] {
  const map = new Map<string, MarketResult>()
  for (const f of fills) {
    const m = map.get(f.symbol) ?? { symbol: f.symbol, pnl: 0, closed: 0, wins: 0, volumeUsd: 0 }
    m.volumeUsd += Math.abs(f.price * f.size)
    if (isClose(f)) {
      m.closed += 1
      m.pnl += f.closedPnl
      if (f.closedPnl > 0) m.wins += 1
    }
    map.set(f.symbol, m)
  }
  return [...map.values()]
    .filter((m) => m.closed > 0)
    .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
    .slice(0, limit)
}

export type SideResult = { pnl: number; closed: number; wins: number; winRate: number | null }

/** Longs against shorts, from the fill's own direction. */
export function bySide(fills: HlFill[]): { long: SideResult; short: SideResult } {
  const side = (): SideResult => ({ pnl: 0, closed: 0, wins: 0, winRate: null })
  const out = { long: side(), short: side() }
  for (const f of fills) {
    if (!isClose(f)) continue
    const s = isLongSide(f) ? out.long : isShortSide(f) ? out.short : null
    if (!s) continue
    s.closed += 1
    s.pnl += f.closedPnl
    if (f.closedPnl > 0) s.wins += 1
  }
  for (const s of [out.long, out.short]) s.winRate = s.closed ? s.wins / s.closed : null
  return out
}

/* ── Protection: stop-loss and take-profit on what's open ────────────────── */

/** Trigger orders as the account route passes them through ("Stop Market",
 *  "Take Profit Market", and their Limit forms). */
export function triggerKind(o: HlOpenOrder): "tp" | "sl" | null {
  if (!o.isTrigger) return null
  if (/take\s*profit/i.test(o.orderType)) return "tp"
  if (/stop/i.test(o.orderType)) return "sl"
  return null
}

export type ProtectedPosition = {
  position: HlPosition
  stopLoss: number | null
  takeProfit: number | null
  /** How far the mark is from the stop, as a share of the mark. */
  stopDistance: number | null
}

/**
 * Each open position with the stop-loss and take-profit resting against it:
 * a trigger order on the same market, on the closing side.
 */
export function protection(positions: HlPosition[], orders: HlOpenOrder[]): ProtectedPosition[] {
  return positions.map((p) => {
    const closingSide = p.side === "long" ? "sell" : "buy"
    const against = orders.filter((o) => o.symbol === p.symbol && o.side === closingSide && o.triggerPrice != null)
    const pick = (k: "tp" | "sl") => {
      const prices = against.filter((o) => triggerKind(o) === k).map((o) => o.triggerPrice as number)
      if (!prices.length) return null
      // The nearest one to the mark is the one that fires first.
      return prices.reduce((a, b) => (Math.abs(b - p.markPrice) < Math.abs(a - p.markPrice) ? b : a))
    }
    const stopLoss = pick("sl")
    const takeProfit = pick("tp")
    return {
      position: p,
      stopLoss,
      takeProfit,
      stopDistance: stopLoss != null && p.markPrice > 0 ? Math.abs(p.markPrice - stopLoss) / p.markPrice : null,
    }
  })
}

/* ── Exits (sample data only, until the backend serves order history) ───── */

export type ExitCounts = Record<ExitReason, { count: number; pnl: number }>

export function exitCounts(exits: { reason: ExitReason; pnl: number }[]): ExitCounts {
  const out = Object.fromEntries((Object.keys(EXIT_LABELS) as ExitReason[]).map((k) => [k, { count: 0, pnl: 0 }])) as ExitCounts
  for (const e of exits) {
    out[e.reason].count += 1
    out[e.reason].pnl += e.pnl
  }
  return out
}

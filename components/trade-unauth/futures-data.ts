/**
 * Perpetuals data and margin maths for /trade-unauth.
 *
 * Built on the same pair list as spot, so BTC costs the same in both modes.
 * The live futures screen does not manage that either: its market rail lists
 * BTC twice and SOL twice, which is the same duplication the spot rail has.
 *
 * What the live futures ticket is missing — and what this file exists to
 * supply — is everything that makes leverage legible BEFORE you commit:
 * the margin the order consumes, the price that liquidates it, the funding
 * you pay to hold it, and the fee. Its ticket has a leverage slider and a
 * Take profit / Stop loss pair with no figures attached to any of them.
 */

import { PAIRS, formatCompact, formatPrice, type Market } from "@/components/trade-unauth/trade-data"

/* ── Perpetual contracts ────────────────────────────────────────────────── */

export type Perp = Market & {
  /** Highest leverage the venue allows on this contract. */
  maxLeverage: number
  /** 8-hour funding rate, as a percent. Positive = longs pay shorts. */
  fundingPct: number
  /** Minutes until the next funding stamp. Fixed, not a live clock. */
  fundingInMinutes: number
  openInterestUsd: number
  /** Mark price — what liquidations are measured against, not the last trade. */
  markPrice: number
}

const LEVERAGE: Record<string, number> = {
  BTC: 40,
  ETH: 25,
  SOL: 20,
  XRP: 20,
  ARB: 10,
  TON: 10,
  AVAX: 10,
  LINK: 10,
  DOGE: 10,
  ATOM: 5,
  SEI: 5,
  APT: 5,
  OP: 10,
  INJ: 10,
  SUI: 10,
  TIA: 5,
  NEAR: 10,
  ADA: 20,
  DOT: 10,
  TRX: 10,
  MATIC: 20,
  LTC: 10,
}

/**
 * Perps quote in USD, and only the liquid majors list. One entry per asset —
 * the live rail shows BTC and SOL twice each.
 */
export const PERPS: Perp[] = [...new Map(PAIRS.filter((p) => p.quote === "USDT").map((p) => [p.base, p])).values()]
  .filter((p) => LEVERAGE[p.base] !== undefined)
  .map((p, i) => {
    // Funding follows the trend: a contract that has run up pays longs less.
    const fundingPct = Number(((p.changePct / 100) * 0.9 + (i % 3 === 0 ? -0.004 : 0.006)).toFixed(4))
    return {
      ...p,
      id: `${p.base}-PERP`,
      quote: "USDT" as const,
      maxLeverage: LEVERAGE[p.base],
      fundingPct,
      // Deterministic: derived from the asset, never from a clock.
      fundingInMinutes: 37 + ((p.base.charCodeAt(0) * 7) % 180),
      openInterestUsd: p.volumeUsd * 0.42,
      // Mark sits a hair off last — that gap is the whole reason perps quote
      // both, and the live screen shows only one number.
      markPrice: p.price * (1 + (i % 2 === 0 ? 0.00018 : -0.00012)),
    }
  })

export const DEFAULT_PERP = PERPS.find((p) => p.base === "BTC") ?? PERPS[0]

export function perpById(id: string): Perp {
  return PERPS.find((p) => p.id === id) ?? DEFAULT_PERP
}

/* ── Margin maths ───────────────────────────────────────────────────────── */

/** Maintenance margin. Below this fraction of notional, you are liquidated. */
export const MAINTENANCE_MARGIN_RATE = 0.005
export const TAKER_FEE = 0.0005

export type MarginMode = "cross" | "isolated"

export type PositionQuote = {
  /** Notional exposure in USD. */
  notional: number
  /** Margin the order actually consumes. */
  margin: number
  /** Contracts / base units. */
  size: number
  fee: number
  /** The price at which the position is closed out. */
  liquidationPrice: number
  /** Funding paid (or earned) per 8h at the current rate. */
  fundingPer8h: number
}

/**
 * The numbers the live ticket never shows. Liquidation is the important one:
 * at 40× a 2.5% move against you ends the position, and a leverage slider
 * that does not say so is a slider that hides the only thing it controls.
 */
export function quotePosition({
  perp,
  side,
  margin,
  leverage,
  entryPrice,
}: {
  perp: Perp
  side: "long" | "short"
  /** USD the trader is putting up. */
  margin: number
  leverage: number
  entryPrice?: number
}): PositionQuote {
  const entry = entryPrice ?? perp.markPrice
  const notional = margin * leverage
  const size = entry > 0 ? notional / entry : 0

  // Isolated-margin liquidation: the point where losses eat the margin down
  // to the maintenance floor.
  const drop = 1 / leverage - MAINTENANCE_MARGIN_RATE
  const liquidationPrice = side === "long" ? entry * (1 - drop) : entry * (1 + drop)

  return {
    notional,
    margin,
    size,
    fee: notional * TAKER_FEE,
    liquidationPrice: Math.max(0, liquidationPrice),
    fundingPer8h: notional * (perp.fundingPct / 100) * (side === "long" ? -1 : 1),
  }
}

/* ── Open positions ─────────────────────────────────────────────────────── */

export type Position = {
  id: string
  perpId: string
  side: "long" | "short"
  leverage: number
  mode: MarginMode
  /** Base units held. */
  size: number
  entry: number
  margin: number
  liquidation: number
  takeProfit?: number
  stopLoss?: number
}

export const POSITIONS: Position[] = [
  { id: "p1", perpId: "BTC-PERP", side: "long", leverage: 10, mode: "cross", size: 0.1, entry: 92180, margin: 921.8, liquidation: 83424, takeProfit: 104000, stopLoss: 88000 },
  { id: "p2", perpId: "ETH-PERP", side: "long", leverage: 5, mode: "isolated", size: 1.5, entry: 3198.4, margin: 959.52, liquidation: 2574.7 },
  { id: "p3", perpId: "SOL-PERP", side: "short", leverage: 3, mode: "isolated", size: 15, entry: 178.9, margin: 894.5, liquidation: 237.9, stopLoss: 195 },
]

/** Unrealised PnL and the margin health that follows from it. */
export function positionState(p: Position, mark: number) {
  const dir = p.side === "long" ? 1 : -1
  const pnl = (mark - p.entry) * p.size * dir
  const notional = p.size * mark
  const roe = p.margin > 0 ? (pnl / p.margin) * 100 : 0
  // How close the mark has crept to the liquidation price, 0–100.
  const span = Math.abs(p.entry - p.liquidation) || 1
  const travelled = Math.abs(mark - p.entry)
  const risk = p.side === "long" && mark < p.entry ? (travelled / span) * 100 : p.side === "short" && mark > p.entry ? (travelled / span) * 100 : 0
  return { pnl, roe, notional, risk: Math.min(100, risk) }
}

export const FUTURES_EQUITY = {
  balance: 12960.08,
  available: 10184.26,
  /** Margin currently locked by the open positions above. */
  used: 2775.82,
}

export { formatPrice, formatCompact }

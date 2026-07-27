"use client"

/**
 * Legacy-shaped wrapper over useTradeAccount. The old hook polled
 * /api/hyperliquid/positions and exposed Hyperliquid's raw string fields;
 * this keeps that shape while sourcing from /api/trade/account.
 */
import { useTradeAccount } from "./useTradeAccount"

export interface HyperliquidPosition {
  coin: string
  szi: string
  entryPx: string
  positionValue: string
  unrealizedPnl: string
  returnOnEquity: string
  liquidationPx: string | null
  leverage: { type: string; value: number } | null
  marginUsed: string
}

export function useHyperliquidPositions() {
  const { positions, futuresUsd, isLoading, error, refetch } = useTradeAccount(10_000)

  const mapped: HyperliquidPosition[] = positions.map((p) => ({
    coin: p.symbol,
    szi: String(p.size),
    entryPx: String(p.entryPrice),
    positionValue: String(p.notionalUsd),
    unrealizedPnl: String(p.unrealizedPnl),
    returnOnEquity: String(p.returnOnEquity),
    liquidationPx: p.liquidationPrice === null ? null : String(p.liquidationPrice),
    leverage: p.leverage,
    marginUsed: String(p.marginUsed),
  }))

  return { positions: mapped, futuresUsd, loading: isLoading, error, refetch }
}

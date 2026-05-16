// GMX v2 data fetching and order building
import { gmxSdk } from "./sdk"
import type { GmxMarket, GmxCandle, GmxPosition, GmxOrderParams } from "./types"

// ── Markets ──────────────────────────────────────────────────────────────

export async function getGmxMarkets(): Promise<GmxMarket[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const marketsInfo = await (gmxSdk.markets as any).fetchMarketsInfo()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return marketsInfo.map((m: any) => ({
    marketTokenAddress: m.marketTokenAddress,
    indexTokenAddress: m.indexTokenAddress,
    longTokenAddress: m.longTokenAddress,
    shortTokenAddress: m.shortTokenAddress,
    indexPrice: Number(m.indexTokenPrice?.min ?? m.indexPrice ?? 0),
    name: m.name,
    indexTokenSymbol: m.indexTokenSymbol,
  }))
}

// ── Candles ──────────────────────────────────────────────────────────────

export async function getGmxCandles(
  marketToken: string,
  interval: string,
  startTimestamp: number,
  endTimestamp: number,
): Promise<GmxCandle[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candles = await (gmxSdk.markets as any).fetchCandles({
    marketTokenAddress: marketToken,
    interval,
    startTimestamp,
    endTimestamp,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return candles.map((c: any) => ({
    timestamp: c.timestamp ?? c.time,
    open: Number(c.open),
    high: Number(c.high),
    low: Number(c.low),
    close: Number(c.close),
    volume: Number(c.volume ?? 0),
  }))
}

// ── Positions ────────────────────────────────────────────────────────────

export async function getGmxPositions(account: string): Promise<GmxPosition[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const positions = await (gmxSdk.positions as any).fetchPositionsInfo({
    account,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return positions.map((p: any) => ({
    key: p.key,
    account: p.account,
    marketTokenAddress: p.marketTokenAddress,
    indexTokenAddress: p.indexTokenAddress,
    isLong: p.isLong,
    sizeInUsd: p.sizeInUsd,
    sizeInTokens: p.sizeInTokens,
    collateralAmount: p.collateralAmount,
    collateralTokenAddress: p.collateralTokenAddress,
    averageEntryPrice: p.averageEntryPrice ?? p.entryPrice,
    liquidationPrice: p.liquidationPrice,
    pnl: p.pnl ?? p.netPnl,
    pendingPnl: p.pendingPnl ?? BigInt(0),
    leverage: Number(p.leverage ?? 0),
    unrealizedPnl: p.unrealizedPnl ? Number(p.unrealizedPnl) : undefined,
    returnOnEquity: p.returnOnEquity ? Number(p.returnOnEquity) : undefined,
  }))
}

// ── Order Building ───────────────────────────────────────────────────────

export async function buildGmxOrder(params: GmxOrderParams) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const order = await (gmxSdk.orders as any).createOrder({
    marketTokenAddress: params.marketTokenAddress,
    isLong: params.isLong,
    sizeDeltaUsd: params.sizeDeltaUsd,
    collateralDeltaAmount: params.collateralDeltaAmount,
    account: params.account,
    acceptablePrice: params.acceptablePrice,
    triggerPrice: params.triggerPrice,
    orderType: params.orderType ?? "market",
  })

  return order
}

// ── Order Submission (Gasless Relay) ─────────────────────────────────────

export async function submitGmxOrder(order: unknown, signature: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (gmxSdk.orders as any).submitOrder({
    ...(order as Record<string, unknown>),
    signature,
  })

  return {
    txHash: result.txHash ?? result.hash,
    orderKey: result.orderKey,
  }
}

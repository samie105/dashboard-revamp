// GMX v2 shared types

export interface GmxMarket {
  /** GMX market token address (primary identifier) */
  marketTokenAddress: string
  /** Index token address (e.g., ETH, BTC) */
  indexTokenAddress: string
  /** Collateral token for long positions */
  longTokenAddress: string
  /** Collateral token for short positions */
  shortTokenAddress: string
  /** Current index price */
  indexPrice: number
  /** Human-readable name */
  name?: string
  /** Index token symbol (e.g., "ETH", "BTC") */
  indexTokenSymbol?: string
}

export interface GmxCandle {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface GmxPosition {
  key: string
  account: string
  marketTokenAddress: string
  indexTokenAddress: string
  isLong: boolean
  sizeInUsd: bigint
  sizeInTokens: bigint
  collateralAmount: bigint
  collateralTokenAddress: string
  averageEntryPrice: bigint
  liquidationPrice: bigint
  pnl: bigint
  pendingPnl: bigint
  leverage: number
  unrealizedPnl?: number
  returnOnEquity?: number
}

export interface GmxOrderParams {
  marketTokenAddress: string
  isLong: boolean
  sizeDeltaUsd: bigint
  collateralDeltaAmount: bigint
  account: string
  acceptablePrice?: bigint
  triggerPrice?: bigint
  orderType?: "market" | "limit" | "stopLoss" | "takeProfit"
}

export interface GmxOrderResult {
  txHash: string
  orderKey?: string
}

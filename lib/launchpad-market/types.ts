/**
 * The launchpad's market data contract: what the board, the token page and
 * "your launches" read beyond the backend's LaunchpadToken.
 *
 * The backend serves the launch list, one launch, its curve, quotes, trades
 * and creation (lib/crypto-backend). It does NOT yet serve price history,
 * rolling-window stats, a trade feed, holders or a viewer's positions. Those
 * shapes are defined here so the UI can be built against them; until the
 * backend has them, lib/launchpad-market/source.ts answers "not available"
 * (production) or serves the dev-only mock (lib/launchpad-market/mock.ts).
 */

import type { LaunchpadCurve, LaunchpadFeedFilter, LaunchpadNetworkId, LaunchpadToken } from "@/lib/crypto-backend/types"

/** Rolling windows for change, volume and trade counts (pump.fun / DEX-screener style). */
export const MARKET_WINDOWS = ["5m", "1h", "6h", "24h"] as const
export type MarketWindow = (typeof MARKET_WINDOWS)[number]

/** How much history the price chart shows. */
export const CHART_RANGES = ["1h", "6h", "24h", "7d", "all"] as const
export type ChartRange = (typeof CHART_RANGES)[number]

/** One launch's market, per rolling window. Prices in SOL; USD where the backend values it. */
export type LaunchMarketStats = {
  launchId: string
  priceSol: number
  priceUsd: number | null
  marketCapUsd: number | null
  holders: number
  /** Price change over each window, in percent; null when the token is younger than the window. */
  changePct: Record<MarketWindow, number | null>
  volumeUsd: Record<MarketWindow, number>
  txns: Record<MarketWindow, { buys: number; sells: number }>
  /** Price across each window, oldest first (for mini charts). */
  spark: Record<MarketWindow, number[]>
}

/** One candle. Prices in SOL per token; volume in SOL. `t` = bucket start, ms. */
export type Candle = { t: number; o: number; h: number; l: number; c: number; v: number }

export type LaunchTrade = {
  id: string
  at: string
  side: "buy" | "sell"
  /** Shortened address, or "You" for the viewer. */
  traderLabel: string
  traderIsCreator: boolean
  solAmount: number
  tokenAmount: number
  priceSol: number
  txHash: string | null
}

export type LaunchHolder = {
  /** Shortened address, or a role name ("Bonding curve"). */
  label: string
  /** Share of supply, 0–100. */
  pct: number
  kind: "curve" | "creator" | "holder" | "you"
}

export type LaunchHolding = { launchId: string; tokens: number; valueSol: number; pnlPct: number | null }

export type LaunchPortfolio = { launchedIds: string[]; holdings: LaunchHolding[] }

/** One launch as the token page needs it: the launch plus the fee and decimals its ticket uses. */
export type LaunchDetail = { token: LaunchpadToken; platformFeeBps: number; tokenDecimals: number }

export type LaunchNetworks = { networks: Array<{ networkId: LaunchpadNetworkId; label: string }>; defaultNetworkId: LaunchpadNetworkId }

export type MarketRequest = { signal?: AbortSignal }

/** What the launchpad screens read through. One implementation is live at a time (source.ts). */
export interface LaunchpadMarketSource {
  /** True while every figure is invented (screens label themselves "Demo data"). */
  readonly isMock: boolean
  networks(o?: MarketRequest): Promise<LaunchNetworks>
  feed(networkId: LaunchpadNetworkId, filter: LaunchpadFeedFilter, o?: MarketRequest): Promise<LaunchpadToken[]>
  token(launchId: string, o?: MarketRequest): Promise<LaunchDetail>
  curve(launchId: string, o?: MarketRequest): Promise<LaunchpadCurve>
  /** Market stats for every launch on a network, keyed by launchId. */
  stats(networkId: LaunchpadNetworkId, o?: MarketRequest): Promise<Record<string, LaunchMarketStats>>
  candles(launchId: string, range: ChartRange, o?: MarketRequest): Promise<Candle[]>
  trades(launchId: string, o?: MarketRequest): Promise<LaunchTrade[]>
  holders(launchId: string, o?: MarketRequest): Promise<LaunchHolder[]>
  portfolio(networkId: LaunchpadNetworkId, o?: MarketRequest): Promise<LaunchPortfolio>
}

/** A figure the backend doesn't serve yet. Screens show "coming soon", never a guess. */
export class MarketUnavailableError extends Error {
  constructor(what: string) {
    super(`${what} isn't available yet`)
    this.name = "MarketUnavailableError"
  }
}

export const isMarketUnavailable = (error: unknown): error is MarketUnavailableError => error instanceof MarketUnavailableError

import type { CoinData, TradeResult, OrderBookLevel } from "@/lib/actions"

export interface SpotClientProps {
  coins: CoinData[]
  prices: Record<string, number>
  globalStats: {
    totalMarketCap: number
    totalVolume: number
    btcDominance: number
    marketCapChange24h: number
  }
  initialTrades: Record<string, TradeResult[]>
  initialOrderBook?: { asks: OrderBookLevel[]; bids: OrderBookLevel[] }
  error?: string
}

export type OrderType = "market" | "limit" | "stop-limit"
export type MobileTab = "chart" | "book" | "market"

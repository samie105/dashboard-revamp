"use client"

/**
 * Legacy-shaped wrapper over useTradeAccount (GET /api/trade/account on the
 * crypto service). Keeps the interface the dashboard surfaces were built
 * against while the data now comes from the same source as the mobile app.
 */
import { useTradeAccount } from "./useTradeAccount"

interface HyperliquidBalance {
  coin: string
  total: number
  available: number
  hold: number
  entryNtl: number
  entryPrice: number
  currentPrice: number
  currentValue: number
  unrealizedPnl: number
  unrealizedPnlPercent: number
}

interface UseHyperliquidBalanceResult {
  balances: HyperliquidBalance[]
  usdcBalance: { total: number; available: number; hold: number }
  accountValue: number
  withdrawable: number
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useHyperliquidBalance(
  _userId?: string,
  _enabled = true,
): UseHyperliquidBalanceResult {
  const { balances, isLoading, error, refetch } = useTradeAccount()

  const spotTokens = balances?.spotTokens ?? []
  const spotUsdc = balances?.spotUsdc ?? 0
  const spotUsdcHold = balances?.spotUsdcHold ?? 0

  return {
    balances: spotTokens.map((t) => ({
      coin: t.symbol,
      total: t.total,
      available: t.available,
      hold: t.hold,
      // Cost-basis fields aren't served by /api/trade/account (mobile doesn't
      // show them either) — zeros keep the legacy shape without inventing data.
      entryNtl: 0,
      entryPrice: 0,
      currentPrice: 0,
      currentValue: 0,
      unrealizedPnl: 0,
      unrealizedPnlPercent: 0,
    })),
    usdcBalance: {
      total: spotUsdc + spotUsdcHold,
      available: spotUsdc,
      hold: spotUsdcHold,
    },
    accountValue: balances?.perpsAccountValueUsdc ?? 0,
    withdrawable: balances?.perpsWithdrawableUsdc ?? 0,
    loading: isLoading,
    error,
    refetch,
  }
}

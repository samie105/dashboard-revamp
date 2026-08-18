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
  entryNtl: number | null
  /** null = not served by the account endpoint, which is different from zero.
   *  These were zeros, and the UI dutifully rendered "Entry Price $0.00" and
   *  "+0.00%" beside a real balance — a claim that the user paid nothing and
   *  has made nothing. null forces every reader to decide what to show. */
  entryPrice: number | null
  currentPrice: number | null
  currentValue: number | null
  unrealizedPnl: number | null
  unrealizedPnlPercent: number | null
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
      /* Cost basis isn't served by /api/trade/account (mobile doesn't show it
         either). It used to be filled with zeros to "keep the legacy shape
         without inventing data" — but a zero IS invented data once something
         renders it as a dollar figure. null says what's true: unknown. */
      entryNtl: null,
      entryPrice: null,
      currentPrice: null,
      currentValue: null,
      unrealizedPnl: null,
      unrealizedPnlPercent: null,
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

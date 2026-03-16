import { useState, useEffect, useCallback, useRef } from "react"
import { useWallet } from "@/components/wallet-provider"

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
  usdcBalance: {
    total: number
    available: number
    hold: number
  }
  accountValue: number
  withdrawable: number
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useHyperliquidBalance(
  userId?: string,
  enabled = true,
): UseHyperliquidBalanceResult {
  const { walletsGenerated, addresses, isLoading: walletsLoading } = useWallet()
  const [balances, setBalances] = useState<HyperliquidBalance[]>([])
  const [usdcBalance, setUsdcBalance] = useState({
    total: 0,
    available: 0,
    hold: 0,
  })
  const [accountValue, setAccountValue] = useState(0)
  const [withdrawable, setWithdrawable] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasFetched = useRef(false)

  const fetchBalance = useCallback(async () => {
    if (
      !enabled ||
      !userId ||
      !walletsGenerated ||
      !addresses?.ethereum
    ) {
      if (!userId || !enabled) {
        setLoading(false)
      }
      return
    }

    try {
      // Only show loading spinner for the first fetch, not refreshes
      if (!hasFetched.current) setLoading(true)
      setError(null)

      const response = await fetch(`/api/hyperliquid/balance`)

      if (response.status === 404) {
        setLoading(false)
        return
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch balance")
      }

      setBalances(data.data.balances)
      setUsdcBalance(data.data.usdcBalance)
      setAccountValue(data.data.accountValue)
      setWithdrawable(data.data.withdrawable)
      hasFetched.current = true
    } catch (err: any) {
      console.error("Failed to fetch Hyperliquid balance:", err)
      setError(err.message || "Failed to fetch balance")
    } finally {
      setLoading(false)
    }
  }, [userId, enabled, walletsGenerated, addresses])

  useEffect(() => {
    fetchBalance()
    const interval = setInterval(fetchBalance, 15_000)
    return () => clearInterval(interval)
  }, [fetchBalance])

  return {
    balances,
    usdcBalance,
    accountValue,
    withdrawable,
    loading: !hasFetched.current && (loading || walletsLoading),
    error,
    refetch: fetchBalance,
  }
}

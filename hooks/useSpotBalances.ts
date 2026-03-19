import { useState, useEffect, useCallback } from "react"
import { useHlWs } from "./useHyperliquidWs"

export interface UseSpotBalancesReturn {
  baseBalance: number
  quoteBalance: number
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useSpotBalances(
  baseAsset: string,
  quoteAsset: string,
): UseSpotBalancesReturn {
  const [baseBalance, setBaseBalance] = useState<number>(0)
  const [quoteBalance, setQuoteBalance] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const { connected } = useHlWs()

  const fetchBalances = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch("/api/hyperliquid/balance")
      const data = await response.json()

      if (data.success) {
        if (data.data.balances) {
          const balances = data.data.balances

          const base = balances.find((b: any) => b.coin === baseAsset)
          setBaseBalance(base ? base.available : 0)

          const quoteSpot = balances.find(
            (b: any) =>
              b.coin === "USDC" ||
              (quoteAsset !== "USD" && b.coin === quoteAsset),
          )
          setQuoteBalance(quoteSpot ? quoteSpot.available : 0)
        } else {
          setBaseBalance(0)
          setQuoteBalance(0)
        }
      } else {
        setBaseBalance(0)
        setQuoteBalance(0)
      }
    } catch (err) {
      console.error("Error fetching balances:", err)
      setError(
        err instanceof Error ? err.message : "Failed to fetch balances",
      )
    } finally {
      setLoading(false)
    }
  }, [baseAsset, quoteAsset])

  useEffect(() => {
    fetchBalances()
    // Reduced poll: 30s fallback (WS openOrders channel triggers refetches indirectly)
    const interval = setInterval(fetchBalances, 30_000)
    return () => clearInterval(interval)
  }, [fetchBalances])

  return {
    baseBalance,
    quoteBalance,
    loading,
    error,
    refetch: fetchBalances,
  }
}

import { useState, useEffect, useCallback } from "react"

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
  const [positions, setPositions] = useState<HyperliquidPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPositions = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch("/api/hyperliquid/positions")
      const data = await res.json()
      if (data.success) {
        setPositions(data.data || [])
      } else {
        setPositions([])
      }
    } catch {
      setError("Failed to fetch positions")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPositions()
    const interval = setInterval(fetchPositions, 10_000)
    return () => clearInterval(interval)
  }, [fetchPositions])

  return { positions, loading, error, refetch: fetchPositions }
}

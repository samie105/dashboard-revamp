import { useState, useEffect, useCallback } from "react"

export interface UserFill {
  coin: string
  coinDisplay: string
  px: string
  sz: string
  side: "B" | "A"
  time: number
  startPosition: string
  dir: string
  closedPnl: string
  hash: string
  oid: number
  crossed: boolean
  fee: string
  tid: number
  feeToken: string
}

export function useUserFills(pollInterval = 15_000) {
  const [fills, setFills] = useState<UserFill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchFills = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch("/api/hyperliquid/fills")
      const data = await res.json()

      if (data.success) {
        setFills(data.data || [])
      } else {
        setFills([])
      }
    } catch {
      setError("Failed to fetch trade history")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFills()
    const interval = setInterval(fetchFills, pollInterval)
    return () => clearInterval(interval)
  }, [fetchFills, pollInterval])

  return { fills, loading, error, refetch: fetchFills }
}

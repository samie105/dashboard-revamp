import { useState, useEffect, useCallback, useRef } from "react"
import { useHlWs } from "./useHyperliquidWs"

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
  const hasFetched = useRef(false)
  const { userFills: wsFills, connected } = useHlWs()

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
      hasFetched.current = true
    }
  }, [])

  // Prepend new WS fills to existing list (WS fills lack coinDisplay enrichment)
  useEffect(() => {
    if (!connected || !hasFetched.current || wsFills.length === 0) return
    setFills((prev) => {
      const existingTids = new Set(prev.map((f) => f.tid))
      const newFills = (wsFills as UserFill[]).filter((f) => !existingTids.has(f.tid))
      if (newFills.length === 0) return prev
      return [...newFills, ...prev].slice(0, 200)
    })
  }, [wsFills, connected])

  useEffect(() => {
    fetchFills()
    // Reduced polling: 60s fallback for enriched data (coinDisplay)
    const interval = setInterval(fetchFills, 60_000)
    return () => clearInterval(interval)
  }, [fetchFills])

  return { fills, loading, error, refetch: fetchFills }
}

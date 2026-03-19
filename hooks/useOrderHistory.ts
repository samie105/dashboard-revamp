import { useState, useEffect, useCallback } from "react"

export interface HistoricalOrder {
  order: {
    coin: string
    coinDisplay: string
    side: "B" | "A"
    limitPx: string
    sz: string
    oid: number
    timestamp: number
    orderType: string
    origSz: string
    tif: string | null
    reduceOnly: boolean
  }
  status:
    | "filled"
    | "open"
    | "canceled"
    | "triggered"
    | "rejected"
    | "marginCanceled"
  statusTimestamp: number
}

export function useOrderHistory(pollInterval = 30_000) {
  const [orders, setOrders] = useState<HistoricalOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch("/api/hyperliquid/order-history")
      const data = await res.json()

      if (data.success) {
        setOrders(data.data || [])
      } else {
        setOrders([])
      }
    } catch {
      setError("Failed to fetch order history")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
    // Reduced from 30s → 60s; orderUpdates via WS cover real-time needs
    const interval = setInterval(fetchOrders, 60_000)
    return () => clearInterval(interval)
  }, [fetchOrders])

  return { orders, loading, error, refetch: fetchOrders }
}

import { useState, useEffect, useCallback, useRef } from "react"
import { useHlWs } from "./useHyperliquidWs"

export interface OpenOrder {
  coin: string
  side: "B" | "A"
  limitPx: string
  sz: string
  oid: number
  timestamp: number
  origSz: string
  orderType: string
  tif: string | null
  reduceOnly: boolean
}

export function useOpenOrders() {
  const [orders, setOrders] = useState<OpenOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<number | null>(null)
  const hasFetched = useRef(false)
  const { openOrders: wsOrders, connected } = useHlWs()

  const fetchOrders = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch("/api/hyperliquid/open-orders")
      const data = await res.json()

      if (data.success) {
        setOrders(data.data || [])
      } else {
        setOrders([])
      }
    } catch {
      setError("Failed to fetch open orders")
    } finally {
      setLoading(false)
      hasFetched.current = true
    }
  }, [])

  // Overlay WS open orders once initial fetch is done
  useEffect(() => {
    if (connected && hasFetched.current && wsOrders.length > 0) {
      setOrders(wsOrders as OpenOrder[])
    }
  }, [wsOrders, connected])

  const cancelOrder = useCallback(
    async (coin: string, orderId: number) => {
      setCancellingId(orderId)
      try {
        const res = await fetch("/api/hyperliquid/cancel-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coin, orderId }),
        })

        const data = await res.json()

        if (!res.ok || !data.success) {
          throw new Error(data.error || "Cancel failed")
        }

        setOrders((prev) => prev.filter((o) => o.oid !== orderId))
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : "Cancel failed")
        return false
      } finally {
        setCancellingId(null)
      }
    },
    [],
  )

  const cancelAll = useCallback(async () => {
    await Promise.allSettled(
      orders.map((o) => cancelOrder(o.coin, o.oid)),
    )
    await fetchOrders()
  }, [orders, cancelOrder, fetchOrders])

  useEffect(() => {
    fetchOrders()
    // Fallback poll at 30s (only if WS disconnects)
    const interval = setInterval(() => {
      if (!connected) fetchOrders()
    }, 30_000)
    return () => clearInterval(interval)
  }, [fetchOrders, connected])

  return {
    orders,
    loading,
    error,
    cancellingId,
    cancelOrder,
    cancelAll,
    refetch: fetchOrders,
  }
}

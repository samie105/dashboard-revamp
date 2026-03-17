/**
 * Order Monitor Hook — Monitors pending limit orders for TP/SL placement
 * and implements client-side OCO (One-Cancels-Other) for linked TP/SL pairs.
 *
 * Usage:
 *   1. Call trackOrder() when a limit order with TP/SL rests (resting response).
 *   2. The hook polls open orders and detects when tracked orders fill.
 *   3. On fill, it auto-places TP and SL as stop-limit orders.
 *   4. Tracks the resulting TP/SL pair — when one fills, cancels the other.
 */

import { useState, useEffect, useCallback, useRef } from "react"

export interface PendingTPSL {
  orderId: number
  asset: string
  side: "buy" | "sell"
  size: number
  tp?: number
  sl?: number
}

export interface LinkedPair {
  tpOrderId: number
  slOrderId: number
  coin: string
}

export interface OrderMonitorReturn {
  trackOrder: (config: PendingTPSL) => void
  addLinkedPair: (pair: LinkedPair) => void
  trackedCount: number
  linkedCount: number
  notifications: string[]
  clearNotifications: () => void
}

export function useOrderMonitor(): OrderMonitorReturn {
  const pendingRef = useRef<Map<number, PendingTPSL>>(new Map())
  const linkedRef = useRef<Map<string, LinkedPair>>(new Map())
  const prevOpenIdsRef = useRef<Set<number>>(new Set())
  const [trackedCount, setTrackedCount] = useState(0)
  const [linkedCount, setLinkedCount] = useState(0)
  const [notifications, setNotifications] = useState<string[]>([])

  const clearNotifications = useCallback(() => setNotifications([]), [])

  const addNotification = useCallback((msg: string) => {
    setNotifications((prev) => [...prev, msg])
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n !== msg))
    }, 10000)
  }, [])

  const trackOrder = useCallback((config: PendingTPSL) => {
    pendingRef.current.set(config.orderId, config)
    setTrackedCount(pendingRef.current.size)
  }, [])

  const addLinkedPair = useCallback((pair: LinkedPair) => {
    const key = `${pair.tpOrderId}-${pair.slOrderId}`
    linkedRef.current.set(key, pair)
    setLinkedCount(linkedRef.current.size)
  }, [])

  const placeStopLimit = useCallback(
    async (
      asset: string,
      side: string,
      size: number,
      triggerPrice: number,
      reduceOnly: boolean
    ): Promise<{ success: boolean; orderId?: number; error?: string }> => {
      try {
        const res = await fetch("/api/hyperliquid/order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            asset,
            side,
            amount: size,
            price: triggerPrice,
            orderType: "stop-limit",
            isSpot: true,
            stopPrice: triggerPrice,
            reduceOnly,
          }),
        })
        const data = await res.json()
        if (data.success) {
          const resting = data.data?.response?.data?.statuses?.[0]?.resting
          return { success: true, orderId: resting?.oid }
        }
        return { success: false, error: data.error }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Failed" }
      }
    },
    []
  )

  const cancelOrder = useCallback(async (coin: string, orderId: number) => {
    try {
      await fetch("/api/hyperliquid/cancel-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coin, orderId }),
      })
    } catch (err) {
      console.error("[useOrderMonitor] Failed to cancel order:", err)
    }
  }, [])

  useEffect(() => {
    if (pendingRef.current.size === 0 && linkedRef.current.size === 0) return

    const poll = async () => {
      try {
        const res = await fetch("/api/hyperliquid/open-orders")
        const data = await res.json()
        if (!data.success) return

        const currentIds = new Set<number>(
          (data.data || []).map((o: { oid: number }) => o.oid)
        )

        // 1. Check pending limit orders for fills → place TP/SL
        for (const [orderId, config] of pendingRef.current) {
          if (prevOpenIdsRef.current.has(orderId) && !currentIds.has(orderId)) {
            pendingRef.current.delete(orderId)
            setTrackedCount(pendingRef.current.size)

            const oppositeSide = config.side === "buy" ? "sell" : "buy"
            let tpOid: number | undefined
            let slOid: number | undefined

            if (config.tp) {
              const tpResult = await placeStopLimit(config.asset, oppositeSide, config.size, config.tp, true)
              if (tpResult.success) {
                tpOid = tpResult.orderId
                addNotification(`Limit order filled → TP placed at $${config.tp}`)
              } else {
                addNotification(`Limit order filled → TP failed: ${tpResult.error}`)
              }
            }
            if (config.sl) {
              const slResult = await placeStopLimit(config.asset, oppositeSide, config.size, config.sl, true)
              if (slResult.success) {
                slOid = slResult.orderId
                addNotification(`Limit order filled → SL placed at $${config.sl}`)
              } else {
                addNotification(`Limit order filled → SL failed: ${slResult.error}`)
              }
            }

            if (tpOid && slOid) {
              addLinkedPair({ tpOrderId: tpOid, slOrderId: slOid, coin: config.asset })
            }
          }
        }

        // 2. OCO: check linked pairs — when one fills, cancel the other
        for (const [key, pair] of linkedRef.current) {
          const tpGone = !currentIds.has(pair.tpOrderId)
          const slGone = !currentIds.has(pair.slOrderId)

          if (tpGone && !slGone && prevOpenIdsRef.current.has(pair.tpOrderId)) {
            await cancelOrder(pair.coin, pair.slOrderId)
            linkedRef.current.delete(key)
            setLinkedCount(linkedRef.current.size)
            addNotification("Take Profit hit — Stop Loss cancelled")
          } else if (slGone && !tpGone && prevOpenIdsRef.current.has(pair.slOrderId)) {
            await cancelOrder(pair.coin, pair.tpOrderId)
            linkedRef.current.delete(key)
            setLinkedCount(linkedRef.current.size)
            addNotification("Stop Loss hit — Take Profit cancelled")
          } else if (tpGone && slGone) {
            linkedRef.current.delete(key)
            setLinkedCount(linkedRef.current.size)
          }
        }

        prevOpenIdsRef.current = currentIds
      } catch (err) {
        console.error("[useOrderMonitor] Poll error:", err)
      }
    }

    poll()
    const interval = setInterval(poll, 10000)
    return () => clearInterval(interval)
  }, [trackedCount, linkedCount, placeStopLimit, cancelOrder, addLinkedPair, addNotification])

  return {
    trackOrder,
    addLinkedPair,
    trackedCount,
    linkedCount,
    notifications,
    clearNotifications,
  }
}

"use client"

import { useEffect, useRef, useState, useCallback } from "react"

// ── Types (same contract as before) ──────────────────────────────────────

export interface OrderBookLevel {
  price: number
  amount: number
  total: number
}

export interface TradeTick {
  id: number
  price: number
  qty: number
  time: number
  isBuyerMaker: boolean
}

export interface MarketDataState {
  bids: OrderBookLevel[]
  asks: OrderBookLevel[]
  trades: TradeTick[]
  connected: boolean
  unavailable: boolean
}

// ── Constants ────────────────────────────────────────────────────────────

const POLL_INTERVAL = 2_000
const MAX_FAILURES = 5

// ── Hook ─────────────────────────────────────────────────────────────────

/**
 * Polls `/api/spotv2/stream?symbol=...` every 2 seconds for order-book +
 * recent trades. Reliable on Vercel — no WebSocket or SSE required.
 */
export function useMarketDataSSE(symbol: string | undefined): MarketDataState {
  const [state, setState] = useState<MarketDataState>({
    bids: [],
    asks: [],
    trades: [],
    connected: false,
    unavailable: false,
  })

  const failureCount = useRef(0)
  const mountedRef = useRef(true)

  const fetchData = useCallback(async (sym: string) => {
    if (!mountedRef.current) return

    try {
      const res = await fetch(`/api/spotv2/stream?symbol=${encodeURIComponent(sym)}`)
      if (!mountedRef.current) return

      if (!res.ok) {
        failureCount.current++
        if (failureCount.current >= MAX_FAILURES) {
          setState((prev) => ({ ...prev, connected: false, unavailable: true }))
        }
        return
      }

      const data = await res.json()
      failureCount.current = 0

      let bidTotal = 0
      const bids: OrderBookLevel[] = (data.bids ?? []).map(
        ([p, a]: [number, number]) => {
          bidTotal += a
          return { price: p, amount: a, total: bidTotal }
        },
      )

      let askTotal = 0
      const asks: OrderBookLevel[] = (data.asks ?? []).map(
        ([p, a]: [number, number]) => {
          askTotal += a
          return { price: p, amount: a, total: askTotal }
        },
      )

      const trades: TradeTick[] = (data.trades ?? []).map(
        (t: { id: number; price: number; qty: number; time: number; isBuyerMaker: boolean }) => ({
          id: t.id,
          price: t.price,
          qty: t.qty,
          time: t.time,
          isBuyerMaker: t.isBuyerMaker,
        }),
      )

      setState({ bids, asks, trades, connected: true, unavailable: false })
    } catch {
      if (!mountedRef.current) return
      failureCount.current++
      if (failureCount.current >= MAX_FAILURES) {
        setState((prev) => ({ ...prev, connected: false, unavailable: true }))
      }
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    failureCount.current = 0

    if (!symbol) {
      setState({ bids: [], asks: [], trades: [], connected: false, unavailable: false })
      return
    }

    // Fetch immediately, then poll
    fetchData(symbol)
    const interval = setInterval(() => fetchData(symbol), POLL_INTERVAL)

    return () => {
      mountedRef.current = false
      clearInterval(interval)
      setState({ bids: [], asks: [], trades: [], connected: false, unavailable: false })
    }
  }, [symbol, fetchData])

  return state
}

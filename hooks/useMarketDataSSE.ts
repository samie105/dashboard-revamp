"use client"

import { useEffect, useRef, useState } from "react"

// ── Types (same contract as the old useBinanceStreams) ────────────────────

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

const MAX_TRADES = 50
const RECONNECT_DELAY = 3_000
const MAX_FAILURES = 3

// ── Hook ─────────────────────────────────────────────────────────────────

/**
 * Connects to the server-side SSE proxy at `/api/spotv2/stream?symbol=...`
 * and streams order-book + trade data. Same interface as the old useBinanceStreams.
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
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    mountedRef.current = true
    failureCount.current = 0

    if (!symbol) {
      setState({ bids: [], asks: [], trades: [], connected: false, unavailable: false })
      return
    }

    let es: EventSource | null = null
    const currentSymbol = symbol

    function connect() {
      if (!mountedRef.current || !currentSymbol) return

      es = new EventSource(`/api/spotv2/stream?symbol=${encodeURIComponent(currentSymbol)}`)

      es.addEventListener("connected", () => {
        if (!mountedRef.current) return
        failureCount.current = 0
        setState((prev) => ({ ...prev, connected: true, unavailable: false }))
      })

      es.addEventListener("depth", (evt) => {
        if (!mountedRef.current) return

        try {
          const data = JSON.parse(evt.data)

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

          setState((prev) => ({ ...prev, bids, asks }))
        } catch {
          // Ignore parse errors
        }
      })

      es.addEventListener("trade", (evt) => {
        if (!mountedRef.current) return

        try {
          const data = JSON.parse(evt.data)
          const tick: TradeTick = {
            id: data.id,
            price: data.price,
            qty: data.qty,
            time: data.time,
            isBuyerMaker: data.isBuyerMaker,
          }

          setState((prev) => ({
            ...prev,
            trades: [tick, ...prev.trades].slice(0, MAX_TRADES),
          }))
        } catch {
          // Ignore parse errors
        }
      })

      es.addEventListener("error", () => {
        if (!mountedRef.current) return

        failureCount.current++
        setState((prev) => ({ ...prev, connected: false }))

        if (failureCount.current >= MAX_FAILURES) {
          setState((prev) => ({ ...prev, unavailable: true }))
          es?.close()
          return
        }
      })

      // EventSource onerror fires on connection loss — reconnect manually
      es.onerror = () => {
        if (!mountedRef.current) return

        es?.close()
        setState((prev) => ({ ...prev, connected: false }))

        failureCount.current++
        if (failureCount.current >= MAX_FAILURES) {
          setState((prev) => ({ ...prev, unavailable: true }))
          return
        }

        reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY)
      }
    }

    connect()

    return () => {
      mountedRef.current = false
      clearTimeout(reconnectTimer.current)
      es?.close()
      setState({ bids: [], asks: [], trades: [], connected: false, unavailable: false })
    }
  }, [symbol])

  return state
}

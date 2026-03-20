"use client"

import { useEffect, useRef, useState } from "react"
import { toBinanceSymbol } from "@/lib/spotv2/binance"

// ── Types ────────────────────────────────────────────────────────────────

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

export interface BinanceStreamState {
  bids: OrderBookLevel[]
  asks: OrderBookLevel[]
  trades: TradeTick[]
  connected: boolean
  /** True when the Binance pair doesn't exist (e.g. WIF has no WIFUSDT). */
  unavailable: boolean
}

// ── Constants ────────────────────────────────────────────────────────────

const BINANCE_COMBINED_WS = "wss://stream.binance.com:9443/stream"
const RECONNECT_DELAY = 3_000
const MAX_TRADES = 50

// ── Hook ─────────────────────────────────────────────────────────────────

/**
 * Opens a single Binance combined-stream WebSocket for the given symbol.
 * Streams: `{symbol}@depth20@100ms` (order book snapshots) + `{symbol}@trade` (live fills).
 * Cleans up properly on symbol change or unmount.
 */
export function useBinanceStreams(symbol: string | undefined): BinanceStreamState {
  const [state, setState] = useState<BinanceStreamState>({
    bids: [],
    asks: [],
    trades: [],
    connected: false,
    unavailable: false,
  })

  const wsRef = useRef<WebSocket | null>(null)
  const mountedRef = useRef(true)
  const unavailableRef = useRef(false)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    mountedRef.current = true
    unavailableRef.current = false

    if (!symbol) {
      setState({ bids: [] as OrderBookLevel[], asks: [] as OrderBookLevel[], trades: [] as TradeTick[], connected: false, unavailable: false })
      return
    }

    const binanceSymbol = toBinanceSymbol(symbol)
    const depthStream = `${binanceSymbol}@depth20@100ms`
    const tradeStream = `${binanceSymbol}@trade`
    const url = `${BINANCE_COMBINED_WS}?streams=${depthStream}/${tradeStream}`

    function connect() {
      if (!mountedRef.current) return

      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        if (!mountedRef.current) {
          ws.close()
          return
        }
        setState((prev) => ({ ...prev, connected: true, unavailable: false }))
      }

      ws.onmessage = (evt) => {
        if (!mountedRef.current) return

        try {
          const msg = JSON.parse(evt.data)
          const stream = msg.stream as string
          const data = msg.data

          if (stream?.includes("@depth20")) {
            let bidTotal = 0
            const bids: OrderBookLevel[] = (data.bids ?? []).map(
              ([p, a]: [string, string]) => {
                bidTotal += parseFloat(a)
                return { price: parseFloat(p), amount: parseFloat(a), total: bidTotal }
              },
            )

            let askTotal = 0
            const asks: OrderBookLevel[] = (data.asks ?? []).map(
              ([p, a]: [string, string]) => {
                askTotal += parseFloat(a)
                return { price: parseFloat(p), amount: parseFloat(a), total: askTotal }
              },
            )

            setState((prev) => ({ ...prev, bids, asks }))
          }

          if (stream?.includes("@trade")) {
            const tick: TradeTick = {
              id: data.t,
              price: parseFloat(data.p),
              qty: parseFloat(data.q),
              time: data.T,
              isBuyerMaker: data.m,
            }

            setState((prev) => ({
              ...prev,
              trades: [tick, ...prev.trades].slice(0, MAX_TRADES),
            }))
          }
        } catch {
          // Ignore malformed messages
        }
      }

      ws.onerror = () => {
        unavailableRef.current = true
        if (mountedRef.current) {
          setState((prev) => ({ ...prev, unavailable: true, connected: false }))
        }
      }

      ws.onclose = () => {
        if (!mountedRef.current) return
        setState((prev) => ({ ...prev, connected: false }))

        // Reconnect only when the pair actually exists on Binance
        if (!unavailableRef.current) {
          reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY)
        }
      }
    }

    connect()

    return () => {
      mountedRef.current = false
      clearTimeout(reconnectTimer.current)
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      setState({ bids: [] as OrderBookLevel[], asks: [] as OrderBookLevel[], trades: [] as TradeTick[], connected: false, unavailable: false })
    }
  }, [symbol])

  return state
}

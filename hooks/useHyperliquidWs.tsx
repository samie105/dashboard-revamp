"use client"

/**
 * Shared Hyperliquid WebSocket provider.
 *
 * Opens ONE persistent connection to wss://api.hyperliquid.xyz/ws and subscribes
 * to per-user channels (openOrders, orderUpdates, userFills, spotState) plus the
 * public allMids channel.
 *
 * Consumers read data via `useHlWs()` and get real-time pushes instead of polling.
 * Each hook still does an initial HTTP fetch for data, then overlays WS updates.
 */

import * as React from "react"
import type { OpenOrder } from "./useOpenOrders"
import type { UserFill } from "./useUserFills"

// ── Types ────────────────────────────────────────────────────────────────

export interface SpotBalance {
  coin: string
  total: string
  hold: string
  entryNtl: string
}

export interface OrderUpdate {
  order: {
    coin: string
    side: "B" | "A"
    limitPx: string
    sz: string
    oid: number
    timestamp: number
    origSz: string
    orderType: string
  }
  status: string
  statusTimestamp: number
}

interface HlWsState {
  /** All open orders (snapshot pushed on subscribe + updates) */
  openOrders: OpenOrder[]
  /** Latest order update events */
  orderUpdates: OrderUpdate[]
  /** User trade fills (snapshot + live) */
  userFills: UserFill[]
  /** Spot token balances (raw from WS) */
  spotBalances: SpotBalance[]
  /** All mid prices keyed by Hyperliquid coin name */
  allMids: Record<string, string>
  /** Whether the WS is connected */
  connected: boolean
}

interface HlWsContextType extends HlWsState {
  /** Force reconnect */
  reconnect: () => void
}

const DEFAULT_STATE: HlWsState = {
  openOrders: [],
  orderUpdates: [],
  userFills: [],
  spotBalances: [],
  allMids: {},
  connected: false,
}

const HlWsContext = React.createContext<HlWsContextType>({
  ...DEFAULT_STATE,
  reconnect: () => {},
})

export function useHlWs() {
  return React.useContext(HlWsContext)
}

// ── Provider ─────────────────────────────────────────────────────────────

const WS_URL = "wss://api.hyperliquid.xyz/ws"
const RECONNECT_DELAY = 3000

export function HyperliquidWsProvider({
  userAddress,
  children,
}: {
  /** The user's trading wallet address (0x...). If undefined, only public channels connect. */
  userAddress?: string
  children: React.ReactNode
}) {
  const [state, setState] = React.useState<HlWsState>(DEFAULT_STATE)
  const wsRef = React.useRef<WebSocket | null>(null)
  const reconnectTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined)
  const mountedRef = React.useRef(true)

  const connect = React.useCallback(() => {
    // Clean up previous
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      if (!mountedRef.current) return
      setState((s) => ({ ...s, connected: true }))

      // Public: all mid prices
      ws.send(JSON.stringify({
        method: "subscribe",
        subscription: { type: "allMids" },
      }))

      // Per-user subscriptions
      if (userAddress) {
        ws.send(JSON.stringify({
          method: "subscribe",
          subscription: { type: "openOrders", user: userAddress },
        }))
        ws.send(JSON.stringify({
          method: "subscribe",
          subscription: { type: "orderUpdates", user: userAddress },
        }))
        ws.send(JSON.stringify({
          method: "subscribe",
          subscription: { type: "userFills", user: userAddress },
        }))
      }
    }

    ws.onmessage = (evt) => {
      if (!mountedRef.current) return
      try {
        const msg = JSON.parse(evt.data)
        const { channel, data } = msg
        if (!channel || !data) return

        setState((prev) => {
          switch (channel) {
            case "allMids":
              if (data.mids) return { ...prev, allMids: data.mids }
              return prev

            case "openOrders":
              // Snapshot: full array of open orders
              if (Array.isArray(data)) return { ...prev, openOrders: data }
              return prev

            case "orderUpdates":
              // Incremental: array of order update events
              if (Array.isArray(data)) {
                return { ...prev, orderUpdates: [...data, ...prev.orderUpdates].slice(0, 200) }
              }
              return prev

            case "userFills":
              // Can be snapshot (isSnapshot: true) or incremental
              if (data.isSnapshot && Array.isArray(data.fills)) {
                return { ...prev, userFills: data.fills }
              }
              if (Array.isArray(data.fills)) {
                return { ...prev, userFills: [...data.fills, ...prev.userFills].slice(0, 200) }
              }
              // Sometimes fills come as plain array
              if (Array.isArray(data)) {
                return { ...prev, userFills: [...data, ...prev.userFills].slice(0, 200) }
              }
              return prev

            default:
              return prev
          }
        })
      } catch { /* ignore malformed messages */ }
    }

    ws.onclose = () => {
      if (!mountedRef.current) return
      setState((s) => ({ ...s, connected: false }))
      // Auto-reconnect
      reconnectTimer.current = setTimeout(() => {
        if (mountedRef.current) connect()
      }, RECONNECT_DELAY)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [userAddress])

  // Connect on mount / address change
  React.useEffect(() => {
    mountedRef.current = true
    connect()
    return () => {
      mountedRef.current = false
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      if (wsRef.current) wsRef.current.close()
    }
  }, [connect])

  // Heartbeat to keep connection alive
  React.useEffect(() => {
    const id = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ method: "ping" }))
      }
    }, 30_000)
    return () => clearInterval(id)
  }, [])

  const ctx = React.useMemo<HlWsContextType>(
    () => ({ ...state, reconnect: connect }),
    [state, connect],
  )

  return (
    <HlWsContext.Provider value={ctx}>
      {children}
    </HlWsContext.Provider>
  )
}

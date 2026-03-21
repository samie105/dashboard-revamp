"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon, Cancel01Icon } from "@hugeicons/core-free-icons"
import { useAuth } from "@/components/auth-provider"
import {
  getSpotV2Positions,
  getSpotV2OpenOrders,
  getSpotV2TradeHistory,
  cancelSpotV2Order,
  type PositionInfo,
} from "@/lib/spotv2/ledger-actions"
import type { SpotV2Pair } from "./spotv2-types"

// ── Types ────────────────────────────────────────────────────────────────

type Tab = "positions" | "orders" | "history"

interface OpenOrder {
  id: string
  pair: string
  token: string
  side: string
  orderType: string
  quantity: number
  limitPrice?: number
  stopPrice?: number
  lockedAmount: number
  status: string
  createdAt: Date
}

interface TradeRecord {
  id: string
  pair: string
  token: string
  side: string
  quantity: number
  price: number
  quoteAmount: number
  realizedPnl: number
  fee: number
  createdAt: Date
}

interface PositionWithPnl extends PositionInfo {
  currentPrice: number
  marketValue: number
  unrealizedPnl: number
  unrealizedPnlPct: number
}

// ── Props ────────────────────────────────────────────────────────────────

interface SpotV2BottomPanelProps {
  pairs: SpotV2Pair[]
}

// ── Component ────────────────────────────────────────────────────────────

export function SpotV2BottomPanel({ pairs }: SpotV2BottomPanelProps) {
  const { isSignedIn } = useAuth()
  const [tab, setTab] = React.useState<Tab>("positions")
  const [loading, setLoading] = React.useState(false)

  // Data
  const [positions, setPositions] = React.useState<PositionInfo[]>([])
  const [openOrders, setOpenOrders] = React.useState<OpenOrder[]>([])
  const [trades, setTrades] = React.useState<TradeRecord[]>([])
  const [cancellingId, setCancellingId] = React.useState<string | null>(null)

  // Build price map from pairs
  const priceMap = React.useMemo(() => {
    const m = new Map<string, number>()
    for (const p of pairs) m.set(p.symbol, p.price)
    return m
  }, [pairs])

  // Positions with live PnL
  const positionsWithPnl = React.useMemo<PositionWithPnl[]>(() => {
    return positions
      .filter((p) => p.quantity > 0)
      .map((p) => {
        const currentPrice = priceMap.get(p.token) ?? 0
        const marketValue = p.quantity * currentPrice
        const costBasis = p.quantity * p.avgEntryPrice
        const unrealizedPnl = marketValue - costBasis
        const unrealizedPnlPct = costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0
        return { ...p, currentPrice, marketValue, unrealizedPnl, unrealizedPnlPct }
      })
  }, [positions, priceMap])

  // Aggregate stats
  const stats = React.useMemo(() => {
    const totalUnrealized = positionsWithPnl.reduce((s, p) => s + p.unrealizedPnl, 0)
    const sells = trades.filter((t) => t.side === "SELL")
    const totalRealized = sells.reduce((s, t) => s + t.realizedPnl, 0)
    const wins = sells.filter((t) => t.realizedPnl > 0).length
    const winRate = sells.length > 0 ? (wins / sells.length) * 100 : 0
    return { totalUnrealized, totalRealized, totalPnl: totalUnrealized + totalRealized, winRate, totalTrades: sells.length }
  }, [positionsWithPnl, trades])

  // Fetch data
  const fetchData = React.useCallback(async () => {
    if (!isSignedIn) return
    setLoading(true)
    try {
      const [pos, orders, hist] = await Promise.all([
        getSpotV2Positions(),
        getSpotV2OpenOrders(),
        getSpotV2TradeHistory(100),
      ])
      setPositions(pos)
      setOpenOrders(orders as OpenOrder[])
      setTrades(hist as TradeRecord[])
    } catch {
      // silently ignore
    } finally {
      setLoading(false)
    }
  }, [isSignedIn])

  React.useEffect(() => {
    fetchData()
    const iv = setInterval(fetchData, 15_000)
    return () => clearInterval(iv)
  }, [fetchData])

  // Cancel handler
  const handleCancel = React.useCallback(async (orderId: string) => {
    setCancellingId(orderId)
    try {
      const result = await cancelSpotV2Order(orderId)
      if (result.success) {
        setOpenOrders((prev) => prev.filter((o) => o.id !== orderId))
      }
    } catch {
      // ignore
    } finally {
      setCancellingId(null)
    }
  }, [])

  if (!isSignedIn) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-[11px] text-muted-foreground/50">Sign in to view positions</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-card">
      {/* Tab bar + stats */}
      <div className="flex items-center justify-between border-b border-border/10 px-2">
        <div className="flex">
          {(
            [
              { id: "positions", label: "Positions", count: positionsWithPnl.length },
              { id: "orders", label: "Orders", count: openOrders.length },
              { id: "history", label: "History", count: trades.length },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "px-2.5 py-1.5 text-[10px] font-semibold transition-colors",
                tab === t.id
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {t.count > 0 && (
                <span className="ml-1 rounded-full bg-accent/50 px-1 text-[9px] tabular-nums">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Aggregate PnL chips */}
        <div className="hidden items-center gap-2 sm:flex">
          <PnlChip label="PnL" value={stats.totalPnl} />
          <PnlChip label="Realized" value={stats.totalRealized} />
          <PnlChip label="Unrealized" value={stats.totalUnrealized} />
          {stats.totalTrades > 0 && (
            <span className="text-[9px] text-muted-foreground">
              WR: {stats.winRate.toFixed(0)}%
            </span>
          )}
        </div>

        {loading && (
          <HugeiconsIcon icon={Loading03Icon} className="h-3 w-3 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === "positions" && (
          <PositionsTab positions={positionsWithPnl} />
        )}
        {tab === "orders" && (
          <OrdersTab
            orders={openOrders}
            cancellingId={cancellingId}
            onCancel={handleCancel}
          />
        )}
        {tab === "history" && <HistoryTab trades={trades} />}
      </div>
    </div>
  )
}

// ── PnL chip ─────────────────────────────────────────────────────────────

function PnlChip({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex items-center gap-1 text-[9px]">
      <span className="text-muted-foreground">{label}:</span>
      <span
        className={cn(
          "font-semibold tabular-nums",
          value > 0 ? "text-emerald-500" : value < 0 ? "text-red-500" : "text-muted-foreground",
        )}
      >
        {value >= 0 ? "+" : ""}${value.toFixed(2)}
      </span>
    </span>
  )
}

// ── Positions Tab ────────────────────────────────────────────────────────

function PositionsTab({ positions }: { positions: PositionWithPnl[] }) {
  if (positions.length === 0) {
    return <EmptyState>No open positions</EmptyState>
  }

  return (
    <table className="w-full text-[10px]">
      <thead>
        <tr className="border-b border-border/10 text-muted-foreground">
          <th className="px-2 py-1 text-left font-medium">Token</th>
          <th className="px-2 py-1 text-right font-medium">Qty</th>
          <th className="px-2 py-1 text-right font-medium">Avg Entry</th>
          <th className="px-2 py-1 text-right font-medium">Price</th>
          <th className="px-2 py-1 text-right font-medium">Value</th>
          <th className="px-2 py-1 text-right font-medium">PnL</th>
        </tr>
      </thead>
      <tbody>
        {positions.map((p) => (
          <tr key={p.token} className="border-b border-border/5 hover:bg-accent/10 transition-colors">
            <td className="px-2 py-1 font-semibold text-foreground">{p.token}</td>
            <td className="px-2 py-1 text-right tabular-nums">{fmtQty(p.quantity)}</td>
            <td className="px-2 py-1 text-right tabular-nums">{fmtPrice(p.avgEntryPrice)}</td>
            <td className="px-2 py-1 text-right tabular-nums">{fmtPrice(p.currentPrice)}</td>
            <td className="px-2 py-1 text-right tabular-nums">${p.marketValue.toFixed(2)}</td>
            <td className="px-2 py-1 text-right">
              <span
                className={cn(
                  "tabular-nums font-medium",
                  p.unrealizedPnl > 0 ? "text-emerald-500" : p.unrealizedPnl < 0 ? "text-red-500" : "text-muted-foreground",
                )}
              >
                {p.unrealizedPnl >= 0 ? "+" : ""}${p.unrealizedPnl.toFixed(2)}
                <span className="ml-0.5 text-[9px] opacity-70">
                  ({p.unrealizedPnlPct >= 0 ? "+" : ""}{p.unrealizedPnlPct.toFixed(1)}%)
                </span>
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Orders Tab ───────────────────────────────────────────────────────────

function OrdersTab({
  orders,
  cancellingId,
  onCancel,
}: {
  orders: OpenOrder[]
  cancellingId: string | null
  onCancel: (id: string) => void
}) {
  if (orders.length === 0) {
    return <EmptyState>No open orders</EmptyState>
  }

  return (
    <table className="w-full text-[10px]">
      <thead>
        <tr className="border-b border-border/10 text-muted-foreground">
          <th className="px-2 py-1 text-left font-medium">Pair</th>
          <th className="px-2 py-1 text-left font-medium">Type</th>
          <th className="px-2 py-1 text-left font-medium">Side</th>
          <th className="px-2 py-1 text-right font-medium">Qty</th>
          <th className="px-2 py-1 text-right font-medium">Price</th>
          <th className="px-2 py-1 text-right font-medium">Locked</th>
          <th className="px-2 py-1 text-right font-medium">Status</th>
          <th className="px-2 py-1 text-right font-medium"></th>
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => (
          <tr key={o.id} className="border-b border-border/5 hover:bg-accent/10 transition-colors">
            <td className="px-2 py-1 font-semibold text-foreground">{o.pair}</td>
            <td className="px-2 py-1 text-muted-foreground">
              {o.orderType === "STOP_LIMIT" ? "Stop" : "Limit"}
            </td>
            <td className="px-2 py-1">
              <span className={o.side === "BUY" ? "text-emerald-500" : "text-red-500"}>
                {o.side}
              </span>
            </td>
            <td className="px-2 py-1 text-right tabular-nums">{fmtQty(o.quantity)}</td>
            <td className="px-2 py-1 text-right tabular-nums">
              {o.stopPrice ? (
                <span>
                  <span className="text-muted-foreground/60">{fmtPrice(o.stopPrice)} → </span>
                  {fmtPrice(o.limitPrice ?? 0)}
                </span>
              ) : (
                fmtPrice(o.limitPrice ?? 0)
              )}
            </td>
            <td className="px-2 py-1 text-right tabular-nums">
              {o.side === "BUY" ? `$${o.lockedAmount.toFixed(2)}` : `${o.lockedAmount.toFixed(6)} ${o.token}`}
            </td>
            <td className="px-2 py-1 text-right">
              <span className={cn(
                "text-[9px] font-medium",
                o.status === "OPEN" ? "text-blue-400" : "text-amber-400",
              )}>
                {o.status === "STOP_TRIGGERED" ? "TRIGGERED" : o.status}
              </span>
            </td>
            <td className="px-2 py-1 text-right">
              <button
                onClick={() => onCancel(o.id)}
                disabled={cancellingId === o.id}
                className="rounded p-0.5 text-muted-foreground/60 hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                title="Cancel order"
              >
                {cancellingId === o.id ? (
                  <HugeiconsIcon icon={Loading03Icon} className="h-3 w-3 animate-spin" />
                ) : (
                  <HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3" />
                )}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── History Tab ──────────────────────────────────────────────────────────

function HistoryTab({ trades }: { trades: TradeRecord[] }) {
  if (trades.length === 0) {
    return <EmptyState>No trade history</EmptyState>
  }

  return (
    <table className="w-full text-[10px]">
      <thead>
        <tr className="border-b border-border/10 text-muted-foreground">
          <th className="px-2 py-1 text-left font-medium">Date</th>
          <th className="px-2 py-1 text-left font-medium">Pair</th>
          <th className="px-2 py-1 text-left font-medium">Side</th>
          <th className="px-2 py-1 text-right font-medium">Qty</th>
          <th className="px-2 py-1 text-right font-medium">Price</th>
          <th className="px-2 py-1 text-right font-medium">Total</th>
          <th className="px-2 py-1 text-right font-medium">PnL</th>
        </tr>
      </thead>
      <tbody>
        {trades.map((t) => (
          <tr key={t.id} className="border-b border-border/5 hover:bg-accent/10 transition-colors">
            <td className="px-2 py-1 text-muted-foreground tabular-nums">
              {fmtDate(t.createdAt)}
            </td>
            <td className="px-2 py-1 font-semibold text-foreground">{t.pair}</td>
            <td className="px-2 py-1">
              <span className={t.side === "BUY" ? "text-emerald-500" : "text-red-500"}>
                {t.side}
              </span>
            </td>
            <td className="px-2 py-1 text-right tabular-nums">{fmtQty(t.quantity)}</td>
            <td className="px-2 py-1 text-right tabular-nums">{fmtPrice(t.price)}</td>
            <td className="px-2 py-1 text-right tabular-nums">${t.quoteAmount.toFixed(2)}</td>
            <td className="px-2 py-1 text-right">
              {t.side === "SELL" ? (
                <span
                  className={cn(
                    "tabular-nums font-medium",
                    t.realizedPnl > 0 ? "text-emerald-500" : t.realizedPnl < 0 ? "text-red-500" : "text-muted-foreground",
                  )}
                >
                  {t.realizedPnl >= 0 ? "+" : ""}${t.realizedPnl.toFixed(2)}
                </span>
              ) : (
                <span className="text-muted-foreground/40">—</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-[60px] items-center justify-center">
      <p className="text-[10px] text-muted-foreground/50">{children}</p>
    </div>
  )
}

function fmtPrice(v: number): string {
  if (v === 0) return "$0"
  if (v < 0.01) return `$${v.toFixed(8)}`
  if (v < 1) return `$${v.toFixed(4)}`
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtQty(v: number): string {
  if (v < 0.0001) return v.toFixed(8)
  if (v < 1) return v.toFixed(6)
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

function fmtDate(d: Date): string {
  const date = new Date(d)
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const day = date.getDate().toString().padStart(2, "0")
  const hr = date.getHours().toString().padStart(2, "0")
  const min = date.getMinutes().toString().padStart(2, "0")
  return `${month}/${day} ${hr}:${min}`
}

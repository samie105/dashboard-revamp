"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Menu01Icon,
  Loading03Icon,
  Cancel01Icon,
  Exchange01Icon,
  Wallet01Icon,
  Clock01Icon,
} from "@hugeicons/core-free-icons"
import { useAuth } from "@/components/auth-provider"
import { useOpenOrders, type OpenOrder } from "@/hooks/useOpenOrders"
import { useOrderHistory, type HistoricalOrder } from "@/hooks/useOrderHistory"
import { useUserFills, type UserFill } from "@/hooks/useUserFills"
import { useHyperliquidBalance } from "@/hooks/useHyperliquidBalance"

type Tab = "orders" | "history" | "holdings"

export function OpenOrdersPanel() {
  const { user, isSignedIn } = useAuth()
  const [tab, setTab] = React.useState<Tab>("orders")

  const { orders: openOrders, cancelOrder, cancelAll, loading: ordersLoading } = useOpenOrders()
  const { orders: orderHistory, loading: historyLoading } = useOrderHistory()
  const { fills, loading: fillsLoading } = useUserFills()
  const { balances: hlBalances, loading: balancesLoading } = useHyperliquidBalance(user?.userId, isSignedIn)

  const loading =
    (tab === "orders" && ordersLoading) ||
    (tab === "history" && (historyLoading || fillsLoading)) ||
    (tab === "holdings" && balancesLoading)

  const tabs: { id: Tab; label: string; icon: typeof Menu01Icon }[] = [
    { id: "orders", label: "Open Orders", icon: Clock01Icon },
    { id: "history", label: "Trade History", icon: Exchange01Icon },
    { id: "holdings", label: "Holdings", icon: Wallet01Icon },
  ]

  return (
    <div className="flex h-full flex-col rounded-xl bg-card overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center border-b border-border/20 px-1">
        <div className="flex items-center">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-medium transition-colors ${
                tab === t.id
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <HugeiconsIcon icon={t.icon} className="h-3 w-3" />
              {t.label}
              {t.id === "orders" && openOrders.length > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/15 px-1 text-[9px] font-semibold text-primary tabular-nums">
                  {openOrders.length}
                </span>
              )}
              {tab === t.id && (
                <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto pr-2">
          {tab === "orders" && openOrders.length > 0 && (
            <button
              onClick={cancelAll}
              className="rounded-md bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-500 transition-colors hover:bg-red-500/15"
            >
              Cancel All
            </button>
          )}
          {loading && (
            <HugeiconsIcon icon={Loading03Icon} className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto slim-scroll">
        {!isSignedIn ? (
          <EmptyState icon={Menu01Icon} message="Sign in to view your orders" sub="Connect your account to start trading" />
        ) : tab === "orders" ? (
          openOrders.length === 0 ? (
            <EmptyState icon={Clock01Icon} message="No open orders" sub="Your active orders will appear here" />
          ) : (
            <OpenOrdersTable orders={openOrders} onCancel={cancelOrder} />
          )
        ) : tab === "history" ? (
          fills.length === 0 && orderHistory.length === 0 ? (
            <EmptyState icon={Exchange01Icon} message="No trade history" sub="Your executed trades will appear here" />
          ) : (
            <OrderHistoryTable orders={orderHistory} fills={fills} />
          )
        ) : hlBalances.length === 0 ? (
          <EmptyState icon={Wallet01Icon} message="No holdings found" sub="Your spot balances will appear here" />
        ) : (
          <HoldingsTable balances={hlBalances} />
        )}
      </div>
    </div>
  )
}

function EmptyState({ icon, message, sub }: { icon: typeof Menu01Icon; message: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-8">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/50">
        <HugeiconsIcon icon={icon} className="h-5 w-5 text-muted-foreground/40" />
      </div>
      <p className="text-xs font-medium text-muted-foreground">{message}</p>
      <p className="text-[10px] text-muted-foreground/60">{sub}</p>
    </div>
  )
}

function OpenOrdersTable({
  orders,
  onCancel,
}: {
  orders: OpenOrder[]
  onCancel: (coin: string, orderId: number) => Promise<boolean>
}) {
  const [cancellingId, setCancellingId] = React.useState<number | null>(null)

  const handleCancel = async (coin: string, oid: number) => {
    setCancellingId(oid)
    await onCancel(coin, oid)
    setCancellingId(null)
  }

  return (
    <div className="divide-y divide-border/10">
      {orders.map((o) => {
        const isBuy = o.side === "B"
        return (
          <div key={o.oid} className="flex items-center gap-3 px-3 py-2 hover:bg-accent/10 transition-colors group">
            {/* Side indicator */}
            <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[9px] font-bold text-white ${
              isBuy ? "bg-emerald-500" : "bg-red-500"
            }`}>
              {isBuy ? "B" : "S"}
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold">{o.coin}</span>
                <span className={`rounded-md px-1.5 py-px text-[9px] font-medium ${
                  o.orderType === "Limit" ? "bg-amber-500/10 text-amber-500"
                    : o.orderType === "Stop Limit" ? "bg-blue-500/10 text-blue-500"
                    : "bg-accent text-muted-foreground"
                }`}>
                  {o.orderType}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                <span className="tabular-nums">${Number(o.limitPx).toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
                <span className="text-border">·</span>
                <span className="tabular-nums">{Number(o.sz).toFixed(4)}</span>
              </div>
            </div>

            {/* Cancel button */}
            <button
              onClick={() => handleCancel(o.coin, o.oid)}
              disabled={cancellingId === o.oid}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500/10 transition-all"
            >
              {cancellingId === o.oid ? (
                <HugeiconsIcon icon={Loading03Icon} className="h-3 w-3 animate-spin text-muted-foreground" />
              ) : (
                <HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3 text-red-500" />
              )}
            </button>
          </div>
        )
      })}
    </div>
  )
}

function OrderHistoryTable({
  orders,
  fills,
}: {
  orders: HistoricalOrder[]
  fills: UserFill[]
}) {
  const fillRows = fills.map((f) => ({
    key: `fill-${f.tid}`,
    coin: f.coinDisplay || f.coin,
    side: f.side,
    price: f.px,
    size: f.sz,
    status: "filled" as const,
    time: f.time,
    pnl: f.closedPnl,
  }))

  const orderRows = orders
    .filter((o) => o.status !== "open")
    .map((o) => ({
      key: `order-${o.order.oid}`,
      coin: o.order.coinDisplay || o.order.coin,
      side: o.order.side,
      price: o.order.limitPx,
      size: o.order.origSz,
      status: o.status,
      time: o.statusTimestamp,
      pnl: undefined as string | undefined,
    }))

  const fillOids = new Set(fills.map((f) => f.oid))
  const filteredOrders = orderRows.filter(
    (o) => !fillOids.has(Number(o.key.replace("order-", "")))
  )
  const rows = [...fillRows, ...filteredOrders].sort((a, b) => b.time - a.time)

  return (
    <div className="divide-y divide-border/10">
      {rows.map((r) => {
        const isBuy = r.side === "B"
        const statusColor =
          r.status === "filled" ? "text-emerald-500 bg-emerald-500/10"
            : r.status === "canceled" || r.status === "marginCanceled" ? "text-red-500 bg-red-500/10"
            : "text-amber-500 bg-amber-500/10"

        return (
          <div key={r.key} className="flex items-center gap-3 px-3 py-2 hover:bg-accent/10 transition-colors">
            {/* Side indicator */}
            <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[9px] font-bold text-white ${
              isBuy ? "bg-emerald-500" : "bg-red-500"
            }`}>
              {isBuy ? "B" : "S"}
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold">{r.coin}</span>
                <span className={`rounded-md px-1.5 py-px text-[9px] font-medium ${statusColor}`}>
                  {r.status}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                <span className="tabular-nums">${Number(r.price).toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
                <span className="text-border">·</span>
                <span className="tabular-nums">{Number(r.size).toFixed(4)}</span>
              </div>
            </div>

            {/* Time + PnL */}
            <div className="text-right shrink-0">
              <p className="text-[10px] text-muted-foreground">
                {new Date(r.time).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
              {r.pnl && Number(r.pnl) !== 0 && (
                <p className={`text-[10px] font-medium tabular-nums ${Number(r.pnl) >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                  {Number(r.pnl) >= 0 ? "+" : ""}{Number(r.pnl).toFixed(2)}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface HyperliquidBalance {
  coin: string
  total: number
  available: number
  hold: number
  currentPrice: number
  currentValue: number
  unrealizedPnl: number
  unrealizedPnlPercent: number
}

function HoldingsTable({ balances }: { balances: HyperliquidBalance[] }) {
  return (
    <div className="divide-y divide-border/10">
      {balances.map((b) => {
        const isProfit = b.unrealizedPnl >= 0
        return (
          <div key={b.coin} className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent/10 transition-colors">
            {/* Coin icon placeholder */}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/50 text-[10px] font-bold text-foreground">
              {b.coin.slice(0, 2)}
            </div>

            {/* Coin info */}
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold">{b.coin}</span>
              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                <span className="tabular-nums">{b.available.toFixed(4)} avail</span>
                {b.hold > 0 && (
                  <>
                    <span className="text-border">·</span>
                    <span className="tabular-nums">{b.hold.toFixed(4)} hold</span>
                  </>
                )}
              </div>
            </div>

            {/* Value + PnL */}
            <div className="text-right shrink-0">
              <p className="text-xs font-semibold tabular-nums">
                ${b.currentValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
              <p className={`text-[10px] font-medium tabular-nums ${isProfit ? "text-emerald-500" : "text-red-500"}`}>
                {isProfit ? "+" : ""}{b.unrealizedPnlPercent.toFixed(2)}%
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

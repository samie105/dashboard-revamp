"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Menu01Icon, Loading03Icon } from "@hugeicons/core-free-icons"
import { useAuth } from "@/components/auth-provider"
import { getTradeHistory, getUserBalances, type TradeHistoryItem, type UserBalance } from "@/lib/actions"

type Tab = "orders" | "history" | "holdings"

export function OpenOrdersPanel() {
  const { user, isSignedIn } = useAuth()
  const [tab, setTab] = React.useState<Tab>("orders")
  const [trades, setTrades] = React.useState<TradeHistoryItem[]>([])
  const [balances, setBalances] = React.useState<UserBalance[]>([])
  const [loading, setLoading] = React.useState(false)

  const userId = user?.userId

  // Fetch data when tab changes or user signs in
  React.useEffect(() => {
    if (!isSignedIn || !userId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        if (tab === "orders" || tab === "history") {
          const res = await getTradeHistory(userId!, 50)
          if (!cancelled && res.success) setTrades(res.data)
        } else if (tab === "holdings") {
          const res = await getUserBalances(userId!)
          if (!cancelled && res.success) setBalances(res.balances)
        }
      } catch { /* ignore */ } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [tab, isSignedIn, userId])

  const openOrders = trades.filter((t) => t.status === "PENDING")
  const tradeHistory = trades.filter((t) => t.status !== "PENDING")

  const tabs: { id: Tab; label: string }[] = [
    { id: "orders", label: "Open Orders" },
    { id: "history", label: "Trade History" },
    { id: "holdings", label: "Holdings" },
  ]

  return (
    <div className="flex h-full flex-col rounded-xl bg-card overflow-hidden">
      {/* Tab headers */}
      <div className="flex items-center gap-4 border-b border-border/20 px-3 py-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`text-xs font-medium transition-colors ${
              tab === t.id
                ? "text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            {t.id === "orders" && openOrders.length > 0 && (
              <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-[9px] text-primary">
                {openOrders.length}
              </span>
            )}
          </button>
        ))}
        {loading && (
          <HugeiconsIcon icon={Loading03Icon} className="ml-auto h-3 w-3 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto slim-scroll">
        {!isSignedIn ? (
          <EmptyState message="Sign in to view your orders" />
        ) : tab === "orders" ? (
          openOrders.length === 0 ? (
            <EmptyState message="No open orders" />
          ) : (
            <TradesTable trades={openOrders} />
          )
        ) : tab === "history" ? (
          tradeHistory.length === 0 ? (
            <EmptyState message="No trade history" />
          ) : (
            <TradesTable trades={tradeHistory} />
          )
        ) : balances.length === 0 ? (
          <EmptyState message="No holdings found" />
        ) : (
          <HoldingsTable balances={balances} />
        )}
      </div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/40">
        <HugeiconsIcon icon={Menu01Icon} className="h-4 w-4 text-muted-foreground/40" />
      </div>
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  )
}

function TradesTable({ trades }: { trades: TradeHistoryItem[] }) {
  return (
    <table className="w-full text-[10px]">
      <thead>
        <tr className="border-b border-border/10 text-muted-foreground">
          <th className="px-3 py-1.5 text-left font-medium">Pair</th>
          <th className="px-2 py-1.5 text-left font-medium">Side</th>
          <th className="px-2 py-1.5 text-right font-medium">Price</th>
          <th className="px-2 py-1.5 text-right font-medium">Amount</th>
          <th className="hidden sm:table-cell px-2 py-1.5 text-right font-medium">Status</th>
          <th className="hidden md:table-cell px-3 py-1.5 text-right font-medium">Time</th>
        </tr>
      </thead>
      <tbody>
        {trades.map((t) => (
          <tr key={t.id} className="border-b border-border/5 hover:bg-accent/20 transition-colors">
            <td className="px-3 py-1.5 font-medium">{t.pair}</td>
            <td className={`px-2 py-1.5 font-semibold ${t.side === "BUY" ? "text-emerald-500" : "text-red-500"}`}>
              {t.side}
            </td>
            <td className="px-2 py-1.5 text-right tabular-nums">
              ${Number(t.price).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </td>
            <td className="px-2 py-1.5 text-right tabular-nums">{Number(t.amount).toFixed(4)}</td>
            <td className="hidden sm:table-cell px-2 py-1.5 text-right">
              <span className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                t.status === "CONFIRMED"
                  ? "bg-emerald-500/10 text-emerald-500"
                  : t.status === "PENDING"
                    ? "bg-amber-500/10 text-amber-500"
                    : "bg-red-500/10 text-red-500"
              }`}>
                {t.status}
              </span>
            </td>
            <td className="hidden md:table-cell px-3 py-1.5 text-right text-muted-foreground">
              {new Date(t.createdAt).toLocaleString(undefined, {
                month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
              })}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function HoldingsTable({ balances }: { balances: UserBalance[] }) {
  return (
    <table className="w-full text-[10px]">
      <thead>
        <tr className="border-b border-border/10 text-muted-foreground">
          <th className="px-3 py-1.5 text-left font-medium">Asset</th>
          <th className="px-2 py-1.5 text-left font-medium">Chain</th>
          <th className="px-2 py-1.5 text-right font-medium">Available</th>
          <th className="px-2 py-1.5 text-right font-medium">Locked</th>
          <th className="px-3 py-1.5 text-right font-medium">Total</th>
        </tr>
      </thead>
      <tbody>
        {balances.map((b, i) => (
          <tr key={`${b.asset}-${b.chain}-${i}`} className="border-b border-border/5 hover:bg-accent/20 transition-colors">
            <td className="px-3 py-1.5 font-semibold">{b.asset}</td>
            <td className="px-2 py-1.5 text-muted-foreground capitalize">{b.chain}</td>
            <td className="px-2 py-1.5 text-right tabular-nums">{b.available.toFixed(4)}</td>
            <td className="px-2 py-1.5 text-right tabular-nums">{b.locked.toFixed(4)}</td>
            <td className="px-3 py-1.5 text-right tabular-nums font-medium">
              {(b.available + b.locked).toFixed(4)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

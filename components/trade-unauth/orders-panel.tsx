"use client"

/**
 * Orders.
 *
 * The live panel is titled "Your orders" and shows Filled only — so there is
 * nothing to cancel, and the columns are TIME / MARKET / SIDE / RECEIVED /
 * VALUE / STATUS: you can see what you got, never what you paid for it or at
 * what price.
 *
 * Here: Open / Filled / Cancelled, a Price column, a Total column, and a
 * cancel action on every working order — with the filled progress shown,
 * because a partially filled limit is the one row you need to act on.
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import { Segmented, EmptyState } from "@/components/ui/system"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import {
  ORDERS,
  formatPrice,
  pairById,
  type Order,
  type OrderStatus,
} from "@/components/trade-unauth/trade-data"

type Tab = OrderStatus | "all"

export function OrdersPanel({ pairId }: { pairId: string }) {
  const [tab, setTab] = React.useState<Tab>("open")
  const [onlyThis, setOnlyThis] = React.useState(false)
  const [cancelled, setCancelled] = React.useState<string[]>([])

  const rows = ORDERS.filter((o) => {
    const status = cancelled.includes(o.id) ? "cancelled" : o.status
    if (tab !== "all" && status !== tab) return false
    if (onlyThis && o.pairId !== pairId) return false
    return true
  })

  const counts = {
    open: ORDERS.filter((o) => o.status === "open" && !cancelled.includes(o.id)).length,
    filled: ORDERS.filter((o) => o.status === "filled").length,
  }

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/40 px-4 py-2.5">
        <Segmented
          size="sm"
          options={[
            { key: "open", label: `Open (${counts.open})` },
            { key: "filled", label: `Filled (${counts.filled})` },
            { key: "cancelled", label: "Cancelled" },
            { key: "all", label: "All" },
          ]}
          value={tab}
          onChange={(k) => setTab(k as Tab)}
        />
        <label className="ml-auto flex cursor-pointer select-none items-center gap-2 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground">
          <input
            type="checkbox"
            checked={onlyThis}
            onChange={(e) => setOnlyThis(e.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--primary)]"
          />
          This market only
        </label>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={tab === "open" ? "No working orders" : "Nothing here"}
          description={
            tab === "open"
              ? "Limit and stop orders you place will rest here until they fill."
              : "Orders appear here once they settle."
          }
        />
      ) : (
        <div className="slim-scroll min-w-0 overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border/40 text-[11px] uppercase tracking-[0.07em] text-muted-foreground">
                <th className="px-4 py-2.5 font-semibold">Time</th>
                <th className="px-4 py-2.5 font-semibold">Market</th>
                <th className="px-4 py-2.5 font-semibold">Type</th>
                <th className="px-4 py-2.5 text-right font-semibold">Price</th>
                <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                <th className="px-4 py-2.5 font-semibold">Route</th>
                <th className="px-4 py-2.5 text-right font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/25">
              {rows.map((o) => (
                <Row
                  key={o.id}
                  o={o}
                  cancelled={cancelled.includes(o.id)}
                  onCancel={() => setCancelled((c) => [...c, o.id])}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Row({ o, cancelled, onCancel }: { o: Order; cancelled: boolean; onCancel: () => void }) {
  const pair = pairById(o.pairId)
  const status: OrderStatus = cancelled ? "cancelled" : o.status
  const total = o.price * o.amount

  return (
    <tr className="transition-colors hover:bg-accent/40">
      <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-muted-foreground">
        {o.date}, {o.time}
      </td>
      <td className="px-4 py-3">
        <span className="flex items-center gap-2.5">
          <CoinAvatar symbol={pair.base} size="md" />
          <span className="flex items-baseline gap-1">
            <span className="text-[13px] font-semibold">{pair.base}</span>
            <span className="text-[11px] text-muted-foreground">/{pair.quote}</span>
          </span>
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "text-[12.5px] font-semibold capitalize",
              o.side === "buy" ? "text-credit" : "text-debit",
            )}
          >
            {o.side}
          </span>
          <span className="rounded bg-foreground/[0.08] px-1.5 text-[10.5px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            {o.type}
          </span>
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right text-[13px] font-medium tabular-nums">
        {formatPrice(o.price)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right text-[13px] tabular-nums">
        {o.amount.toLocaleString("en-US", { maximumFractionDigits: 4 })} {pair.base}
      </td>
      {/* The column the live table is missing: what it actually costs. */}
      <td className="whitespace-nowrap px-4 py-3 text-right text-[13px] tabular-nums">
        {total.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 })}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-muted-foreground">{o.route}</td>
      <td className="px-4 py-3">
        <span className="flex items-center justify-end gap-2.5">
          {status === "open" ? (
            <>
              {o.filledPct > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-12 overflow-hidden rounded-full bg-foreground/[0.08]">
                    <span
                      className="block h-full rounded-full bg-primary/70"
                      style={{ width: `${o.filledPct}%` }}
                    />
                  </span>
                  <span className="text-[11px] tabular-nums text-muted-foreground">{o.filledPct}%</span>
                </span>
              )}
              {/* The action the live panel has nowhere to put. */}
              <button
                type="button"
                onClick={onCancel}
                className="rounded-full border border-debit/40 px-2.5 py-1 text-[11.5px] font-semibold text-debit transition-colors hover:bg-debit hover:text-white"
              >
                Cancel
              </button>
            </>
          ) : (
            <span
              className={cn(
                "rounded-full px-2 py-1 text-[11.5px] font-semibold capitalize",
                status === "filled"
                  ? "bg-foreground/[0.07] text-muted-foreground"
                  : "bg-debit-chip text-debit",
              )}
            >
              {status}
            </span>
          )}
        </span>
      </td>
    </tr>
  )
}

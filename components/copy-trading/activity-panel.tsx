"use client"

import { CardShell, EmptyState } from "@/components/ui/system"
import type { CopyOrder } from "@/lib/copy-trading/types"
import { StatusChip } from "./parts"

export function ActivityPanel({ orders, loading }: { orders: CopyOrder[]; loading: boolean }) {
  if (loading) return <p className="text-[13px] text-muted-foreground">Loading…</p>
  if (orders.length === 0) return <EmptyState title="No copied trades yet" description="Trades copied for you, and ones that were skipped with the reason, show up here." />
  return (
    <CardShell className="divide-y divide-border/50 p-0">
      {orders.map((o) => (
        <div key={o.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="text-[14px] font-medium tabular-nums">
              <span className={o.side === "buy" ? "text-credit" : "text-debit"}>{o.side === "buy" ? "Buy" : "Sell"}</span> {o.size > 0 ? o.size.toPrecision(4) : ""} {o.symbol}
              <span className="ml-1.5 text-[12px] text-muted-foreground">{o.kind === "perp" ? "Futures" : "Spot"}</span>
            </div>
            <div className="truncate text-[12.5px] text-muted-foreground">{o.status === "filled" ? `at $${o.price.toLocaleString()}` : o.reason ?? o.status} · {new Date(o.ts).toLocaleString()}</div>
          </div>
          <StatusChip tone={o.status === "filled" ? "good" : o.status === "failed" ? "bad" : "muted"}>{o.status}</StatusChip>
        </div>
      ))}
    </CardShell>
  )
}

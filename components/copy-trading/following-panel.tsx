"use client"

import * as React from "react"
import { CardShell, EmptyState } from "@/components/ui/system"
import { InlineNotice } from "@/components/ui/flow"
import { copyTradingApi } from "@/lib/copy-trading/api"
import type { Leader, Subscription } from "@/lib/copy-trading/types"
import { StatusChip } from "./parts"

export function FollowingPanel({ subscriptions, leaders, loading, onChanged }: { subscriptions: Subscription[]; leaders: Leader[]; loading: boolean; onChanged: () => void }) {
  const [error, setError] = React.useState<string | null>(null)
  const shown = subscriptions.filter((s) => s.status !== "stopped")
  const name = (id: string) => leaders.find((l) => l.id === id)?.displayName ?? id

  async function run(fn: () => Promise<unknown>) {
    setError(null)
    try { await fn(); onChanged() } catch (e) { setError(e instanceof Error ? e.message : "That didn't work. Try again.") }
  }

  if (loading) return <p className="text-[13px] text-muted-foreground">Loading…</p>
  if (shown.length === 0) return <EmptyState title="You're not copying anyone" description="Pick a trader on the Discover tab and choose how much to allocate." />
  return (
    <div className="flex flex-col gap-2">
      {error && <InlineNotice tone="error">{error}</InlineNotice>}
      {shown.map((s) => (
        <CardShell key={s.id} className="flex flex-col gap-2 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[15px] font-semibold">{name(s.leaderId)}</span>
            <StatusChip tone={s.status === "active" ? "good" : "warn"}>{s.status}</StatusChip>
          </div>
          <p className="text-[13px] text-muted-foreground">
            ${s.allocationUsd.toLocaleString()} allocated · {s.sizing.type === "fixed" ? `$${s.sizing.usdPerTrade} per trade` : "matches their share"} · {s.kinds.map((k) => (k === "perp" ? "Futures" : "Spot")).join(" + ")} · up to {s.maxLeverage}x
            {s.symbols?.length ? ` · ${s.symbols.join(", ")}` : ""}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => run(() => copyTradingApi.setSubscriptionStatus(s.id, s.status === "active" ? "paused" : "active"))} className="rounded-full bg-surface-sunken px-3.5 py-1.5 text-[13px] font-semibold">
              {s.status === "active" ? "Pause" : "Resume"}
            </button>
            <button type="button" onClick={() => run(() => copyTradingApi.stopSubscription(s.id))} className="rounded-full bg-debit-chip px-3.5 py-1.5 text-[13px] font-semibold text-debit">Stop</button>
          </div>
          <p className="text-[12px] text-muted-foreground">Pausing or stopping doesn&rsquo;t close positions already open. Close them from the trade page.</p>
        </CardShell>
      ))}
    </div>
  )
}

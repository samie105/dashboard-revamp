"use client"

/**
 * Recent + pending activity on the dashboard itself.
 *
 * The single biggest reason people re-open a money dashboard is "did it
 * arrive?" — so anything still in flight is pinned to the top with a live
 * status chip, and the latest settled movements sit under it. Rows link
 * nowhere individually; the card is a preview of /transactions, and the
 * header link goes there.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  RepeatIcon,
  Exchange01Icon,
  Clock01Icon,
} from "@hugeicons/core-free-icons"
import { CardHeader, CardShell, EmptyState as SystemEmptyState, SkeletonRows } from "@/components/ui/system"
import { fetchTransactions, type UnifiedTransaction } from "@/lib/crypto-api"
import { useAuth } from "@/components/auth-provider"

const PENDING_STATUSES = new Set(["pending", "processing"])

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60_000)
  if (min < 1) return "Just now"
  if (min < 60) return `${min}m ago`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return days === 1 ? "Yesterday" : `${days}d ago`
}

function txMeta(tx: UnifiedTransaction): {
  label: string
  icon: typeof RepeatIcon
  direction: "in" | "out" | "neutral"
} {
  switch (tx.type) {
    case "deposit":
      return { label: "Deposit", icon: ArrowDown01Icon, direction: "in" }
    case "withdrawal":
      return { label: "Withdrawal", icon: ArrowUp01Icon, direction: "out" }
    case "swap":
      return { label: "Swap", icon: RepeatIcon, direction: "neutral" }
    case "p2p":
      return {
        label: tx.side === "sell" ? "P2P Sell" : "P2P Buy",
        icon: Exchange01Icon,
        direction: tx.side === "sell" ? "out" : "in",
      }
    case "transfer":
      return tx.direction === "incoming"
        ? { label: "Received", icon: ArrowDown01Icon, direction: "in" }
        : { label: "Sent", icon: ArrowUp01Icon, direction: "out" }
    default:
      return { label: tx.type, icon: RepeatIcon, direction: "neutral" }
  }
}

function StatusChip({ status }: { status: UnifiedTransaction["status"] }) {
  if (status === "completed") return null
  if (PENDING_STATUSES.has(status)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-chip px-2 py-0.5 text-[11px] font-semibold text-warning">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warning" />
        {status === "processing" ? "Processing" : "Pending"}
      </span>
    )
  }
  if (status === "failed") {
    return (
      <span className="rounded-full bg-debit-chip px-2 py-0.5 text-[11px] font-semibold text-debit">
        Failed
      </span>
    )
  }
  // cancelled / expired
  return (
    <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

export function ActivityCard() {
  const { user } = useAuth()
  const [transactions, setTransactions] = React.useState<UnifiedTransaction[] | null>(null)

  React.useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      try {
        const page = await fetchTransactions({ limit: "12" })
        if (!cancelled) setTransactions(page.transactions)
      } catch {
        if (!cancelled) setTransactions((prev) => prev ?? [])
      }
    }
    load()
    // Same 30s cadence as the balance polls — pending rows resolve on their own.
    const id = setInterval(load, 30_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [user])

  const rows = React.useMemo(() => {
    if (!transactions) return []
    const pending = transactions.filter((t) => PENDING_STATUSES.has(t.status))
    const settled = transactions.filter((t) => !PENDING_STATUSES.has(t.status))
    return [...pending, ...settled].slice(0, 5)
  }, [transactions])

  const pendingCount = transactions?.filter((t) => PENDING_STATUSES.has(t.status)).length ?? 0

  return (
    <CardShell data-onboarding="dash-activity">
      <CardHeader
        title="Activity"
        subtitle="Your latest movements"
        badge={
          pendingCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-chip px-2 py-0.5 text-[11px] font-semibold text-warning">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warning" />
              {pendingCount} in flight
            </span>
          ) : undefined
        }
        link={{ label: "View all", href: "/transactions" }}
      />

      {transactions === null ? (
        <SkeletonRows rows={4} label="Loading activity" />
      ) : transactions.length === 0 ? (
        <SystemEmptyState
          illustration="noTransactions"
          title="No activity yet"
          description="Deposits, withdrawals and swaps land here the moment they happen"
          ctas={[{ label: "Make a deposit", href: "/portfolio" }]}
        />
      ) : (
        <div className="flex flex-col divide-y divide-border/20 px-1 pb-2">
          {rows.map((tx) => {
            const meta = txMeta(tx)
            const isPending = PENDING_STATUSES.has(tx.status)
            const failed = tx.status === "failed"
            return (
              <div key={tx.id} className="flex items-center gap-3 px-3 py-2.5">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    failed
                      ? "bg-debit-chip"
                      : isPending
                        ? "bg-warning-chip"
                        : "bg-foreground/[0.05]"
                  }`}
                >
                  <HugeiconsIcon
                    icon={isPending ? Clock01Icon : meta.icon}
                    className={`h-[17px] w-[17px] ${
                      failed ? "text-debit" : isPending ? "text-warning" : "text-muted-foreground"
                    }`}
                  />
                </span>
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[13.5px] font-medium">{meta.label}</span>
                    <StatusChip status={tx.status} />
                  </span>
                  <span className="truncate text-[12px] text-muted-foreground">
                    {tx.chain ? `${tx.chain.charAt(0).toUpperCase()}${tx.chain.slice(1)} · ` : ""}
                    {timeAgo(tx.createdAt)}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end leading-tight">
                  <span
                    className={`text-[13.5px] font-semibold tabular-nums ${
                      failed || tx.status === "cancelled"
                        ? "text-muted-foreground line-through"
                        : meta.direction === "in"
                          ? "text-credit"
                          : meta.direction === "out"
                            ? "text-debit"
                            : ""
                    }`}
                  >
                    {meta.direction === "in" ? "+" : meta.direction === "out" ? "−" : ""}
                    {tx.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} {tx.token}
                  </span>
                  {tx.fiatAmount !== undefined && (
                    <span className="text-[11.5px] tabular-nums text-muted-foreground">
                      ${tx.fiatAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </CardShell>
  )
}

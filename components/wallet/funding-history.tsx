"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Clock01Icon,
  RefreshIcon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons"

interface DepositRecord {
  _id: string
  depositAmount: number
  depositChain: "ethereum" | "solana"
  depositToken: string
  status: string
  spotAmount?: number
  createdAt: string
  completedAt?: string
  errorMessage?: string
}

const STATUS_BADGE: Record<string, { label: string; classes: string }> = {
  completed: { label: "Completed", classes: "bg-emerald-500/10 text-emerald-500" },
  failed:    { label: "Failed",    classes: "bg-red-500/10 text-red-500" },
  expired:   { label: "Expired",   classes: "bg-red-500/10 text-red-500" },
}

function getBadge(status: string) {
  return STATUS_BADGE[status] || { label: "In Progress", classes: "bg-amber-500/10 text-amber-500" }
}

const CHAIN_ICONS: Record<string, string> = {
  ethereum: "https://tse3.mm.bing.net/th/id/OIP.Rbhwx2hMogpqEO08SXJShwHaLo?rs=1&pid=ImgDetMain&o=7&rm=3",
  solana: "https://th.bing.com/th/id/OIP.hnScG3zE2G41YaH7Iir9zAHaHa?w=153&h=180&c=7&r=0&o=7&dpr=1.3&pid=1.7&rm=3",
}

export function FundingHistory({ refreshKey = 0 }: { refreshKey?: number }) {
  const [deposits, setDeposits] = React.useState<DepositRecord[]>([])
  const [loading, setLoading] = React.useState(true)

  const fetchHistory = React.useCallback(async () => {
    try {
      const res = await fetch("/api/spot/deposit/history")
      const data = await res.json()
      if (data.success) setDeposits(data.data || [])
    } catch {
      /* silently fail */
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchHistory()
  }, [fetchHistory, refreshKey])

  if (loading) {
    return (
      <div className="rounded-2xl bg-card border border-border/30 p-5">
        <div className="flex items-center gap-2 animate-pulse">
          <div className="w-4 h-4 rounded bg-accent" />
          <div className="h-3 w-24 rounded bg-accent" />
        </div>
      </div>
    )
  }

  if (deposits.length === 0) return null

  return (
    <div className="rounded-2xl bg-card border border-border/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/20">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={Clock01Icon} className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Recent Transfers</span>
        </div>
        <button
          onClick={fetchHistory}
          className="rounded p-1 transition-colors hover:bg-accent"
        >
          <HugeiconsIcon icon={RefreshIcon} className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>

      {/* List */}
      <div className="divide-y divide-border/20">
        {deposits.map((d) => {
          const badge = getBadge(d.status)
          const date = new Date(d.createdAt)
          const chainIcon = CHAIN_ICONS[d.depositChain]
          return (
            <div key={d._id} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-accent/50 flex items-center justify-center">
                  {chainIcon ? (
                    <img src={chainIcon} alt={d.depositChain} className="h-3.5 w-3.5 rounded-full" />
                  ) : (
                    <HugeiconsIcon
                      icon={d.status === "completed" ? CheckmarkCircle02Icon : d.status === "failed" ? Cancel01Icon : Clock01Icon}
                      className="h-3.5 w-3.5 text-muted-foreground"
                    />
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">
                    {d.depositAmount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    {d.depositToken}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60">
                    {date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    {" · "}
                    {date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badge.classes}`}>
                {badge.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

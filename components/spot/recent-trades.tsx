"use client"

import * as React from "react"
import type { TradeResult } from "@/lib/actions"

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

export function RecentTrades({
  trades,
  currentPrice,
}: {
  trades: TradeResult[]
  currentPrice: number
}) {
  const priceDecimals = currentPrice < 1 ? 6 : currentPrice < 100 ? 4 : 2
  const listRef = React.useRef<HTMLDivElement>(null)
  const [flash, setFlash] = React.useState<Set<string>>(new Set())
  const prevIdsRef = React.useRef<Set<string>>(new Set())

  // Flash new trades
  React.useEffect(() => {
    const newIds = new Set<string>()
    trades.forEach((t) => {
      if (!prevIdsRef.current.has(t.id)) newIds.add(t.id)
    })
    prevIdsRef.current = new Set(trades.map((t) => t.id))
    if (newIds.size > 0) {
      setFlash(newIds)
      const timer = setTimeout(() => setFlash(new Set()), 500)
      return () => clearTimeout(timer)
    }
  }, [trades])

  return (
    <div className="flex h-full flex-col rounded-xl bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/20 px-3 py-2 shrink-0">
        <span className="text-xs font-semibold">Recent Trades</span>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[10px] text-muted-foreground">Live</span>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-3 gap-1 px-3 py-1 text-[10px] text-muted-foreground font-medium shrink-0">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Time</span>
      </div>

      {/* Trade rows */}
      <div ref={listRef} className="flex-1 overflow-y-auto slim-scroll">
        {trades.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-[11px] text-muted-foreground">Waiting for trades…</p>
          </div>
        ) : (
          trades.map((trade) => {
            const isBuy = trade.side === "buy"
            const isNew = flash.has(trade.id)
            return (
              <div
                key={trade.id}
                className={`grid grid-cols-3 gap-1 px-3 py-[3px] transition-colors duration-300 ${
                  isNew ? (isBuy ? "bg-emerald-500/15" : "bg-red-500/15") : ""
                }`}
              >
                <span
                  className={`text-[11px] tabular-nums font-medium ${
                    isBuy ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {parseFloat(trade.price).toFixed(priceDecimals)}
                </span>
                <span className="text-right text-[11px] tabular-nums text-foreground/80">
                  {parseFloat(trade.amount).toFixed(4)}
                </span>
                <span className="text-right text-[11px] tabular-nums text-muted-foreground">
                  {formatTime(trade.time)}
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

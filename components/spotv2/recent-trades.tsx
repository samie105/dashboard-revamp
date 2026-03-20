"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import type { TradeTick } from "@/hooks/useMarketDataSSE"

// ── Helpers ──────────────────────────────────────────────────────────────

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function formatPrice(price: number): string {
  if (price < 1) return price.toPrecision(4)
  if (price < 100) return price.toFixed(4)
  return price.toFixed(2)
}

function formatQty(qty: number): string {
  if (qty >= 1_000) return `${(qty / 1_000).toFixed(1)}K`
  if (qty >= 1) return qty.toFixed(4)
  return qty.toPrecision(3)
}

// ── Flash detection ──────────────────────────────────────────────────────

const FLASH_MS = 500

function useNewTradeFlash(trades: TradeTick[]): Set<number> {
  const prevIdsRef = React.useRef<Set<number>>(new Set())
  const [flash, setFlash] = React.useState<Set<number>>(new Set())

  React.useEffect(() => {
    const newIds = new Set<number>()
    for (const t of trades) {
      if (!prevIdsRef.current.has(t.id)) {
        newIds.add(t.id)
      }
    }

    prevIdsRef.current = new Set(trades.map((t) => t.id))

    if (newIds.size > 0) {
      setFlash(newIds)
      const timer = setTimeout(() => setFlash(new Set()), FLASH_MS)
      return () => clearTimeout(timer)
    }
  }, [trades])

  return flash
}

// ── Component ────────────────────────────────────────────────────────────

interface SpotV2RecentTradesProps {
  trades: TradeTick[]
  connected: boolean
  unavailable: boolean
}

export function SpotV2RecentTrades({
  trades,
  connected,
  unavailable,
}: SpotV2RecentTradesProps) {
  const flash = useNewTradeFlash(trades)

  if (unavailable) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs text-muted-foreground/50">Trades unavailable for this pair</p>
      </div>
    )
  }

  if (!connected && trades.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
          <span className="text-xs text-muted-foreground/60">Connecting…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden text-[11px]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/10 px-2 py-1.5">
        <span className="font-medium text-muted-foreground/70">Recent Trades</span>
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              connected ? "bg-emerald-400" : "bg-yellow-400 animate-pulse",
            )}
          />
          <span className="text-[10px] text-muted-foreground/40">
            {connected ? "Live" : "…"}
          </span>
        </div>
      </div>

      {/* Column labels */}
      <div className="grid grid-cols-3 px-2 py-1 text-[10px] text-muted-foreground/40">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Time</span>
      </div>

      {/* Trade rows */}
      <div className="flex-1 overflow-y-auto slim-scroll">
        {trades.map((t) => {
          // isBuyerMaker = true ⇒ the taker was selling (show red)
          const isSell = t.isBuyerMaker
          return (
            <div
              key={t.id}
              className={cn(
                "grid grid-cols-3 items-center px-2 py-px transition-colors",
                flash.has(t.id) && (isSell ? "bg-red-500/10" : "bg-emerald-500/10"),
              )}
            >
              <span
                className={cn(
                  "tabular-nums",
                  isSell ? "text-red-400" : "text-emerald-400",
                )}
              >
                {formatPrice(t.price)}
              </span>
              <span className="text-right tabular-nums text-muted-foreground/70">
                {formatQty(t.qty)}
              </span>
              <span className="text-right tabular-nums text-muted-foreground/50">
                {formatTime(t.time)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

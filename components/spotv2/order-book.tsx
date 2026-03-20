"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import type { OrderBookLevel } from "@/hooks/useMarketDataSSE"

// ── Helpers ──────────────────────────────────────────────────────────────

function decimals(price: number): number {
  if (price < 1) return 6
  if (price < 100) return 4
  return 2
}

function formatPrice(price: number): string {
  return price.toLocaleString("en-US", {
    minimumFractionDigits: decimals(price),
    maximumFractionDigits: decimals(price),
  })
}

function formatQty(qty: number): string {
  if (qty >= 1_000) return `${(qty / 1_000).toFixed(1)}K`
  if (qty >= 1) return qty.toFixed(2)
  return qty.toPrecision(4)
}

// ── Price-level flash detection ──────────────────────────────────────────

const FLASH_MS = 400

function useLevelFlash(levels: OrderBookLevel[]): Set<number> {
  const prevRef = React.useRef<Map<number, number>>(new Map())
  const [flash, setFlash] = React.useState<Set<number>>(new Set())

  React.useEffect(() => {
    const changed = new Set<number>()
    for (const l of levels) {
      const prev = prevRef.current.get(l.price)
      if (prev !== undefined && prev !== l.amount) {
        changed.add(l.price)
      }
    }

    // Rebuild map for next comparison
    const nextMap = new Map<number, number>()
    for (const l of levels) nextMap.set(l.price, l.amount)
    prevRef.current = nextMap

    if (changed.size > 0) {
      setFlash(changed)
      const t = setTimeout(() => setFlash(new Set()), FLASH_MS)
      return () => clearTimeout(t)
    }
  }, [levels])

  return flash
}

// ── Component ────────────────────────────────────────────────────────────

interface SpotV2OrderBookProps {
  bids: OrderBookLevel[]
  asks: OrderBookLevel[]
  connected: boolean
  unavailable: boolean
}

export function SpotV2OrderBook({
  bids,
  asks,
  connected,
  unavailable,
}: SpotV2OrderBookProps) {
  const askFlash = useLevelFlash(asks)
  const bidFlash = useLevelFlash(bids)

  const maxTotal = React.useMemo(() => {
    const maxBid = bids.length > 0 ? bids[bids.length - 1].total : 0
    const maxAsk = asks.length > 0 ? asks[asks.length - 1].total : 0
    return Math.max(maxBid, maxAsk, 1)
  }, [bids, asks])

  // Mid price + spread
  const spread = React.useMemo(() => {
    if (bids.length === 0 || asks.length === 0) return null
    const bestBid = bids[0].price
    const bestAsk = asks[0].price
    const mid = (bestBid + bestAsk) / 2
    const spreadPct = ((bestAsk - bestBid) / mid) * 100
    return { mid, spreadPct }
  }, [bids, asks])

  if (unavailable) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs text-muted-foreground/50">Order book unavailable for this pair</p>
      </div>
    )
  }

  if (!connected && bids.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
          <span className="text-xs text-muted-foreground/60">Connecting…</span>
        </div>
      </div>
    )
  }

  // Show top 12 asks (lowest first, reversed for display so lowest is at bottom)
  const visibleAsks = asks.slice(0, 12).reverse()
  const visibleBids = bids.slice(0, 12)

  return (
    <div className="flex h-full flex-col overflow-hidden text-[11px]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/10 px-2 py-1.5">
        <span className="font-medium text-muted-foreground/70">Order Book</span>
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
        <span className="text-right">Total</span>
      </div>

      {/* Asks (sells) — lowest at bottom */}
      <div className="flex flex-1 flex-col justify-end overflow-hidden">
        {visibleAsks.map((row) => {
          const barW = (row.total / maxTotal) * 100
          return (
            <div
              key={row.price}
              className={cn(
                "relative grid grid-cols-3 items-center px-2 py-px transition-colors",
                askFlash.has(row.price) && "bg-red-500/10",
              )}
            >
              {/* Depth bar */}
              <div
                className="pointer-events-none absolute inset-y-0 right-0 bg-red-500/5"
                style={{ width: `${barW}%` }}
              />
              <span className="relative z-10 tabular-nums text-red-400">
                {formatPrice(row.price)}
              </span>
              <span className="relative z-10 text-right tabular-nums text-muted-foreground/70">
                {formatQty(row.amount)}
              </span>
              <span className="relative z-10 text-right tabular-nums text-muted-foreground/50">
                {formatQty(row.total)}
              </span>
            </div>
          )
        })}
      </div>

      {/* Spread / mid price */}
      {spread && (
        <div className="flex items-center justify-center gap-2 border-y border-border/10 py-1.5">
          <span className="font-semibold tabular-nums">
            {formatPrice(spread.mid)}
          </span>
          <span className="text-[10px] text-muted-foreground/40">
            Spread {spread.spreadPct.toFixed(3)}%
          </span>
        </div>
      )}

      {/* Bids (buys) — highest at top */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {visibleBids.map((row) => {
          const barW = (row.total / maxTotal) * 100
          return (
            <div
              key={row.price}
              className={cn(
                "relative grid grid-cols-3 items-center px-2 py-px transition-colors",
                bidFlash.has(row.price) && "bg-emerald-500/10",
              )}
            >
              <div
                className="pointer-events-none absolute inset-y-0 right-0 bg-emerald-500/5"
                style={{ width: `${barW}%` }}
              />
              <span className="relative z-10 tabular-nums text-emerald-400">
                {formatPrice(row.price)}
              </span>
              <span className="relative z-10 text-right tabular-nums text-muted-foreground/70">
                {formatQty(row.amount)}
              </span>
              <span className="relative z-10 text-right tabular-nums text-muted-foreground/50">
                {formatQty(row.total)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

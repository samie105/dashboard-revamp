"use client"

/**
 * OrderBook — the exchange-standard vertical book: asks stacked above a large
 * mid-price row, bids below, cumulative depth bars growing from the right,
 * and a buy/sell pressure bar at the foot. Clicking any level hands its price
 * to the ticket (which flips to a limit order) — the interaction every
 * Binance/Bybit user expects from a book.
 *
 * Pure display component: data arrives via props, polling stays in the page.
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import type { HlOrderBook } from "@/lib/hl-public"

function fmtPrice(p: number) {
  return p.toLocaleString(undefined, { maximumFractionDigits: p < 1 ? 6 : 2 })
}

function fmtSize(s: number) {
  if (s >= 1000) return s.toLocaleString(undefined, { maximumFractionDigits: 0 })
  if (s >= 1) return s.toFixed(3)
  return s.toFixed(5)
}

function Row({
  price,
  size,
  total,
  maxTotal,
  side,
  onPick,
}: {
  price: number
  size: number
  total: number
  maxTotal: number
  side: "bid" | "ask"
  onPick: (price: number) => void
}) {
  return (
    <button
      onClick={() => onPick(price)}
      className="relative grid w-full grid-cols-[1fr_auto] gap-2 px-3 py-[3px] text-left text-[11px] leading-4 tabular-nums transition-colors hover:bg-accent/50"
      title={`Set limit price ${fmtPrice(price)}`}
    >
      <span
        className={cn(
          "absolute inset-y-0 right-0 opacity-90",
          side === "bid" ? "bg-credit-chip" : "bg-debit-chip",
        )}
        style={{ width: `${Math.min(100, (total / (maxTotal || 1)) * 100)}%` }}
      />
      <span className={cn("relative font-medium", side === "bid" ? "text-credit" : "text-debit")}>
        {fmtPrice(price)}
      </span>
      <span className="relative text-muted-foreground">{fmtSize(size)}</span>
    </button>
  )
}

export function OrderBook({
  book,
  /** Direction of the last mid-price move, for the arrow beside mid. */
  lastTick,
  onPickPrice,
  /** Levels per side. The list is windowed to fit the pane. */
  depth = 9,
  className,
}: {
  book: HlOrderBook | null
  lastTick: "up" | "down" | null
  onPickPrice: (price: number) => void
  depth?: number
  className?: string
}) {
  if (!book) {
    return (
      <div className={cn("flex flex-col gap-1 p-3", className)}>
        <div className="flex items-center justify-between px-0.5 pb-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">Order book</span>
        </div>
        {Array.from({ length: 2 * depth + 1 }).map((_, i) => (
          <div key={i} className="h-[18px] animate-pulse rounded bg-surface-sunken/70" />
        ))}
      </div>
    )
  }

  // Asks render top-down from worst to best so the touch meets the mid row.
  const asks = book.asks.slice(0, depth).reverse()
  const bids = book.bids.slice(0, depth)
  const maxTotal = Math.max(
    book.asks[Math.min(depth, book.asks.length) - 1]?.total ?? 0,
    book.bids[Math.min(depth, book.bids.length) - 1]?.total ?? 0,
  )
  const buyPct = Math.round(book.buyRatio * 100)

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex items-center justify-between px-3 pb-1 pt-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">Order book</span>
        <span className="text-[10px] tabular-nums text-subtle">spread {fmtPrice(book.spread)}</span>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2 px-3 pb-1 text-[10px] uppercase tracking-wide text-subtle">
        <span>Price</span>
        <span>Size</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-end">
        {asks.map((l) => (
          <Row key={`a${l.price}`} {...l} maxTotal={maxTotal} side="ask" onPick={onPickPrice} />
        ))}
      </div>

      {/* Mid — the row the whole pane hangs on. */}
      <button
        onClick={() => onPickPrice(book.midPrice)}
        className="flex items-center justify-between border-y border-border/30 bg-surface-sunken/60 px-3 py-1.5 transition-colors hover:bg-accent/50"
        title="Set limit price to mid"
      >
        <span
          className={cn(
            "text-[15px] font-bold tabular-nums",
            lastTick === "up" && "text-credit",
            lastTick === "down" && "text-debit",
          )}
        >
          {fmtPrice(book.midPrice)}
          {lastTick && <span className="ml-1 text-[11px]">{lastTick === "up" ? "▲" : "▼"}</span>}
        </span>
        <span className="text-[10px] text-subtle">mid</span>
      </button>

      <div className="flex min-h-0 flex-1 flex-col">
        {bids.map((l) => (
          <Row key={`b${l.price}`} {...l} maxTotal={maxTotal} side="bid" onPick={onPickPrice} />
        ))}
      </div>

      {/* Buy/sell pressure across the visible depth. */}
      <div className="px-3 pb-3 pt-2">
        <div className="flex items-center justify-between pb-1 text-[10px] tabular-nums">
          <span className="font-semibold text-credit">B {buyPct}%</span>
          <span className="font-semibold text-debit">{100 - buyPct}% S</span>
        </div>
        <div className="flex h-1 overflow-hidden rounded-full bg-debit/60">
          <div className="h-full rounded-full bg-credit" style={{ width: `${buyPct}%` }} />
        </div>
      </div>
    </div>
  )
}

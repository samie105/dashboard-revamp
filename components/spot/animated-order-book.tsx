"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowUpRight01Icon,
  ArrowDownRight01Icon,
} from "@hugeicons/core-free-icons"
import type { OrderBookLevel } from "@/lib/actions"

export function AnimatedOrderBook({
  currentPrice,
  asks: rawAsks,
  bids: rawBids,
}: {
  currentPrice: number
  asks: OrderBookLevel[]
  bids: OrderBookLevel[]
}) {
  const prevAsksRef = React.useRef<Map<number, number>>(new Map())
  const prevBidsRef = React.useRef<Map<number, number>>(new Map())
  const [flashAsks, setFlashAsks] = React.useState<Set<number>>(new Set())
  const [flashBids, setFlashBids] = React.useState<Set<number>>(new Set())

  const asks = rawAsks.length > 0 ? rawAsks.slice(-14) : []
  const bids = rawBids.length > 0 ? rawBids.slice(0, 14) : []

  const maxTotal = Math.max(
    asks[0]?.total ?? 0,
    bids[bids.length - 1]?.total ?? 0,
    1,
  )
  const priceDecimals =
    currentPrice < 1 ? 6 : currentPrice < 100 ? 4 : 2

  const bestAsk =
    asks.length > 0 ? asks[asks.length - 1].price : currentPrice
  const bestBid = bids.length > 0 ? bids[0].price : currentPrice
  const spread = bestAsk - bestBid
  const spreadPct = bestAsk > 0 ? (spread / bestAsk) * 100 : 0

  // Flash animation on ask changes
  React.useEffect(() => {
    const changed = new Set<number>()
    asks.forEach((a) => {
      const prev = prevAsksRef.current.get(a.price)
      if (prev !== undefined && prev !== a.amount) changed.add(a.price)
    })
    prevAsksRef.current = new Map(asks.map((a) => [a.price, a.amount]))
    if (changed.size > 0) {
      setFlashAsks(changed)
      const t = setTimeout(() => setFlashAsks(new Set()), 400)
      return () => clearTimeout(t)
    }
  }, [asks])

  // Flash animation on bid changes
  React.useEffect(() => {
    const changed = new Set<number>()
    bids.forEach((b) => {
      const prev = prevBidsRef.current.get(b.price)
      if (prev !== undefined && prev !== b.amount) changed.add(b.price)
    })
    prevBidsRef.current = new Map(bids.map((b) => [b.price, b.amount]))
    if (changed.size > 0) {
      setFlashBids(changed)
      const t = setTimeout(() => setFlashBids(new Set()), 400)
      return () => clearTimeout(t)
    }
  }, [bids])

  return (
    <div className="flex h-full flex-col rounded-xl bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/20 px-3 py-2">
        <span className="text-xs font-semibold">Order Book</span>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[10px] text-muted-foreground">Live</span>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-3 gap-1 px-3 py-1 text-[10px] text-muted-foreground font-medium">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Total</span>
      </div>

      {/* Asks — lowest ask at bottom */}
      <div className="flex-1 flex flex-col justify-end overflow-hidden">
        {asks.map((row, i) => {
          const barW = (row.total / maxTotal) * 100
          const isFlash = flashAsks.has(row.price)
          return (
            <div
              key={`a-${i}`}
              className={`relative grid grid-cols-3 gap-1 px-3 py-[3px] transition-colors duration-300 ${isFlash ? "bg-red-500/15" : ""}`}
            >
              <div
                className="absolute inset-y-0 right-0 bg-red-500/[0.06] transition-all duration-500"
                style={{ width: `${barW}%` }}
              />
              <span className="relative z-10 text-[11px] tabular-nums text-red-400">
                {row.price.toFixed(priceDecimals)}
              </span>
              <span
                className={`relative z-10 text-right text-[11px] tabular-nums transition-all duration-300 ${isFlash ? "scale-105 text-red-300" : ""}`}
              >
                {row.amount.toFixed(4)}
              </span>
              <span className="relative z-10 text-right text-[11px] tabular-nums text-muted-foreground">
                {row.total.toFixed(4)}
              </span>
            </div>
          )
        })}
      </div>

      {/* Spread / current price */}
      <div className="flex items-center justify-between border-y border-border/20 px-3 py-2 bg-accent/20">
        <div className="flex items-center gap-1.5">
          <span className="text-base font-bold tabular-nums text-foreground">
            $
            {currentPrice.toLocaleString(undefined, {
              minimumFractionDigits: priceDecimals,
              maximumFractionDigits: priceDecimals,
            })}
          </span>
          <HugeiconsIcon
            icon={
              currentPrice >= (bids[0]?.price ?? 0)
                ? ArrowUpRight01Icon
                : ArrowDownRight01Icon
            }
            className={`h-4 w-4 ${currentPrice >= (bids[0]?.price ?? 0) ? "text-emerald-500" : "text-red-500"}`}
          />
        </div>
        <div className="text-right">
          <span className="text-[10px] text-muted-foreground">
            Spread:{" "}
            <span className="text-foreground font-medium">
              {spread.toFixed(priceDecimals)}
            </span>{" "}
            <span className="text-foreground/60">
              ({spreadPct.toFixed(3)}%)
            </span>
          </span>
        </div>
      </div>

      {/* Bids */}
      <div className="flex-1 overflow-hidden">
        {bids.map((row, i) => {
          const barW = (row.total / maxTotal) * 100
          const isFlash = flashBids.has(row.price)
          return (
            <div
              key={`b-${i}`}
              className={`relative grid grid-cols-3 gap-1 px-3 py-[3px] transition-colors duration-300 ${isFlash ? "bg-emerald-500/15" : ""}`}
            >
              <div
                className="absolute inset-y-0 right-0 bg-emerald-500/[0.06] transition-all duration-500"
                style={{ width: `${barW}%` }}
              />
              <span className="relative z-10 text-[11px] tabular-nums text-emerald-400">
                {row.price.toFixed(priceDecimals)}
              </span>
              <span
                className={`relative z-10 text-right text-[11px] tabular-nums transition-all duration-300 ${isFlash ? "scale-105 text-emerald-300" : ""}`}
              >
                {row.amount.toFixed(4)}
              </span>
              <span className="relative z-10 text-right text-[11px] tabular-nums text-muted-foreground">
                {row.total.toFixed(4)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

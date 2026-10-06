"use client"

/**
 * Order book and trades tape, as two tabs of one panel.
 *
 * The book reads top-down the way traders expect: asks (red) descending to
 * the spread, the last price in the middle, bids (green) below. Depth bars
 * grow from the right with cumulative size. Click any level and the order
 * form switches to Limit at that price — the book is an input, not a poster.
 *
 * Both tick after mount (sizes shuffle, fills arrive) so the panel feels
 * live. The price itself never moves: it's the same figure the markets page,
 * the header and the ticket quote, and a demo wobbling it would undo that.
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import { formatPrice, type Book, type Fill, type Market } from "@/components/trade-unauth/trade-data"
import { Panel, UnderlineTabs } from "@/components/redesign/ui"

type Tab = "book" | "trades"
type View = "both" | "bids" | "asks"

function fmtSize(v: number) {
  return v >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : v >= 1 ? v.toFixed(3) : v.toFixed(5)
}

/** Shuffle a few level sizes every tick; remember which changed so the row
 *  can flash. Client-only — the server render is the seeded book. */
function useLiveBook(book: Book) {
  const [live, setLive] = React.useState(book)
  const [flash, setFlash] = React.useState<Set<string>>(new Set())
  React.useEffect(() => setLive(book), [book])
  React.useEffect(() => {
    const t = window.setInterval(() => {
      const changed = new Set<string>()
      const jiggle = (levels: Book["bids"], side: string) => {
        let total = 0
        return levels.map((l, i) => {
          let size = l.size
          if (Math.random() < 0.18) {
            size = Math.max(l.size * 0.2, l.size * (0.7 + Math.random() * 0.6))
            changed.add(`${side}${i}`)
          }
          total += size
          return { ...l, size, total }
        })
      }
      setLive((b) => ({ ...b, bids: jiggle(b.bids, "b"), asks: jiggle(b.asks, "a") }))
      setFlash(changed)
    }, 1400)
    return () => window.clearInterval(t)
  }, [])
  return { live, flash }
}

function useLiveTape(tape: Fill[], market: Market) {
  const [fills, setFills] = React.useState(tape)
  const [fresh, setFresh] = React.useState<string | null>(null)
  React.useEffect(() => setFills(tape), [tape])
  React.useEffect(() => {
    let n = 0
    const t = window.setInterval(() => {
      const side: Fill["side"] = Math.random() > 0.48 ? "buy" : "sell"
      const tick = market.price >= 1000 ? 0.5 : market.price >= 1 ? 0.01 : market.price * 0.0005
      const now = new Date()
      const id = `live-${market.id}-${n++}`
      setFills((f) => [
        {
          id,
          side,
          price: market.price + (Math.random() - 0.5) * tick * 6,
          size: (0.2 + Math.random() * 2.4) * (market.price >= 1000 ? 0.05 : 12),
          time: now.toTimeString().slice(0, 8),
        },
        ...f.slice(0, 29),
      ])
      setFresh(id)
    }, 2200)
    return () => window.clearInterval(t)
  }, [market])
  return { fills, fresh }
}

export function BookPanel({
  market,
  book,
  tape,
  onPick,
  className,
}: {
  market: Market
  book: Book
  tape: Fill[]
  onPick: (price: number) => void
  className?: string
}) {
  const [tab, setTab] = React.useState<Tab>("book")
  const [view, setView] = React.useState<View>("both")
  const { live, flash } = useLiveBook(book)
  const { fills, fresh } = useLiveTape(tape, market)
  const rows = view === "both" ? 9 : 18
  const asks = live.asks.slice(0, rows)
  const bids = live.bids.slice(0, rows)
  const maxTotal = Math.max(asks[asks.length - 1]?.total ?? 1, bids[bids.length - 1]?.total ?? 1)
  const bidShare = bids.reduce((s, l) => s + l.size, 0) / (bids.reduce((s, l) => s + l.size, 0) + asks.reduce((s, l) => s + l.size, 0) || 1)
  const up = market.changePct >= 0

  const level = (l: Book["bids"][number], side: "a" | "b", i: number) => (
    <button
      key={`${side}${i}`}
      type="button"
      onClick={() => onPick(l.price)}
      title="Use this price"
      className={cn(
        "group relative grid h-[22px] w-full grid-cols-3 items-center px-3 text-[12px] tabular-nums transition-colors hover:bg-white/[0.05]",
        flash.has(`${side}${i}`) && (side === "a" ? "animate-[book-flash-a_0.6s_ease-out]" : "animate-[book-flash-b_0.6s_ease-out]"),
      )}
    >
      <span
        aria-hidden
        className={cn("absolute inset-y-[2px] right-0 rounded-l-sm transition-[width] duration-500", side === "a" ? "bg-debit/[0.13]" : "bg-credit/[0.13]")}
        style={{ width: `${(l.total / maxTotal) * 100}%` }}
      />
      <span className={cn("relative text-left font-medium", side === "a" ? "text-debit" : "text-credit")}>{formatPrice(l.price)}</span>
      <span className="relative text-right text-foreground/80">{fmtSize(l.size)}</span>
      <span className="relative text-right text-muted-foreground">{fmtSize(l.total)}</span>
    </button>
  )

  return (
    <Panel className={cn("flex flex-col", className)}>
      <div className="flex items-end justify-between border-b border-white/[0.06] px-3 pt-2">
        <UnderlineTabs
          id="book-tabs"
          options={[
            { key: "book", label: "Order book" },
            { key: "trades", label: "Trades" },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === "book" && (
          <div className="mb-2.5 flex gap-1" role="group" aria-label="Book view">
            {(["both", "bids", "asks"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                title={v === "both" ? "Bids and asks" : v === "bids" ? "Bids only" : "Asks only"}
                className={cn("flex size-6 flex-col justify-center gap-[2px] rounded-md p-1 transition-colors", view === v ? "bg-white/[0.08]" : "hover:bg-white/[0.04]")}
              >
                {[0, 1, 2].map((k) => (
                  <span
                    key={k}
                    className={cn(
                      "h-[3px] rounded-full",
                      v === "both" ? (k < 1 ? "bg-debit/80" : k > 1 ? "bg-credit/80" : "bg-white/30") : v === "bids" ? "bg-credit/80" : "bg-debit/80",
                    )}
                  />
                ))}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === "book" ? (
        <div className="flex flex-1 flex-col py-1.5">
          <div className="grid grid-cols-3 px-3 pb-1 text-[11px] font-medium text-muted-foreground">
            <span>Price ({market.quote})</span>
            <span className="text-right">Size ({market.base})</span>
            <span className="text-right">Total</span>
          </div>
          {view !== "bids" && (
            <div className="flex flex-col-reverse">
              {asks.map((l, i) => level(l, "a", i))}
            </div>
          )}
          <div className="my-1 flex items-center justify-between border-y border-white/[0.05] bg-white/[0.02] px-3 py-2">
            <span className={cn("font-display text-[17px] font-semibold tabular-nums", up ? "text-credit" : "text-debit")}>{formatPrice(market.price)}</span>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              Spread {formatPrice(live.spread)} · {live.spreadPct.toFixed(3)}%
            </span>
          </div>
          {view !== "asks" && bids.map((l, i) => level(l, "b", i))}
          {/* Who's leaning harder — bids vs asks across the visible levels. */}
          <div className="mt-auto flex items-center gap-2 px-3 pb-1 pt-2.5 text-[11px] font-semibold tabular-nums">
            <span className="text-credit">B {Math.round(bidShare * 100)}%</span>
            <span className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-debit/70">
              <span className="h-full bg-credit/80 transition-[width] duration-700" style={{ width: `${bidShare * 100}%` }} />
            </span>
            <span className="text-debit">{Math.round((1 - bidShare) * 100)}% S</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col py-1.5">
          <div className="grid grid-cols-3 px-3 pb-1 text-[11px] font-medium text-muted-foreground">
            <span>Price ({market.quote})</span>
            <span className="text-right">Size</span>
            <span className="text-right">Time</span>
          </div>
          <div className="slim-scroll max-h-[476px] overflow-y-auto">
            {fills.map((f) => (
              <div
                key={f.id}
                className={cn(
                  "grid h-[22px] grid-cols-3 items-center px-3 text-[12px] tabular-nums",
                  f.id === fresh && (f.side === "buy" ? "animate-[book-flash-b_0.8s_ease-out]" : "animate-[book-flash-a_0.8s_ease-out]"),
                )}
              >
                <span className={cn("font-medium", f.side === "buy" ? "text-credit" : "text-debit")}>{formatPrice(f.price)}</span>
                <span className="text-right text-foreground/80">{fmtSize(f.size)}</span>
                <span className="text-right text-muted-foreground">{f.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  )
}

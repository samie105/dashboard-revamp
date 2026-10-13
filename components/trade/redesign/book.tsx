"use client"

/**
 * The preview's order book and trades tape (components/trade-unauth/book.tsx),
 * as two tabs of one panel, on real data.
 *
 * Kept from the preview: the tabs, the both / bids / asks view, depth bars,
 * a click on a level filling the form's price, rows that flash when they
 * change, the spread line and the bid/ask balance bar.
 * Swapped for real data: the levels are the venue's live book (polled by the
 * page) and the tape is real prints. Added because real data can be missing:
 * a loading state, and a market with no order book (a spot token that trades
 * only through a pool) says so in place of the ladder.
 */

import * as React from "react"

import { cn } from "@/lib/utils"
import { Panel, UnderlineTabs } from "@/components/dashboard/redesign/ui"
import { formatPrice } from "@/components/trade/redesign/candle-chart"
import type { HlOrderBook, TapeFill } from "@/lib/hl-public"

type Tab = "book" | "trades"
type View = "both" | "bids" | "asks"

function fmtSize(v: number) {
  return v >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : v >= 1 ? v.toFixed(3) : v.toFixed(5)
}

const clock = (ms: number) => new Date(ms).toTimeString().slice(0, 8)

/** Which levels changed size since the last poll, so their rows can flash. */
function useFlash(book: HlOrderBook | null) {
  const prev = React.useRef<HlOrderBook | null>(null)
  const [flash, setFlash] = React.useState<Set<string>>(new Set())
  React.useEffect(() => {
    if (!book) return
    const was = prev.current
    prev.current = book
    if (!was) return
    const changed = new Set<string>()
    book.asks.forEach((l, i) => was.asks[i] && was.asks[i].size !== l.size && changed.add(`a${i}`))
    book.bids.forEach((l, i) => was.bids[i] && was.bids[i].size !== l.size && changed.add(`b${i}`))
    setFlash(changed)
  }, [book])
  return flash
}

export function BookPanel({
  base,
  quote,
  price,
  changePct,
  book,
  bookState,
  trades,
  onPick,
  className,
}: {
  base: string
  quote: string
  price: number
  changePct: number | null
  book: HlOrderBook | null
  /** "none": this market has no order book (pool-only spot token). */
  bookState: "loading" | "ready" | "none"
  /** null while loading. */
  trades: TapeFill[] | null
  onPick: (price: number) => void
  className?: string
}) {
  const [tab, setTab] = React.useState<Tab>("book")
  const [view, setView] = React.useState<View>("both")
  const flash = useFlash(book)
  const [freshId, setFreshId] = React.useState<string | null>(null)
  const topTrade = trades?.[0]?.id ?? null
  const lastTop = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (topTrade && lastTop.current && topTrade !== lastTop.current) setFreshId(topTrade)
    lastTop.current = topTrade
  }, [topTrade])

  const rows = view === "both" ? 9 : 18
  const asks = book?.asks.slice(0, rows) ?? []
  const bids = book?.bids.slice(0, rows) ?? []
  const maxTotal = Math.max(asks[asks.length - 1]?.total ?? 1, bids[bids.length - 1]?.total ?? 1)
  const bidShare = book?.buyRatio ?? 0.5
  const up = (changePct ?? 0) >= 0
  const mid = book?.midPrice || price
  const spreadPct = book && mid > 0 ? (book.spread / mid) * 100 : 0

  const level = (l: { price: number; size: number; total: number }, side: "a" | "b", i: number) => (
    <button
      key={`${side}${i}`}
      type="button"
      onClick={() => onPick(l.price)}
      title="Use this price"
      className={cn(
        "group relative grid h-[22px] w-full grid-cols-3 items-center px-3 text-[12px] tabular-nums transition-colors hover:bg-foreground/[0.05]",
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
      <div className="flex items-end justify-between border-b border-foreground/[0.06] px-3 pt-2">
        <UnderlineTabs
          id="book-tabs"
          options={[
            { key: "book", label: "Order book" },
            { key: "trades", label: "Trades" },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === "book" && bookState === "ready" && (
          <div className="mb-2.5 flex gap-1" role="group" aria-label="Book view">
            {(["both", "bids", "asks"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                title={v === "both" ? "Bids and asks" : v === "bids" ? "Bids only" : "Asks only"}
                className={cn("flex size-6 flex-col justify-center gap-[2px] rounded-md p-1 transition-colors", view === v ? "bg-foreground/[0.08]" : "hover:bg-foreground/[0.04]")}
              >
                {[0, 1, 2].map((k) => (
                  <span
                    key={k}
                    className={cn(
                      "h-[3px] rounded-full",
                      v === "both" ? (k < 1 ? "bg-debit/80" : k > 1 ? "bg-credit/80" : "bg-foreground/30") : v === "bids" ? "bg-credit/80" : "bg-debit/80",
                    )}
                  />
                ))}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === "book" ? (
        bookState === "none" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 px-6 py-12 text-center">
            <p className="text-[13px] font-semibold text-foreground">No order book for this market</p>
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
              {base} trades through a pool, so orders fill against its liquidity rather than a book. Its trades are under Trades.
            </p>
          </div>
        ) : bookState === "loading" || !book ? (
          <div className="flex flex-1 flex-col gap-1.5 px-3 py-3" aria-label="Loading order book" role="status">
            {Array.from({ length: 14 }, (_, i) => (
              <span key={i} className="skel h-[16px] w-full rounded-sm" aria-hidden />
            ))}
          </div>
        ) : (
          <div className="flex flex-1 flex-col py-1.5">
            <div className="grid grid-cols-3 px-3 pb-1 text-[11px] font-medium text-muted-foreground">
              <span>Price ({quote})</span>
              <span className="text-right">Size ({base})</span>
              <span className="text-right">Total</span>
            </div>
            {view !== "bids" && <div className="flex flex-col-reverse">{asks.map((l, i) => level(l, "a", i))}</div>}
            <div className="my-1 flex items-center justify-between border-y border-foreground/[0.05] bg-foreground/[0.02] px-3 py-2">
              <span className={cn("font-display text-[17px] font-semibold tabular-nums", changePct == null ? "text-foreground" : up ? "text-credit" : "text-debit")}>{formatPrice(mid)}</span>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                Spread {formatPrice(book.spread)} · {spreadPct.toFixed(3)}%
              </span>
            </div>
            {view !== "asks" && bids.map((l, i) => level(l, "b", i))}
            <div className="mt-auto flex items-center gap-2 px-3 pb-1 pt-2.5 text-[11px] font-semibold tabular-nums">
              <span className="text-credit">B {Math.round(bidShare * 100)}%</span>
              <span className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-debit/70">
                <span className="h-full bg-credit/80 transition-[width] duration-700" style={{ width: `${bidShare * 100}%` }} />
              </span>
              <span className="text-debit">{Math.round((1 - bidShare) * 100)}% S</span>
            </div>
          </div>
        )
      ) : (
        <div className="flex flex-1 flex-col py-1.5">
          <div className="grid grid-cols-3 px-3 pb-1 text-[11px] font-medium text-muted-foreground">
            <span>Price ({quote})</span>
            <span className="text-right">Size</span>
            <span className="text-right">Time</span>
          </div>
          {trades === null ? (
            <div className="flex flex-col gap-1.5 px-3 py-2" role="status" aria-label="Loading trades">
              {Array.from({ length: 14 }, (_, i) => (
                <span key={i} className="skel h-[16px] w-full rounded-sm" aria-hidden />
              ))}
            </div>
          ) : trades.length === 0 ? (
            <p className="px-6 py-12 text-center text-[12.5px] text-muted-foreground">No recent trades to show.</p>
          ) : (
            <div className="slim-scroll max-h-[476px] overflow-y-auto">
              {trades.map((f) => (
                <div
                  key={f.id}
                  className={cn(
                    "grid h-[22px] grid-cols-3 items-center px-3 text-[12px] tabular-nums",
                    f.id === freshId && (f.side === "buy" ? "animate-[book-flash-b_0.8s_ease-out]" : "animate-[book-flash-a_0.8s_ease-out]"),
                  )}
                >
                  <span className={cn("font-medium", f.side === "buy" ? "text-credit" : "text-debit")}>{formatPrice(f.price)}</span>
                  <span className="text-right text-foreground/80">{fmtSize(f.size)}</span>
                  <span className="text-right text-muted-foreground">{clock(f.time)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Panel>
  )
}

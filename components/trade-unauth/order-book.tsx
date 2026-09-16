"use client"

/**
 * The order book and the trades tape.
 *
 * Neither exists on the live Pro screen, and their absence is the reason Pro
 * mode currently adds information without adding a view of the market: you
 * can see what a coin costs, but not how much of it is available at that
 * price, nor whether anyone is actually trading.
 *
 * The depth bars are the point. A ladder of numbers tells you the prices; the
 * bars behind them tell you where the wall is, which is the thing you are
 * looking for when you size an order.
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import { Segmented } from "@/components/ui/system"
import {
  bookFor,
  formatPrice,
  tapeFor,
  type Level,
  type Market,
} from "@/components/trade-unauth/trade-data"

function amount(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: n >= 1000 ? 0 : n >= 1 ? 3 : 4 })
}

function BookRow({
  level,
  maxTotal,
  side,
  onPick,
}: {
  level: Level
  maxTotal: number
  side: "bid" | "ask"
  onPick: (price: number) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(level.price)}
      title={`Use ${formatPrice(level.price)} as the limit price`}
      className="relative grid w-full grid-cols-[1fr_1fr_1fr] items-center px-3 py-[3px] text-right transition-colors hover:bg-accent/50"
    >
      {/* Depth, drawn from the right so the wall grows inward from the axis. */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 right-0 opacity-[0.16]",
          side === "bid" ? "bg-credit" : "bg-debit",
        )}
        style={{ width: `${(level.total / maxTotal) * 100}%` }}
      />
      <span
        className={cn(
          "relative z-10 text-left text-[11.5px] font-medium tabular-nums",
          side === "bid" ? "text-credit" : "text-debit",
        )}
      >
        {formatPrice(level.price)}
      </span>
      <span className="relative z-10 text-[11.5px] tabular-nums text-foreground/80">
        {amount(level.size)}
      </span>
      <span className="relative z-10 text-[11.5px] tabular-nums text-muted-foreground">
        {amount(level.total)}
      </span>
    </button>
  )
}

export function OrderBook({
  market,
  onPickPrice,
}: {
  market: Market
  onPickPrice: (price: number) => void
}) {
  const [tab, setTab] = React.useState<"book" | "trades">("book")
  const book = React.useMemo(() => bookFor(market), [market])
  const tape = React.useMemo(() => tapeFor(market), [market])
  const maxTotal = Math.max(
    book.bids[book.bids.length - 1]?.total ?? 1,
    book.asks[book.asks.length - 1]?.total ?? 1,
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <Segmented
          size="sm"
          options={[
            { key: "book", label: "Order book" },
            { key: "trades", label: "Trades" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === "book" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="grid grid-cols-[1fr_1fr_1fr] px-3 pb-1 text-right text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            <span className="text-left">Price</span>
            <span>Size ({market.base})</span>
            <span>Total</span>
          </div>

          {/* Asks descend toward the spread, so the touch is in the middle —
              the arrangement every trading desk uses. */}
          <div className="slim-scroll flex min-h-0 flex-1 flex-col-reverse overflow-y-auto">
            {book.asks.map((l, i) => (
              <BookRow key={`a${i}`} level={l} maxTotal={maxTotal} side="ask" onPick={onPickPrice} />
            ))}
          </div>

          <div className="flex items-baseline justify-between gap-2 border-y border-border/40 bg-card/40 px-3 py-2">
            <span className="font-display text-[17px] font-semibold tabular-nums text-foreground">
              {formatPrice(market.price)}
            </span>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              Spread {formatPrice(book.spread)} · {book.spreadPct.toFixed(3)}%
            </span>
          </div>

          <div className="slim-scroll flex min-h-0 flex-1 flex-col overflow-y-auto">
            {book.bids.map((l, i) => (
              <BookRow key={`b${i}`} level={l} maxTotal={maxTotal} side="bid" onPick={onPickPrice} />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="grid grid-cols-[1fr_1fr_auto] px-3 pb-1 text-right text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            <span className="text-left">Price</span>
            <span>Size</span>
            <span>Time</span>
          </div>
          <div className="slim-scroll flex min-h-0 flex-1 flex-col overflow-y-auto">
            {tape.map((t) => (
              <span
                key={t.id}
                className="grid grid-cols-[1fr_1fr_auto] items-center px-3 py-[3px] text-right"
              >
                <span
                  className={cn(
                    "text-left text-[11.5px] font-medium tabular-nums",
                    t.side === "buy" ? "text-credit" : "text-debit",
                  )}
                >
                  {formatPrice(t.price)}
                </span>
                <span className="text-[11.5px] tabular-nums text-foreground/80">{amount(t.size)}</span>
                <span className="text-[11px] tabular-nums text-muted-foreground">{t.time}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

"use client"

/**
 * The tape — what the market is doing, before you read a single row.
 *
 * It scrolls because a tape that does not scroll is a row of chips, and a row
 * of chips is what the top of this page already was. The animation lives in
 * globals.css (`ws-ticker-track`) and stops on hover, on focus-within, and
 * under prefers-reduced-motion, so it never fights a reader trying to click
 * something inside it.
 *
 * Every item is a link to the trading screen. The tape is the fastest path
 * from "what is moving" to "let me trade that", and the old header band spent
 * that space on four cards reading "—".
 */

import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import type { CoinData } from "@/lib/actions"

/** How many symbols ride the tape. Long enough to feel like a feed, short
 *  enough that one loop is not a minute long. */
const TAPE_LENGTH = 14

function price(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—"
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: value < 1 ? 6 : 2 })}`
}

function Item({ coin, showChange }: { coin: CoinData; showChange: boolean }) {
  const up = coin.change24h >= 0
  return (
    <Link
      href={`/trade?symbol=${encodeURIComponent(coin.symbol)}`}
      className="flex shrink-0 items-center gap-2 px-3.5 py-2 transition-colors hover:bg-accent/50"
    >
      <CoinAvatar symbol={coin.symbol} src={coin.image} size="sm" />
      <span className="text-[12.5px] font-semibold">{coin.symbol}</span>
      <span className="text-[12.5px] tabular-nums text-muted-foreground">{price(coin.price)}</span>
      {/* Only when the feed actually carries a move. A row of flat green
          "+0.00%" is a fabricated signal, and this band is the most-read
          strip on the page. */}
      {showChange && (
        <span className={cn("text-[12px] font-semibold tabular-nums", up ? "text-credit" : "text-debit")}>
          {up ? "+" : ""}
          {coin.change24h.toFixed(2)}%
        </span>
      )}
    </Link>
  )
}

export function MarketsTicker({ coins }: { coins: CoinData[] }) {
  const tape = React.useMemo(
    () =>
      [...coins]
        .filter((c) => c.price > 0)
        .sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0))
        .slice(0, TAPE_LENGTH),
    [coins],
  )

  const showChange = React.useMemo(() => tape.some((c) => c.change24h !== 0), [tape])

  // Nothing to say is better said by saying nothing — an empty tape is a grey
  // bar that looks broken.
  if (tape.length === 0) return null

  return (
    <div className="ws-ticker scrollbar-none relative overflow-hidden rounded-2xl bg-card/40 ring-1 ring-border/40">
      {/* Fades at both ends so items enter and leave rather than popping. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-background to-transparent"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-background to-transparent"
      />
      <div
        className="ws-ticker-track flex w-max"
        style={{ "--ticker-duration": `${tape.length * 4.5}s` } as React.CSSProperties}
      >
        {/* Rendered twice: the track translates exactly one copy's width, so
            the wrap point is invisible. The duplicate is decorative — a screen
            reader should not hear the tape twice. */}
        {tape.map((c) => (
          <Item key={`a-${c.id}`} coin={c} showChange={showChange} />
        ))}
        <span aria-hidden className="flex">
          {tape.map((c) => (
            <Item key={`b-${c.id}`} coin={c} showChange={showChange} />
          ))}
        </span>
      </div>
    </div>
  )
}

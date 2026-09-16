"use client"

/**
 * The tape and the stats bar — the two strips that tell you what kind of day
 * the market is having before you read a single row.
 *
 * The live page has neither. What it has instead is four cards showing
 * "—", "—", "—" and "+0.00%": a loading state that never resolves, taking up
 * the most valuable band on the screen.
 */

import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { CardShell, allocationColor } from "@/components/ui/system"
import { CARD_HUE } from "@/components/ui/surface"
import { MiniSpark } from "@/components/ui/charts"
import {
  CAP_SERIES,
  DOMINANCE_SPLIT,
  SENTIMENT,
  STATS,
  TICKER,
  VOLUME_DAYS,
  formatPrice,
  formatUSD,
  tradeHref,
  type Market,
} from "@/components/markets-unauth/market-data"

/* ── Tape ─────────────────────────────────────────────────────────────────── */

function TickerItem({ m }: { m: Market }) {
  const up = m.changePct >= 0
  return (
    <Link
      href={tradeHref(m)}
      className="flex shrink-0 items-center gap-2 px-3.5 py-2 transition-colors hover:bg-accent/50"
    >
      <CoinAvatar symbol={m.base} size="sm" />
      <span className="text-[12.5px] font-semibold">{m.base}</span>
      <span className="text-[12.5px] tabular-nums text-muted-foreground">{formatPrice(m.price)}</span>
      <span className={cn("text-[12px] font-semibold tabular-nums", up ? "text-credit" : "text-debit")}>
        {up ? "+" : ""}
        {m.changePct.toFixed(2)}%
      </span>
    </Link>
  )
}

export function Ticker() {
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
        style={{ "--ticker-duration": `${TICKER.length * 4.5}s` } as React.CSSProperties}
      >
        {/* Rendered twice: the track translates exactly one copy's width, so
            the wrap point is invisible. The duplicate is decorative — a screen
            reader should not hear the tape twice. */}
        {TICKER.map((m) => (
          <TickerItem key={`a-${m.id}`} m={m} />
        ))}
        <span aria-hidden className="flex">
          {TICKER.map((m) => (
            <TickerItem key={`b-${m.id}`} m={m} />
          ))}
        </span>
      </div>
    </div>
  )
}

/* ── Stats bar ────────────────────────────────────────────────────────────── */

/**
 * One stat cell: the label, the figure, and a visual that carries the SAME
 * fact rather than decorating it. Five figures on a flat panel was the one
 * dull band on a page where every other strip has a curve or a bar.
 */
function Stat({
  label,
  value,
  delta,
  children,
}: {
  label: string
  value: React.ReactNode
  delta?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 bg-card/30 px-4 py-3.5">
      <span className="truncate text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </span>
      <span className="flex flex-wrap items-baseline gap-x-2">
        <span className="truncate font-display text-[20px] font-medium leading-tight tabular-nums">
          {value}
        </span>
        {delta}
      </span>
      {children}
    </div>
  )
}

export function MarketStats() {
  const capUp = STATS.marketCapChangePct >= 0
  const breadth = (STATS.advancing / (STATS.advancing + STATS.declining)) * 100
  const volMax = Math.max(...VOLUME_DAYS)

  return (
    <CardShell className={CARD_HUE}>
      <div className="grid grid-cols-1 gap-px bg-border/40 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {/* Market cap — the aggregate of every row below, as a real curve. */}
        <Stat
          label="Market cap"
          value={formatUSD(STATS.marketCapUsd, { compact: true })}
          delta={
            <span
              className={cn("text-[12px] font-semibold tabular-nums", capUp ? "text-credit" : "text-debit")}
            >
              {capUp ? "+" : ""}
              {STATS.marketCapChangePct.toFixed(2)}%
            </span>
          }
        >
          <MiniSpark points={CAP_SERIES} tone="direction" width={140} height={26} className="w-full" />
        </Stat>

        {/* 24h volume — seven daily bars, today's in gold. */}
        <Stat label="24h volume" value={formatUSD(STATS.volumeUsd, { compact: true })}>
          <span className="flex h-[26px] items-end gap-1" aria-hidden>
            {VOLUME_DAYS.map((v, i) => (
              <span
                key={i}
                className={cn(
                  "min-w-0 flex-1 rounded-t-[2px]",
                  i === VOLUME_DAYS.length - 1 ? "bg-primary/80" : "bg-foreground/[0.14]",
                )}
                style={{ height: `${Math.max(12, (v / volMax) * 100)}%` }}
              />
            ))}
          </span>
        </Stat>

        {/* Dominance — the split it is a share OF, not just the number. */}
        <Stat label="BTC dominance" value={`${STATS.btcDominancePct.toFixed(1)}%`}>
          <span className="flex flex-col gap-1.5">
            <span className="flex h-1.5 w-full overflow-hidden rounded-full" aria-hidden>
              {DOMINANCE_SPLIT.map((d, i) => (
                <span key={d.label} style={{ width: `${d.pct}%`, background: allocationColor(i) }} />
              ))}
            </span>
            <span className="flex flex-wrap gap-x-2.5 gap-y-1">
              {DOMINANCE_SPLIT.map((d, i) => (
                <span key={d.label} className="flex items-center gap-1 text-[10.5px] text-muted-foreground">
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: allocationColor(i) }}
                  />
                  {d.label} {d.pct.toFixed(0)}%
                </span>
              ))}
            </span>
          </span>
        </Stat>

        {/* Sentiment — a fear/greed scale with the reading marked on it. */}
        <Stat
          label="Sentiment"
          value={SENTIMENT.score}
          delta={
            <span className="rounded-full bg-convert-chip px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-primary">
              {SENTIMENT.label}
            </span>
          }
        >
          <span className="flex flex-col gap-1.5">
            <span className="relative block h-1.5 w-full rounded-full bg-[linear-gradient(90deg,var(--debit),var(--warning),var(--primary))]">
              <span
                aria-hidden
                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground ring-2 ring-card"
                style={{ left: `${SENTIMENT.score}%` }}
              />
            </span>
            <span className="flex justify-between text-[10.5px] text-muted-foreground">
              <span>Fear</span>
              <span>Greed</span>
            </span>
          </span>
        </Stat>

        {/* Breadth — how much of the book is actually up. A flat market cap
            held up by BTC while two thirds of the book falls is a different
            day from one where nothing moved. */}
        <Stat
          label="Breadth"
          value={
            <>
              <span className="text-credit">{STATS.advancing}</span>
              <span className="text-[13px] font-normal text-muted-foreground"> up </span>
              <span className="text-debit">{STATS.declining}</span>
              <span className="text-[13px] font-normal text-muted-foreground"> down</span>
            </>
          }
        >
          <span className="flex flex-col gap-1.5">
            <span className="flex h-1.5 w-full overflow-hidden rounded-full bg-debit/70" aria-hidden>
              <span className="block h-full bg-credit" style={{ width: `${breadth}%` }} />
            </span>
            <span className="text-[10.5px] text-muted-foreground">
              {breadth.toFixed(0)}% of pairs advancing
            </span>
          </span>
        </Stat>
      </div>
    </CardShell>
  )
}

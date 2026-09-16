"use client"

/**
 * The stats strip.
 *
 * It was four loose cards carrying four bare numbers, in the most valuable
 * band on the page — and when the feed was cold they read "—", "—", "—" and
 * "+0.00%", a loading state that never resolved. Now it is one panel divided
 * by hairlines, and each cell carries a VISUAL of the same fact rather than a
 * decoration beside it: dominance shows the share it is a share of, breadth
 * shows the split, sentiment shows where on the scale the reading sits.
 *
 * ── What is here and what is not ──────────────────────────────────────────
 * Every cell renders only when its figure exists. The preview had five, all
 * from dummy data; these are the ones with a real source:
 *
 *   · Market cap and 24h volume — from the global feed.
 *   · BTC dominance — from the same feed. The preview drew a BTC/ETH/others
 *     split bar beside it; that is NOT here, because the only market caps on
 *     the client are the dozen listed coins, and a "dominance" bar computed
 *     over twelve assets means something quite different from the global
 *     figure printed above it.
 *   · Breadth — advancing vs declining across the listed coins, which is a
 *     fact about this page's own list and is labelled as such.
 *   · Sentiment — the Fear & Greed reading from /insights. Absent until that
 *     endpoint is deployed; a dial resting at 0 would read as "Extreme Fear",
 *     which is a market call nobody made.
 *
 * The preview's market-cap curve and seven-day volume bars are also gone: no
 * history endpoint serves either, and a drawn curve is a claim about the past.
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import { CardShell } from "@/components/ui/system"
import { CARD_HUE } from "@/components/ui/surface"
import { cryptoBackendClient, isCryptoBackendEnabled } from "@/lib/crypto-backend"
import type { CoinData } from "@/lib/actions"

type GlobalStats = {
  totalMarketCap: number
  totalVolume: number
  btcDominance: number
  marketCapChange24h: number
}

function compact(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—"
  return `$${Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 2 }).format(value)}`
}

/** One cell: the label, the figure, and a visual carrying the same fact. */
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

/** The Fear & Greed reading, or null. Null covers "not deployed yet" and
 *  "failed" alike — from this strip's point of view there is no figure
 *  either way, and a cell that cannot state one should not be on screen. */
function useSentiment() {
  const [value, setValue] = React.useState<{ value: number; classification: string } | null>(null)
  React.useEffect(() => {
    if (!isCryptoBackendEnabled) return
    const controller = new AbortController()
    cryptoBackendClient
      .getInsights(1, controller.signal)
      .then((data) => {
        if (data.fearGreed) setValue(data.fearGreed)
      })
      .catch(() => {
        /* Expected before the backend carrying /insights is deployed. */
      })
    return () => controller.abort()
  }, [])
  return value
}

export function MarketsStats({
  coins,
  changeOf,
  globalStats,
}: {
  coins: CoinData[]
  /** The page's own 24h-change resolver, which prefers the sparkline feed —
   *  `coin.change24h` arrives as 0 for every asset here, so counting on it
   *  directly would report every day as perfectly balanced. */
  changeOf: (coin: CoinData) => number
  globalStats: GlobalStats
}) {
  const sentiment = useSentiment()

  const breadth = React.useMemo(() => {
    const advancing = coins.filter((c) => changeOf(c) > 0).length
    const declining = coins.filter((c) => changeOf(c) < 0).length
    const total = advancing + declining
    // Every coin flat means the change feed is cold, not that the market is
    // perfectly balanced. No split to draw.
    if (total === 0) return null
    return { advancing, declining, pct: (advancing / total) * 100 }
  }, [coins, changeOf])

  const capUp = globalStats.marketCapChange24h >= 0

  return (
    <CardShell className={CARD_HUE}>
      <div className="grid grid-cols-1 gap-px bg-border/40 sm:grid-cols-2 lg:grid-cols-4">
        {globalStats.totalMarketCap > 0 && (
          <Stat
            label="Market cap"
            value={compact(globalStats.totalMarketCap)}
            delta={
              globalStats.marketCapChange24h !== 0 ? (
                <span
                  className={cn(
                    "text-[12px] font-semibold tabular-nums",
                    capUp ? "text-credit" : "text-debit",
                  )}
                >
                  {capUp ? "+" : ""}
                  {globalStats.marketCapChange24h.toFixed(2)}%
                </span>
              ) : undefined
            }
          />
        )}

        {globalStats.totalVolume > 0 && (
          <Stat label="24h volume" value={compact(globalStats.totalVolume)} />
        )}

        {globalStats.btcDominance > 0 && (
          <Stat label="BTC dominance" value={`${globalStats.btcDominance.toFixed(1)}%`}>
            <span className="flex h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.1]" aria-hidden>
              <span className="block h-full bg-primary/80" style={{ width: `${Math.min(100, globalStats.btcDominance)}%` }} />
            </span>
          </Stat>
        )}

        {/* Breadth — a flat market cap held up by BTC while two thirds of the
            book falls is a different day from one where nothing moved. */}
        {breadth && (
          <Stat
            label="Breadth"
            value={
              <>
                <span className="text-credit">{breadth.advancing}</span>
                <span className="text-[13px] font-normal text-muted-foreground"> up </span>
                <span className="text-debit">{breadth.declining}</span>
                <span className="text-[13px] font-normal text-muted-foreground"> down</span>
              </>
            }
          >
            <span className="flex flex-col gap-1.5">
              <span className="flex h-1.5 w-full overflow-hidden rounded-full bg-debit/70" aria-hidden>
                <span className="block h-full bg-credit" style={{ width: `${breadth.pct}%` }} />
              </span>
              <span className="text-[10.5px] text-muted-foreground">
                {breadth.pct.toFixed(0)}% of listed assets advancing
              </span>
            </span>
          </Stat>
        )}

        {sentiment && (
          <Stat
            label="Sentiment"
            value={sentiment.value}
            delta={
              sentiment.classification ? (
                <span className="rounded-full bg-convert-chip px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-primary">
                  {sentiment.classification}
                </span>
              ) : undefined
            }
          >
            <span className="flex flex-col gap-1.5">
              <span className="relative block h-1.5 w-full rounded-full bg-[linear-gradient(90deg,var(--debit),var(--warning),var(--primary))]">
                <span
                  aria-hidden
                  className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground ring-2 ring-card"
                  style={{ left: `${Math.min(100, Math.max(0, sentiment.value))}%` }}
                />
              </span>
              <span className="flex justify-between text-[10.5px] text-muted-foreground">
                <span>Fear</span>
                <span>Greed</span>
              </span>
            </span>
          </Stat>
        )}
      </div>
    </CardShell>
  )
}

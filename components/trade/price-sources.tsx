"use client"

/**
 * PriceSources — where the number at the top of this screen actually comes
 * from (`TradeView.priceSources`).
 *
 * On a venue with a book this pane is the last/mark/index triplet. This is not
 * that venue: a spot order here is a swap against a liquidity pool, so there is
 * no mark price and no index to quote, and inventing either would be a
 * confident figure with nothing behind it. What DOES exist is two independent
 * readings of the same market that this workspace already holds:
 *
 *  1. The LIVE price, read from the pool by whichever indexer draws the chart,
 *     refreshed on the chart's own poll. This is the figure the header shows
 *     and the figure the ticket estimates against.
 *  2. The MARKET LIST price, the registry's periodic snapshot. It is what the
 *     rail and the pair picker show, and it lags — which is why the rail can
 *     quietly disagree with the hero figure above it.
 *
 * Stating both, and the distance between them, is the honest version of what
 * this flag is for: a trader who can see the two feeds disagree knows how much
 * to trust the row they just clicked. A gap wide enough to matter is called
 * out in warning amber — never in the money colours, because the difference
 * between two feeds is not a direction the market moved.
 *
 * Pure display. Every figure is handed in; nothing here is derived except the
 * percentage between the two, which is arithmetic on two real numbers.
 */

import { cn } from "@/lib/utils"
import { Eyebrow } from "@/components/ui/system"
import { fmtPx } from "@/components/trade/market-header"
import type { ChartOrigin } from "@/components/trade/candle-chart"

/** The upstreams, in the names they publish under. */
const ORIGIN_LABEL: Record<Exclude<ChartOrigin, null>, string> = {
  birdeye: "Birdeye",
  geckoterminal: "GeckoTerminal",
  coingecko: "CoinGecko",
}

/** Past this, the two feeds disagree by enough to change a decision. */
const WIDE_GAP_PCT = 1

function Row({
  label,
  note,
  value,
  tone,
}: {
  label: string
  note?: string | null
  value: string
  tone?: "warning"
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="flex min-w-0 items-baseline gap-1.5">
        <span className="truncate text-[12px] text-muted-foreground">{label}</span>
        {note && <span className="shrink-0 text-[10.5px] text-subtle">{note}</span>}
      </span>
      <span
        className={cn(
          "shrink-0 text-[12.5px] font-semibold tabular-nums",
          tone === "warning" && "text-warning",
        )}
      >
        {value}
      </span>
    </div>
  )
}

export function PriceSources({
  /** The pool's own last price, as the chart's source reports it. */
  livePrice,
  /** The registry snapshot for this row — what the market list shows. */
  listPrice,
  /** Which indexer drew the bars, where the chart said. */
  origin,
  className,
}: {
  livePrice: number | null
  listPrice: number | null
  origin: ChartOrigin
  className?: string
}) {
  const hasLive = typeof livePrice === "number" && livePrice > 0
  const hasList = typeof listPrice === "number" && listPrice > 0
  // Nothing to compare and nothing to state — say nothing rather than render a
  // panel of dashes.
  if (!hasLive && !hasList) return null

  const gapPct =
    hasLive && hasList ? ((livePrice - listPrice) / listPrice) * 100 : null
  const wide = gapPct !== null && Math.abs(gapPct) >= WIDE_GAP_PCT

  return (
    <section
      aria-label="Where this price comes from"
      data-vivid-target="trade-price-sources"
      data-vivid-label="The two price feeds behind this market and the gap between them"
      className={cn("flex flex-col gap-1", className)}
    >
      <Eyebrow className="px-1 text-[10px] tracking-[0.1em]">Price sources</Eyebrow>
      <div className="divide-y divide-border/20 rounded-2xl bg-surface-sunken/70 px-3 py-0.5">
        {hasLive && (
          <Row
            label="Live"
            note={origin ? ORIGIN_LABEL[origin] : null}
            value={`$${fmtPx(livePrice)}`}
          />
        )}
        {hasList && (
          <Row label="Market list" note="snapshot" value={`$${fmtPx(listPrice)}`} />
        )}
        {gapPct !== null && (
          <Row
            label="Difference"
            value={`${gapPct >= 0 ? "+" : ""}${gapPct.toFixed(2)}%`}
            tone={wide ? "warning" : undefined}
          />
        )}
      </div>
      {wide && (
        <p className="px-1 text-[11px] leading-snug text-subtle">
          The market list is behind the pool right now. Your order is priced
          against the live figure above, not the list.
        </p>
      )}
    </section>
  )
}

"use client"

/**
 * Total portfolio value — the figure, its 24h move, and the curve.
 *
 * The figure stays the 24h story whatever range the chart shows; the range
 * tabs change the CURVE and its own change line, never the headline. A total
 * that re-labels itself when you click "1Y" stops being a total.
 *
 * Copied from the preview (components/dashboard-unauth/portfolio.tsx) on real
 * data: the total from usePortfolioTotal, the curves from useAccountHistory
 * (1D / 1W / 1M: the 30-day history has no 1H, 1Y or All), the 24h move from
 * the same maths the hero used. States the preview never drew are kept: a
 * price-feed error, no history yet, and no 24h figure.
 */

import * as React from "react"
import { ViewIcon, ViewOffSlashIcon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { RollingAmount } from "@/components/ui/rolling-amount"
import { formatUSD } from "@/components/dashboard/redesign/format"
import { priceOf, useDashboardData } from "@/components/dashboard/redesign/data"
import { PriceChart } from "@/components/dash/price-chart"
import { ChangeChip, Icon, Panel, PillTabs, usePrivacy } from "@/components/dashboard/redesign/ui"
import type { HistoryRange } from "@/hooks/useAccountHistory"

type RangeKey = "1d" | "1w" | "1m"
type Range = {
  key: RangeKey
  label: string
  /** The hook's range this tab shows. */
  history: HistoryRange
  points: number[]
  /** Span of the range, for axis labels. */
  minutes: number
  tick: "time" | "day"
  /** Change across the range in USD: last point minus first. */
  changeUsd: number
}

const RANGE_SPECS: { key: RangeKey; label: string; history: HistoryRange; minutes: number; tick: Range["tick"] }[] = [
  { key: "1d", label: "1D", history: "today", minutes: 24 * 60, tick: "time" },
  { key: "1w", label: "1W", history: "week", minutes: 7 * 24 * 60, tick: "day" },
  { key: "1m", label: "1M", history: "month", minutes: 30 * 24 * 60, tick: "day" },
]

/** Axis ticks and per-point labels for a range, resolved against the
 *  viewer's own clock — after mount only, so SSR never guesses a timezone. */
function useAxis(range: Range) {
  const [axis, setAxis] = React.useState<{ ticks: string[]; points: string[] }>()
  React.useEffect(() => {
    const now = Date.now()
    const n = range.points.length
    if (n < 2) return setAxis(undefined)
    const step = (range.minutes * 60_000) / (n - 1)
    const at = (i: number) => new Date(now - (n - 1 - i) * step)
    const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" })
    const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit" })
    const full = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    const tickFmt = range.tick === "time" ? time : day
    const pointFmt = full
    const ticks = Array.from({ length: 7 }, (_, k) => tickFmt.format(at(Math.round((k / 6) * (n - 1)))))
    setAxis({ ticks, points: Array.from({ length: n }, (_, i) => pointFmt.format(at(i))) })
  }, [range])
  return axis
}

export function Portfolio() {
  const { hidden, toggle } = usePrivacy()
  const { portfolio, history, hasHistory, dailyPnL, livePrices, error } = useDashboardData()
  const [key, setKey] = React.useState<RangeKey>("1m")
  const ranges: Range[] = React.useMemo(
    () =>
      RANGE_SPECS.map((spec) => {
        const points = history.rangeSeries[spec.history]
        return { ...spec, points, changeUsd: points.length > 1 ? points[points.length - 1] - points[0] : 0 }
      }),
    [history.rangeSeries],
  )
  const range = ranges.find((r) => r.key === key) ?? ranges[2]
  const axis = useAxis(range)
  const btcPrice = priceOf(livePrices, "BTC")
  const dayPct = history.changes.today
  const total = portfolio.total

  // Not in the preview: the price feed can fail, and the hero said so.
  if (error) {
    return (
      <Panel className="flex flex-col items-center gap-2 px-6 py-14 text-center">
        <h2 className="font-display text-[16px] font-semibold text-foreground">Market prices aren&apos;t loading</h2>
        <p className="max-w-sm text-[13px] text-muted-foreground">{error}</p>
      </Panel>
    )
  }

  return (
    <Panel className="grid grid-cols-1 gap-6 p-5 md:p-7 lg:grid-cols-[minmax(240px,0.72fr)_minmax(0,2fr)] lg:gap-8">
      {/* ── The figure ─────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-col justify-between gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-[14.5px] font-medium text-muted-foreground">Total Portfolio Value</h2>
            <button
              type="button"
              onClick={toggle}
              aria-label={hidden ? "Show balances" : "Hide balances"}
              aria-pressed={hidden}
              className={cn(
                "flex size-7 items-center justify-center rounded-full transition-colors duration-200 hover:bg-foreground/[0.06]",
                hidden ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon icon={hidden ? ViewOffSlashIcon : ViewIcon} className="size-[17px]" />
            </button>
          </div>

          <div className="font-display text-[44px] font-semibold leading-none tracking-[-0.045em] text-foreground tabular-nums sm:text-[52px] 2xl:text-[56px]">
            {hidden ? <span className="tracking-[0.04em]">••••••</span> : <RollingAmount value={formatUSD(total)} />}
          </div>

          {btcPrice > 0 && (
            <p className="text-[15px] font-medium tabular-nums text-muted-foreground">
              ≈ {hidden ? "••••" : (total / btcPrice).toFixed(6)} <span className="text-foreground/70">BTC</span>
            </p>
          )}
        </div>

        {/* Each piece shows only when there's a figure for it; with neither,
            the row would be a lone "(24h)". */}
        {(dayPct !== null || dailyPnL !== 0) && (
          <div className="flex flex-wrap items-center gap-3">
            {dayPct !== null && <ChangeChip value={dayPct} />}
            {dailyPnL !== 0 && (
              <span className={cn("text-[15px] font-semibold tabular-nums", dailyPnL >= 0 ? "text-credit" : "text-debit")}>
                {hidden ? "••••" : `${dailyPnL >= 0 ? "+" : "−"}${formatUSD(Math.abs(dailyPnL))}`}
              </span>
            )}
            <span className="text-[13.5px] font-medium text-muted-foreground">(24h)</span>
          </div>
        )}
      </div>

      {/* ── The curve ──────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-baseline gap-2 text-[13px] text-muted-foreground">
            <span className="font-medium">{`Past ${range.label}`}</span>
            {hasHistory && (
              <span className={cn("font-semibold tabular-nums", range.changeUsd >= 0 ? "text-credit" : "text-debit")}>
                {hidden ? "••••" : `${range.changeUsd >= 0 ? "+" : "−"}${formatUSD(Math.abs(range.changeUsd))}`}
              </span>
            )}
          </p>
          <PillTabs
            id="portfolio-range"
            size="sm"
            options={ranges.map((r) => ({ key: r.key, label: r.label }))}
            value={key}
            onChange={setKey}
          />
        </div>

        {hasHistory ? (
          <PriceChart
            points={range.points}
            ticks={axis?.ticks}
            pointLabels={axis?.points}
            format={(v) => (hidden ? "••••" : formatUSD(v))}
            formatAxis={(v) => (hidden ? "•••" : formatUSD(v, { maxFrac: 0 }))}
            height={232}
          />
        ) : (
          // Not in the preview: an empty account has no curve to draw.
          <div className="flex h-[232px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-foreground/[0.08] px-6 text-center">
            <span className="text-[14px] font-semibold text-foreground">No history yet</span>
            <span className="max-w-xs text-[12.5px] leading-relaxed text-muted-foreground">Your balance over time appears here once there is a day of it to draw.</span>
          </div>
        )}
      </div>
    </Panel>
  )
}

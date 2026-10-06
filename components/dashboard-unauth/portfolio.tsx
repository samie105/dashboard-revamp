"use client"

/**
 * Total portfolio value — the figure, its 24h move, and the curve.
 *
 * The figure stays the 24h story whatever range the chart shows; the range
 * tabs change the CURVE and its own change line, never the headline. A total
 * that re-labels itself when you click "1Y" stops being a total.
 */

import * as React from "react"
import { ViewIcon, ViewOffSlashIcon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { RollingAmount } from "@/components/ui/rolling-amount"
import {
  DAY_RANGE,
  PORTFOLIO_BTC,
  PORTFOLIO_TOTAL,
  RANGES,
  formatUSD,
  type Range,
  type RangeKey,
} from "@/components/dashboard-unauth/demo-data"
import { PriceChart } from "@/components/dashboard-unauth/price-chart"
import { ChangeChip, Icon, Panel, PillTabs, usePrivacy } from "@/components/redesign/ui"

/** Axis ticks and per-point labels for a range, resolved against the
 *  viewer's own clock — after mount only, so SSR never guesses a timezone. */
function useAxis(range: Range) {
  const [axis, setAxis] = React.useState<{ ticks: string[]; points: string[] }>()
  React.useEffect(() => {
    const now = Date.now()
    const n = range.points.length
    const step = (range.minutes * 60_000) / (n - 1)
    const at = (i: number) => new Date(now - (n - 1 - i) * step)
    const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" })
    const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit" })
    const month = new Intl.DateTimeFormat("en-US", { month: "short" })
    const monthYear = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" })
    const full = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    const tickFmt = range.tick === "time" ? time : range.tick === "day" ? day : range.tick === "month" ? month : monthYear
    const pointFmt = range.tick === "month" || range.tick === "year" ? day : full
    const ticks = Array.from({ length: 7 }, (_, k) => tickFmt.format(at(Math.round((k / 6) * (n - 1)))))
    setAxis({ ticks, points: Array.from({ length: n }, (_, i) => pointFmt.format(at(i))) })
  }, [range])
  return axis
}

export function Portfolio() {
  const { hidden, toggle } = usePrivacy()
  const [key, setKey] = React.useState<RangeKey>("1m")
  const range = RANGES.find((r) => r.key === key) ?? RANGES[3]
  const axis = useAxis(range)

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
                "flex size-7 items-center justify-center rounded-full transition-colors duration-200 hover:bg-white/[0.06]",
                hidden ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon icon={hidden ? ViewOffSlashIcon : ViewIcon} className="size-[17px]" />
            </button>
          </div>

          <div className="font-display text-[44px] font-semibold leading-none tracking-[-0.045em] text-foreground tabular-nums sm:text-[52px] 2xl:text-[56px]">
            {hidden ? <span className="tracking-[0.04em]">••••••</span> : <RollingAmount value={formatUSD(PORTFOLIO_TOTAL)} />}
          </div>

          <p className="text-[15px] font-medium tabular-nums text-muted-foreground">
            ≈ {hidden ? "••••" : PORTFOLIO_BTC.toFixed(6)} <span className="text-foreground/70">BTC</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <ChangeChip value={DAY_RANGE.changePct} />
          <span className="text-[15px] font-semibold tabular-nums text-credit">
            {hidden ? "••••" : `+${formatUSD(DAY_RANGE.changeUsd)}`}
          </span>
          <span className="text-[13.5px] font-medium text-muted-foreground">(24h)</span>
        </div>
      </div>

      {/* ── The curve ──────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-baseline gap-2 text-[13px] text-muted-foreground">
            <span className="font-medium">{range.label === "ALL" ? "All time" : `Past ${range.label}`}</span>
            <span className={cn("font-semibold tabular-nums", range.changeUsd >= 0 ? "text-credit" : "text-debit")}>
              {hidden ? "••••" : `${range.changeUsd >= 0 ? "+" : "−"}${formatUSD(Math.abs(range.changeUsd))}`}
            </span>
          </p>
          <PillTabs
            id="portfolio-range"
            size="sm"
            options={RANGES.map((r) => ({ key: r.key, label: r.label }))}
            value={key}
            onChange={setKey}
          />
        </div>

        <PriceChart
          points={range.points}
          ticks={axis?.ticks}
          pointLabels={axis?.points}
          format={(v) => (hidden ? "••••" : formatUSD(v))}
          formatAxis={(v) => (hidden ? "•••" : formatUSD(v, { maxFrac: 0 }))}
          height={232}
        />
      </div>
    </Panel>
  )
}

"use client"

/**
 * The preview's chart panel (the chart area of components/trade-unauth/terminal.tsx):
 * timeframe tabs, an MA toggle and a candles/line switch over the chart, on
 * the real feed. Intervals the token's price source can't serve are disabled,
 * as on the previous chart. Simple mode (`toolbar={false}`) keeps the chart
 * and drops the controls, as before.
 *
 * The chart fills the panel's height: the panel's size is set by the page.
 */

import * as React from "react"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"
import { SLIDE } from "@/components/dashboard/redesign/ui"
import { CandleChart, type ChartKind } from "@/components/trade/redesign/candle-chart"
import { useChartFeed } from "@/components/trade/redesign/chart-feed"
import type { ChartOrigin, ChartSource, ChartStats } from "@/components/trade/candle-chart"
import type { HlCandleInterval } from "@/lib/hl-public"

/** The preview's timeframes (components/trade-unauth/trade-data.ts), with
 *  its bar counts: a candle needs a few pixels of body to read as a candle,
 *  so each timeframe shows the latest `count` bars of the real series. */
const TIMEFRAMES: { key: HlCandleInterval; label: string; minutes: number; count: number }[] = [
  { key: "1m", label: "1m", minutes: 1, count: 60 },
  { key: "5m", label: "5m", minutes: 5, count: 72 },
  { key: "15m", label: "15m", minutes: 15, count: 48 },
  { key: "1h", label: "1h", minutes: 60, count: 72 },
  { key: "4h", label: "4h", minutes: 240, count: 84 },
  { key: "1d", label: "1D", minutes: 1440, count: 90 },
]

function useHeight() {
  const ref = React.useRef<HTMLDivElement>(null)
  const [h, setH] = React.useState(0)
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setH(Math.round(e.contentRect.height)))
    ro.observe(el)
    setH(Math.round(el.getBoundingClientRect().height))
    return () => ro.disconnect()
  }, [])
  return [ref, h] as const
}

export function ChartPanel({
  source,
  onStats,
  onSource,
  toolbar = true,
  className,
}: {
  source: ChartSource
  onStats?: (stats: ChartStats | null) => void
  onSource?: (origin: ChartOrigin) => void
  toolbar?: boolean
  className?: string
}) {
  const [tf, setTf] = React.useState<HlCandleInterval>("1h")
  const [kind, setKind] = React.useState<ChartKind>("candles")
  const [showMA, setShowMA] = React.useState(true)
  const feed = useChartFeed(source, tf, setTf, { onStats, onSource })
  const [area, height] = useHeight()
  const frame = TIMEFRAMES.find((t) => t.key === tf) ?? TIMEFRAMES[3]
  const minutes = frame.minutes
  const bars = React.useMemo(() => feed.candles.slice(-frame.count), [feed.candles, frame.count])

  return (
    <div className={cn("flex h-full flex-col gap-2 p-3 sm:p-4", className)}>
      {toolbar && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div role="tablist" aria-label="Timeframe" className="scrollbar-none flex gap-0.5 overflow-x-auto">
            {TIMEFRAMES.map((t) => {
              const off = !feed.available.includes(t.key)
              return (
                <button
                  key={t.key}
                  role="tab"
                  type="button"
                  aria-selected={tf === t.key}
                  disabled={off}
                  title={off ? "Not available for this token's price source" : undefined}
                  onClick={() => setTf(t.key)}
                  className={cn(
                    "relative h-8 rounded-lg px-2.5 text-[12.5px] font-semibold tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-35",
                    tf === t.key ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tf === t.key && <motion.span layoutId="tf-pill" transition={SLIDE} className="absolute inset-0 rounded-lg bg-primary/[0.1]" />}
                  <span className="relative">{t.label}</span>
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowMA((v) => !v)}
              aria-pressed={showMA}
              className={cn(
                "h-8 rounded-lg border px-2.5 text-[12px] font-semibold transition-colors",
                showMA ? "border-primary/40 text-primary" : "border-foreground/[0.07] text-muted-foreground hover:text-foreground",
              )}
            >
              MA
            </button>
            <div className="grid grid-cols-2 gap-0.5 rounded-lg border border-foreground/[0.07] p-0.5">
              {(["candles", "line"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  aria-pressed={kind === k}
                  disabled={feed.asLine && k === "candles"}
                  title={feed.asLine && k === "candles" ? "This token's price source has no candles, only prices" : undefined}
                  className={cn(
                    "h-7 rounded-md px-2.5 text-[12px] font-semibold capitalize transition-colors disabled:cursor-not-allowed disabled:opacity-35",
                    (feed.asLine ? k === "line" : kind === k) ? "bg-foreground/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      <div ref={area} className="min-h-0 flex-1">
        {height > 0 && (
          <CandleChart
            feed={bars}
            state={feed.state}
            kind={kind}
            showMA={toolbar && showMA}
            asLine={feed.asLine}
            minutesPerCandle={minutes}
            height={Math.max(120, height - 24)}
            className="pt-6"
          />
        )}
      </div>
    </div>
  )
}

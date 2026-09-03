"use client"

/**
 * The pair's recent rate — Pro's chart, above the ticket.
 *
 * There is no endpoint that serves "the ETH/USDC rate", and inventing one on
 * the client would be the same mistake the old Sparkline made when it drew a
 * zig-zag from the sign of a percentage. So this asks the candle route for
 * each side's dollar price on the SAME interval and divides them. Both series
 * come back bucketed to identical timestamps (see `bucketPrices` in
 * lib/chart-ohlcv), so the division lines up bar for bar and every point on
 * this line is two real prices, not an interpolation.
 *
 * When either side has no history the chart says so and draws nothing. A pair
 * chart that is guessing is worse than a pair chart that is absent.
 */

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { ChartLineData01Icon } from "@hugeicons/core-free-icons"

import { CardShell, CardHeader, Segmented, DeltaChip } from "@/components/ui/system"
import { Skeleton } from "@/components/ui/skeleton"
import { qty } from "@/lib/num"
import type { CoinData } from "@/lib/actions"

/**
 * The windows on offer, and the bar each is drawn at.
 *
 * These are the intervals the price-series source can actually serve — it
 * samples at five minutes at the finest, so a one-minute bar is not offered
 * rather than offered and returned empty.
 */
const RANGES = [
  { key: "1D" as const, label: "1D", interval: "15m", seconds: 24 * 60 * 60 },
  { key: "1W" as const, label: "1W", interval: "1h", seconds: 7 * 24 * 60 * 60 },
  { key: "1M" as const, label: "1M", interval: "4h", seconds: 30 * 24 * 60 * 60 },
]
type RangeKey = (typeof RANGES)[number]["key"]

type Candle = { time: number; close: number }

async function loadSeries(coinId: string, interval: string, signal?: AbortSignal): Promise<Candle[]> {
  const url = new URL("/api/charts/ohlcv", window.location.origin)
  url.searchParams.set("cg", coinId)
  url.searchParams.set("interval", interval)
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Rate history returned ${response.status}`)
  const body = (await response.json()) as { candles?: Candle[] }
  return body.candles ?? []
}

/* ── The line ──────────────────────────────────────────────────────────── */

/**
 * The plot.
 *
 * Drawn in a unit viewBox stretched to the card with `preserveAspectRatio
 * none`, so it fills whatever width the column has; `non-scaling-stroke` keeps
 * the line an even 1.5px through that stretch instead of turning into a wedge.
 * Direction takes the credit/debit pair, the same reading the house Sparkline
 * gives a price series.
 */
function RateLine({ points }: { points: number[] }) {
  const id = React.useId()
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  const flat = max - min < Number.EPSILON
  const y = (value: number) => (flat ? 22 : 42 - ((value - min) / span) * 40)
  const x = (index: number) => (index / (points.length - 1)) * 100
  const line = points.map((value, index) => `${x(index).toFixed(3)},${y(value).toFixed(3)}`).join(" ")
  const up = points[points.length - 1] >= points[0]
  const stroke = up ? "var(--credit)" : "var(--debit)"

  return (
    <svg
      viewBox="0 0 100 44"
      preserveAspectRatio="none"
      aria-hidden
      className="h-36 w-full sm:h-44"
    >
      <defs>
        <linearGradient id={`rate-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.24" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,44 ${line} 100,44`} fill={`url(#rate-${id})`} />
      <polyline
        points={line}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

/* ── The card ──────────────────────────────────────────────────────────── */

export function SwapRateChart({
  fromCoin,
  toCoin,
}: {
  fromCoin: CoinData | null
  toCoin: CoinData | null
}) {
  const [rangeKey, setRangeKey] = React.useState<RangeKey>("1W")
  const range = RANGES.find((option) => option.key === rangeKey) ?? RANGES[1]

  const fromId = fromCoin?.id
  const toId = toCoin?.id

  const fromSeries = useQuery({
    queryKey: ["swap-rate-series", fromId, range.interval],
    queryFn: ({ signal }) => loadSeries(fromId!, range.interval, signal),
    enabled: Boolean(fromId),
    staleTime: 60_000,
  })
  const toSeries = useQuery({
    queryKey: ["swap-rate-series", toId, range.interval],
    queryFn: ({ signal }) => loadSeries(toId!, range.interval, signal),
    enabled: Boolean(toId),
    staleTime: 60_000,
  })

  const points = React.useMemo(() => {
    const left = fromSeries.data
    const right = toSeries.data
    if (!left?.length || !right?.length) return []
    const denominator = new Map(right.map((candle) => [candle.time, candle.close]))
    /* The window is measured back from the newest BAR, not from the wall
       clock. Two reasons: reading the clock during render is impure and would
       make the memo unstable, and when the upstream is running late the honest
       answer is still the last day of data it has rather than an empty pane. */
    const cutoff = left[left.length - 1].time - range.seconds
    const values: number[] = []
    for (const candle of left) {
      if (candle.time < cutoff) continue
      const other = denominator.get(candle.time)
      if (!other || other <= 0 || !(candle.close > 0)) continue
      values.push(candle.close / other)
    }
    return values
  }, [fromSeries.data, toSeries.data, range.seconds])

  const loading = fromSeries.isPending || toSeries.isPending
  const latest = points.length > 0 ? points[points.length - 1] : null
  const changePct =
    points.length > 1 && points[0] > 0 ? ((points[points.length - 1] - points[0]) / points[0]) * 100 : null

  return (
    <CardShell>
      <CardHeader
        title="Rate history"
        subtitle={fromCoin && toCoin ? `${fromCoin.symbol} priced in ${toCoin.symbol}` : "Pick a pair"}
        right={
          <Segmented<RangeKey>
            size="sm"
            value={rangeKey}
            onChange={setRangeKey}
            options={RANGES.map((option) => ({ key: option.key, label: option.label }))}
          />
        }
      />

      <div className="flex flex-col gap-3 px-4 pb-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {loading ? (
            <Skeleton className="h-8 w-40" />
          ) : latest !== null && fromCoin && toCoin ? (
            <>
              <span className="font-display text-[26px] font-light leading-none tracking-[-0.02em] tabular-nums">
                {qty(latest)}
              </span>
              <span className="text-[13px] text-muted-foreground">
                {toCoin.symbol} per {fromCoin.symbol}
              </span>
              {changePct !== null && <DeltaChip value={changePct} />}
            </>
          ) : null}
        </div>

        {loading ? (
          <Skeleton className="h-36 w-full sm:h-44" />
        ) : points.length > 1 ? (
          <RateLine points={points} />
        ) : (
          /* No series, no line. The card stays — it is a Pro pane someone
             asked for — but it states the gap rather than drawing over it. */
          <div className="flex h-36 flex-col items-center justify-center gap-2 text-center sm:h-44">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/[0.12]">
              <HugeiconsIcon icon={ChartLineData01Icon} className="h-[18px] w-[18px] text-primary" />
            </span>
            <span className="max-w-xs text-[12.5px] text-muted-foreground">
              No rate history for this pair yet.
            </span>
          </div>
        )}
      </div>
    </CardShell>
  )
}

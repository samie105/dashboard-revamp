"use client"

/**
 * Rate history.
 *
 * The live version is the tallest thing on the page — a full-width, near
 * half-screen green area chart carrying one figure — while the swap form it
 * exists to inform sits below the fold. It is the wrong size for what it
 * says, so here it is a strip: the rate, the move, a range control and a
 * curve, in the height a supporting fact deserves.
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import { CardShell, CardHeader, Segmented } from "@/components/ui/system"
import { CARD_HUE } from "@/components/ui/surface"
import { MiniSpark } from "@/components/ui/charts"
import {
  RANGES,
  formatRate,
  rateSeries,
  tokenByKey,
  type RangeKey,
} from "@/components/swap-unauth/swap-data"

export function RateChart({ fromKey, toKey }: { fromKey: string; toKey: string }) {
  const [range, setRange] = React.useState<RangeKey>("1w")
  const from = tokenByKey(fromKey)
  const to = tokenByKey(toKey)

  const series = React.useMemo(() => rateSeries(from, to, range), [from, to, range])
  const first = series[0]
  const last = series[series.length - 1]
  const changePct = first === 0 ? 0 : ((last - first) / first) * 100
  const up = changePct >= 0
  const spec = RANGES.find((r) => r.key === range) ?? RANGES[1]

  return (
    <CardShell className={CARD_HUE}>
      <CardHeader
        title="Rate history"
        subtitle={`${from.symbol} priced in ${to.symbol} · last ${spec.window}`}
        right={
          <Segmented
            size="sm"
            options={RANGES.map((r) => ({ key: r.key, label: r.label }))}
            value={range}
            onChange={(k) => setRange(k as RangeKey)}
          />
        }
      />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 pb-4">
        <span className="flex flex-col">
          <span className="flex items-baseline gap-2">
            <span className="font-display text-[24px] font-light leading-none tabular-nums">
              {formatRate(last)}
            </span>
            <span className="text-[12px] text-muted-foreground">
              {to.symbol} per {from.symbol}
            </span>
          </span>
          <span className="mt-1 flex items-center gap-2">
            {/* Derived from the series drawn beside it, so the sign and the
                curve cannot disagree. */}
            <span className={cn("text-[12.5px] font-semibold tabular-nums", up ? "text-credit" : "text-debit")}>
              {up ? "+" : ""}
              {changePct.toFixed(2)}%
            </span>
            <span className="text-[11.5px] text-muted-foreground">over {spec.window}</span>
          </span>
        </span>
        <MiniSpark points={series} tone="direction" width={240} height={44} className="ml-auto w-full max-w-sm" />
      </div>
    </CardShell>
  )
}

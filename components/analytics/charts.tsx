"use client"

/**
 * The analytics page's charts, hand-built on the app's tokens so they follow
 * light and dark with the rest of the page.
 *
 * Marks follow one spec: columns at most 24px wide with a 4px rounded data
 * end and a square baseline, 8px thin bars, hairline solid gridlines, text
 * in text tokens (never the series colour). Every chart has a hover/focus
 * readout, and the flow chart has a table view.
 *
 * Colour does one job per chart. Flow: money in (credit) rises above the
 * baseline, money out (debit) hangs below it, so direction is carried by
 * position as well as hue (the red/green pair is close under deuteranopia).
 * Breakdowns: one series, one colour. Rhythm: one hue, more is stronger.
 * Outcomes: the status colours, each with its label beside it.
 */

import * as React from "react"

import { cn } from "@/lib/utils"
import { Figure } from "@/components/dashboard/redesign/ui"
import { BLOCKS, WEEKDAYS, type FlowBucket, type Slice } from "@/lib/analytics-view"
/** Dollars and cents, always: "$73,944.58", never a token's six decimals. */
export const usd = (n: number) => {
  const a = Math.abs(n)
  if (a > 0 && a < 0.01) return `${n < 0 ? "−" : ""}<$0.01`
  return `${n < 0 ? "−" : ""}$${a.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** $1,240 / $12.4K / $1.2M for axis ends, where width is tight. */
export function compactUsd(n: number) {
  return `$${new Intl.NumberFormat("en-US", { notation: n >= 10_000 ? "compact" : "standard", maximumFractionDigits: n >= 10_000 ? 1 : 0 }).format(n)}`
}

/* ── Flow ─────────────────────────────────────────────────────────────── */

function bucketLabel(b: FlowBucket, long = false) {
  if (b.span === "month") return b.start.toLocaleDateString("en-US", { month: long ? "long" : "short", year: long ? "numeric" : undefined })
  const day = b.start.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  if (b.span === "day") return long ? b.start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : day
  return long ? `Week of ${day}` : day
}

function Readout({ b }: { b: FlowBucket }) {
  const net = b.in - b.out
  return (
    <div className="flex min-w-[172px] flex-col gap-2 rounded-xl border border-foreground/[0.08] bg-popover px-3 py-2.5 text-[12px] shadow-lg">
      <span className="font-semibold text-foreground">{bucketLabel(b, true)}</span>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 tabular-nums">
        <dt className="flex items-center gap-1.5 text-muted-foreground">
          <span aria-hidden className="size-2 rounded-[2px] bg-credit" />
          In
        </dt>
        <dd className="text-right text-foreground"><Figure>{usd(b.in)}</Figure></dd>
        <dt className="flex items-center gap-1.5 text-muted-foreground">
          <span aria-hidden className="size-2 rounded-[2px] bg-debit" />
          Out
        </dt>
        <dd className="text-right text-foreground"><Figure>{usd(b.out)}</Figure></dd>
        <dt className="text-muted-foreground">Net</dt>
        <dd className="text-right font-semibold text-foreground"><Figure>{`${net >= 0 ? "+" : "−"}${usd(Math.abs(net))}`}</Figure></dd>
        <dt className="text-muted-foreground">Transactions</dt>
        <dd className="text-right text-foreground">{b.count}</dd>
      </dl>
    </div>
  )
}

/**
 * Money in above the baseline, money out below it, one column per bucket on
 * one scale. Hover a column, or focus the chart and use the arrow keys.
 */
export function FlowChart({ buckets, className }: { buckets: FlowBucket[]; className?: string }) {
  const [active, setActive] = React.useState<number | null>(null)
  const maxIn = Math.max(0, ...buckets.map((b) => b.in))
  const maxOut = Math.max(0, ...buckets.map((b) => b.out))
  const total = maxIn + maxOut
  // Where the baseline sits: the share of the height money in needs.
  const split = total > 0 ? (maxIn > 0 && maxOut > 0 ? maxIn / total : maxIn > 0 ? 1 : 0) : 0.5
  const n = buckets.length
  const labelIdx = n <= 1 ? [0] : n <= 8 ? buckets.map((_, i) => i) : [0, Math.floor((n - 1) / 2), n - 1]

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault()
      setActive((i) => {
        const cur = i ?? (e.key === "ArrowRight" ? -1 : n)
        return Math.min(n - 1, Math.max(0, cur + (e.key === "ArrowRight" ? 1 : -1)))
      })
    } else if (e.key === "Escape") setActive(null)
  }

  const a = active != null ? buckets[active] : null

  return (
    <div className={cn("flex flex-1 flex-col gap-2", className)}>
      {/* Grows with its panel, so it never leaves a gap beside a taller neighbour. */}
      <div className="flex min-h-[200px] flex-1 gap-3 md:min-h-[232px]">
        {/* Axis ends: the largest in and out, on the one scale. */}
        <div aria-hidden className="relative w-12 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
          {maxIn > 0 && <span className="absolute right-0 top-0 -translate-y-1/2"><Figure mask="•••">{compactUsd(maxIn)}</Figure></span>}
          <span className="absolute right-0 -translate-y-1/2" style={{ top: `${split * 100}%` }}>$0</span>
          {maxOut > 0 && <span className="absolute bottom-0 right-0 translate-y-1/2"><Figure mask="•••">{`−${compactUsd(maxOut)}`}</Figure></span>}
        </div>
        <div
          role="group"
          tabIndex={0}
          aria-label={`Money in and out, ${buckets.length} ${buckets[0]?.span ?? "day"}s. Use the arrow keys to read each one.`}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
          onMouseLeave={() => setActive(null)}
          className="relative flex-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-foreground/[0.06]" />
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-foreground/[0.06]" />
          <span aria-hidden className="absolute inset-x-0 h-px bg-foreground/[0.16]" style={{ top: `${split * 100}%` }} />
          <div className="absolute inset-0 flex">
            {buckets.map((b, i) => (
              <div
                key={b.start.getTime()}
                onMouseEnter={() => setActive(i)}
                className={cn("relative flex h-full flex-1 justify-center px-px", active === i && "bg-foreground/[0.035]")}
              >
                {b.in > 0 && (
                  <span
                    aria-hidden
                    className="absolute w-[min(24px,calc(100%-2px))] rounded-t-[4px] bg-credit"
                    style={{ bottom: `${(1 - split) * 100}%`, height: `max(2px, ${(b.in / total) * 100}%)` }}
                  />
                )}
                {b.out > 0 && (
                  <span
                    aria-hidden
                    className="absolute w-[min(24px,calc(100%-2px))] rounded-b-[4px] bg-debit"
                    style={{ top: `${split * 100}%`, height: `max(2px, ${(b.out / total) * 100}%)` }}
                  />
                )}
              </div>
            ))}
          </div>
          <span className="sr-only" aria-live="polite">
            {a ? `${bucketLabel(a, true)}: in ${usd(a.in)}, out ${usd(a.out)}, ${a.count} transactions` : ""}
          </span>
          {a && active != null && (
            <div
              aria-hidden
              className="pointer-events-none absolute top-2 z-10"
              style={active < n / 2 ? { left: `calc(${((active + 1) / n) * 100}% + 8px)` } : { right: `calc(${((n - active) / n) * 100}% + 8px)` }}
            >
              <Readout b={a} />
            </div>
          )}
        </div>
      </div>
      <div aria-hidden className="relative ml-[60px] h-4 text-[11px] text-muted-foreground">
        {labelIdx.map((i) => (
          <span
            key={i}
            className={cn("absolute whitespace-nowrap", i === 0 ? "left-0" : i === n - 1 ? "right-0" : "-translate-x-1/2")}
            style={i === 0 || i === n - 1 ? undefined : { left: `${((i + 0.5) / n) * 100}%` }}
          >
            {bucketLabel(buckets[i])}
          </span>
        ))}
      </div>
    </div>
  )
}

/** The flow chart's table view: every bucket that had activity, newest first. */
export function FlowTable({ buckets }: { buckets: FlowBucket[] }) {
  const rows = buckets.filter((b) => b.count > 0).reverse()
  return (
    <div className="max-h-[256px] overflow-auto">
      <table className="w-full text-[12.5px] tabular-nums">
        <thead className="sticky top-0 bg-card text-left text-[11.5px] text-muted-foreground">
          <tr>
            <th className="py-2 pr-3 font-medium">Period</th>
            <th className="py-2 pr-3 text-right font-medium">In</th>
            <th className="py-2 pr-3 text-right font-medium">Out</th>
            <th className="py-2 pr-3 text-right font-medium">Net</th>
            <th className="py-2 text-right font-medium">Count</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => {
            const net = b.in - b.out
            return (
              <tr key={b.start.getTime()} className="border-t border-foreground/[0.06]">
                <td className="py-2 pr-3 text-foreground">{bucketLabel(b, true)}</td>
                <td className="py-2 pr-3 text-right"><Figure>{usd(b.in)}</Figure></td>
                <td className="py-2 pr-3 text-right"><Figure>{usd(b.out)}</Figure></td>
                <td className="py-2 pr-3 text-right font-semibold"><Figure>{`${net >= 0 ? "+" : "−"}${usd(Math.abs(net))}`}</Figure></td>
                <td className="py-2 text-right text-muted-foreground">{b.count}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ── Ranked bars ──────────────────────────────────────────────────────── */

/**
 * One series, ranked by count. The count leads; the USD figure follows and
 * says when some rows had no price, rather than presenting a partial sum as
 * the whole.
 */
export function RankedBars({ slices, pricesReady }: { slices: Slice[]; pricesReady: boolean }) {
  const max = Math.max(1, ...slices.map((s) => s.count))
  return (
    <ul className="flex flex-col gap-4">
      {slices.map((s) => {
        const value = !pricesReady ? "—" : s.unpriced === s.count ? "No price" : usd(s.usd)
        return (
          <li key={s.key} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="min-w-0 truncate font-medium text-foreground">{s.label}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                <span className="font-semibold text-foreground">{s.count}</span>
                <span aria-hidden> · </span>
                <span className="sr-only">, </span>
                {/* Some rows had no price: the sum is a floor, and says so. */}
                <span title={pricesReady && s.unpriced > 0 && s.unpriced < s.count ? `At least: ${s.unpriced} without a price` : undefined}>
                  {pricesReady && s.unpriced > 0 && s.unpriced < s.count && "≥"}
                  <Figure mask="•••">{value}</Figure>
                </span>
              </span>
            </div>
            <span aria-hidden className="h-2 overflow-hidden rounded-full bg-foreground/[0.06]">
              <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(2, (s.count / max) * 100)}%` }} />
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/* ── Segmented bar ────────────────────────────────────────────────────── */

export type Segment = { key: string; label: string; value: number; className: string }

/** One whole split into parts: an 8px bar with a 2px gap between parts. */
export function SegmentBar({ segments, label }: { segments: Segment[]; label: string }) {
  const total = segments.reduce((n, s) => n + s.value, 0)
  const parts = segments.filter((s) => s.value > 0)
  return (
    <div
      role="img"
      aria-label={`${label}: ${segments.map((s) => `${s.label} ${s.value}`).join(", ")}`}
      className="flex h-2 gap-[2px] overflow-hidden rounded-full bg-foreground/[0.06]"
    >
      {total > 0 &&
        parts.map((s) => (
          <span key={s.key} title={`${s.label}: ${s.value}`} className={cn("h-full first:rounded-l-full last:rounded-r-full", s.className)} style={{ flexGrow: s.value, flexBasis: 0 }} />
        ))}
    </div>
  )
}

/* ── Rhythm ───────────────────────────────────────────────────────────── */

const HOURS = Array.from({ length: BLOCKS }, (_, i) => i * 3)
const pad = (h: number) => String(h).padStart(2, "0")
export const blockLabel = (b: number) => `${pad(HOURS[b])}:00–${pad((HOURS[b] + 3) % 24)}:00`

/** Four steps of one hue; empty cells sit on the track colour. */
const STEPS = ["bg-primary/25", "bg-primary/45", "bg-primary/70", "bg-primary"]
function stepOf(v: number, max: number) {
  if (v <= 0 || max <= 0) return "bg-foreground/[0.05]"
  return STEPS[Math.min(STEPS.length - 1, Math.ceil((v / max) * STEPS.length) - 1)]
}

/** Transactions per weekday and three-hour block, in the viewer's time zone. */
export function RhythmGrid({ grid }: { grid: number[][] }) {
  const max = Math.max(0, ...grid.flat())
  const [active, setActive] = React.useState<{ d: number; b: number } | null>(null)
  const v = active ? grid[active.d][active.b] : null
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[32px_repeat(8,minmax(0,1fr))] gap-1 sm:gap-1.5" onMouseLeave={() => setActive(null)}>
        <span />
        {HOURS.map((h) => (
          <span key={h} aria-hidden className="text-[10.5px] tabular-nums text-muted-foreground">
            {pad(h)}
          </span>
        ))}
        {WEEKDAYS.map((day, d) => (
          <React.Fragment key={day}>
            <span className="self-center text-[11px] text-muted-foreground">{day}</span>
            {grid[d].map((count, b) => (
              <span
                key={b}
                role="img"
                aria-label={`${day} ${blockLabel(b)}: ${count} transaction${count === 1 ? "" : "s"}`}
                onMouseEnter={() => setActive({ d, b })}
                className={cn(
                  "h-6 rounded-[4px] transition-shadow sm:h-7",
                  stepOf(count, max),
                  active?.d === d && active.b === b && "ring-2 ring-foreground/30 ring-offset-1 ring-offset-card",
                )}
              />
            ))}
          </React.Fragment>
        ))}
      </div>
      <div className="flex min-h-5 flex-wrap items-center justify-between gap-x-4 gap-y-2 pl-[36px] text-[11.5px] text-muted-foreground">
        <span aria-live="polite" className="tabular-nums">
          {active && v != null ? (
            <>
              <span className="font-semibold text-foreground">
                {WEEKDAYS[active.d]} {blockLabel(active.b)}
              </span>{" "}
              · {v} transaction{v === 1 ? "" : "s"}
            </>
          ) : (
            "Hover a cell for its count"
          )}
        </span>
        <span aria-hidden className="flex items-center gap-1.5">
          Fewer
          <span className="size-3 rounded-[3px] bg-foreground/[0.05]" />
          {STEPS.map((s) => (
            <span key={s} className={cn("size-3 rounded-[3px]", s)} />
          ))}
          More
        </span>
      </div>
    </div>
  )
}

"use client"

/**
 * Chart primitives for the /dashboard-unauth preview.
 *
 * House rules these follow:
 *  · Money direction is the ONLY thing that earns emerald/red — the portfolio
 *    curve and the P&L figures. Gold stays brand/primary/active.
 *  · Composition (the allocation donut) uses the system's ALLOCATION_RAMP, so
 *    colour encodes RANK, not identity.
 *  · Every figure is tabular so live-looking values don't jitter.
 *
 * The area chart stretches with `preserveAspectRatio="none"`, so its stroke
 * carries `vectorEffect="non-scaling-stroke"` (otherwise a wide viewport
 * smears the line) and anything that must stay round — the "now" dot, the
 * hover marker — is an HTML overlay positioned in percentages rather than an
 * SVG circle, which would squash.
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import { allocationColor } from "@/components/ui/system"

/* ── Path maths ─────────────────────────────────────────────────────────── */

const VB_W = 1000
const VB_H = 260

function scale(points: number[], pad = 14) {
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  const x = (i: number) => (i / (points.length - 1)) * VB_W
  const y = (v: number) => VB_H - pad - ((v - min) / span) * (VB_H - pad * 2)
  return { x, y, min, max }
}

/** Catmull-Rom → cubic Bézier. A price curve reads as a curve, not a polygon. */
function smoothPath(points: number[], x: (i: number) => number, y: (v: number) => number) {
  if (points.length < 2) return ""
  let d = `M ${x(0).toFixed(2)} ${y(points[0]).toFixed(2)}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]
    const c1x = x(i) + (x(i + 1) - x(Math.max(0, i - 1))) / 6
    const c1y = y(p1) + (y(p2) - y(p0)) / 6
    const c2x = x(i + 1) - (x(Math.min(points.length - 1, i + 2)) - x(i)) / 6
    const c2y = y(p2) - (y(p3) - y(p1)) / 6
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${x(i + 1).toFixed(2)} ${y(p2).toFixed(2)}`
  }
  return d
}

/* ── AreaChart — the portfolio performance curve ────────────────────────── */

export function AreaChart({
  points,
  labels,
  format,
  tone = "brand",
  className,
  height = 220,
}: {
  points: number[]
  /** One label per point, for the hover readout. */
  labels?: string[]
  format: (v: number) => string
  /**
   * "brand" paints the curve gold; "direction" paints it emerald/red from the
   * series' own sign.
   *
   * The hero curve is BRAND. Green is the page's direction language, and with
   * a full-width green area chart on top of green sparklines, green chips and
   * green table cells, the one colour that was supposed to mean "up" was just
   * the colour of the page. The signed figures beside the chart still carry
   * the direction; the chart carries the identity.
   */
  tone?: "brand" | "direction"
  className?: string
  height?: number
}) {
  const id = React.useId()
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const [hover, setHover] = React.useState<number | null>(null)

  const { x, y, min, max } = React.useMemo(() => scale(points), [points])
  const line = React.useMemo(() => smoothPath(points, x, y), [points, x, y])
  const area = `${line} L ${VB_W} ${VB_H} L 0 ${VB_H} Z`

  const up = points[points.length - 1] >= points[0]
  const stroke =
    tone === "brand" ? "var(--primary)" : up ? "var(--credit)" : "var(--debit)"

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = wrapRef.current?.getBoundingClientRect()
    if (!box || box.width === 0) return
    const t = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width))
    setHover(Math.round(t * (points.length - 1)))
  }

  const i = hover
  const hoverLeftPct = i === null ? 0 : (i / (points.length - 1)) * 100
  const hoverTopPct = i === null ? 0 : (y(points[i]) / VB_H) * 100
  const nowTopPct = (y(points[points.length - 1]) / VB_H) * 100

  return (
    <div
      ref={wrapRef}
      className={cn("relative w-full touch-none", className)}
      style={{ height }}
      onPointerMove={onMove}
      onPointerLeave={() => setHover(null)}
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        aria-hidden
        className="h-full w-full overflow-visible"
      >
        <defs>
          <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.30" />
            <stop offset="55%" stopColor={stroke} stopOpacity="0.07" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Four hairline rules. A price chart without a grid is a shape; with
            one it is a measurement. */}
        {[0.18, 0.42, 0.66, 0.9].map((f) => (
          <line
            key={f}
            x1="0"
            x2={VB_W}
            y1={VB_H * f}
            y2={VB_H * f}
            stroke="currentColor"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            className="text-foreground/[0.06]"
          />
        ))}
        <path d={area} fill={`url(#area-${id})`} />
        <path
          d={line}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          className="spark-line"
        />
        {i !== null && (
          <line
            x1={x(i)}
            x2={x(i)}
            y1="0"
            y2={VB_H}
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
            className="text-foreground/25"
          />
        )}
      </svg>

      {/* The "now" dot and its halo — HTML, so they stay circular however wide
          the card gets. */}
      <span
        aria-hidden
        className="spark-dot pointer-events-none absolute -ml-[4px] -mt-[4px] h-2 w-2 rounded-full"
        style={{ left: "100%", top: `${nowTopPct}%`, background: stroke, boxShadow: `0 0 0 4px color-mix(in oklab, ${stroke} 22%, transparent)` }}
      />

      {i !== null && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute -ml-[4px] -mt-[4px] h-2 w-2 rounded-full ring-2 ring-background"
            style={{ left: `${hoverLeftPct}%`, top: `${hoverTopPct}%`, background: stroke }}
          />
          <div
            className="ws-card-glass pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg bg-card/80 px-2.5 py-1.5 text-center shadow-lg ring-1 ring-border/50"
            style={{ left: `${Math.min(92, Math.max(8, hoverLeftPct))}%` }}
          >
            <span className="block text-[13px] font-semibold tabular-nums">{format(points[i])}</span>
            {labels?.[i] && (
              <span className="block text-[11px] text-muted-foreground">{labels[i]}</span>
            )}
          </div>
        </>
      )}

      {/* Value axis — the band the curve actually lives in. */}
      <span className="pointer-events-none absolute right-0 top-0 text-[11px] tabular-nums text-muted-foreground/70">
        {format(max)}
      </span>
      <span className="pointer-events-none absolute bottom-0 right-0 text-[11px] tabular-nums text-muted-foreground/70">
        {format(min)}
      </span>
    </div>
  )
}

/* ── MiniSpark — the small in-row curve ───────────────────────────────────
   The system's own <Sparkline> always colours itself from the series' sign,
   which is right on a screen with two or three of them and wrong on this one:
   a dozen little green ticks made "up" the page's wallpaper. Here the SHAPE
   is the message and the signed percentage beside it carries the direction,
   so the default tone is neutral ink and gold is reserved for the one curve
   that is the card's subject. ─────────────────────────────────────────────── */

export function MiniSpark({
  points,
  tone = "muted",
  width = 64,
  height = 24,
  className,
}: {
  points: number[] | undefined
  tone?: "muted" | "brand" | "direction"
  width?: number
  height?: number
  className?: string
}) {
  const id = React.useId()
  if (!points || points.length < 2) return null

  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  const pad = 1.5
  const flat = max - min < Number.EPSILON
  const y = (v: number) => (flat ? height / 2 : height - pad - ((v - min) / span) * (height - pad * 2))
  const x = (i: number) => (i / (points.length - 1)) * width
  const line = points.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ")

  const up = points[points.length - 1] >= points[0]
  const stroke =
    tone === "brand"
      ? "var(--primary)"
      : tone === "direction"
        ? up
          ? "var(--credit)"
          : "var(--debit)"
        : "var(--muted-foreground)"

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      className={cn("shrink-0 overflow-visible", className)}
    >
      <defs>
        <linearGradient id={`ms-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={tone === "muted" ? "0.18" : "0.26"} />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${line} ${width},${height}`} fill={`url(#ms-${id})`} />
      <polyline
        points={line}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={tone === "muted" ? 0.7 : 1}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

/* ── Donut — allocation by rank ─────────────────────────────────────────── */

export function Donut({
  slices,
  size = 132,
  thickness = 14,
  children,
}: {
  slices: { label: string; value: number }[]
  size?: number
  thickness?: number
  children?: React.ReactNode
}) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r

  // Arc lengths and their running offsets, computed BEFORE the JSX. An
  // accumulator mutated inside .map() is a reassignment during render, which
  // the compiler's immutability rule (correctly) rejects.
  const arcs = slices.reduce<{ len: number; offset: number }[]>((acc, s) => {
    const prev = acc[acc.length - 1]
    const len = (s.value / total) * c
    acc.push({ len, offset: prev ? prev.offset + prev.len : 0 })
    return acc
  }, [])

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={thickness}
          className="stroke-foreground/[0.06]"
        />
        {slices.map((s, i) => {
          // A 2px gap between slices, so neighbouring rungs of the gold ladder
          // stay distinguishable where their tones are close.
          const drawn = Math.max(0, arcs[i].len - 2)
          return (
            <circle
              key={s.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              strokeWidth={thickness}
              strokeLinecap="round"
              stroke={allocationColor(i)}
              strokeDasharray={`${drawn} ${c - drawn}`}
              strokeDashoffset={-arcs[i].offset}
            />
          )
        })}
      </svg>
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
      )}
    </div>
  )
}

/* ── MoodGauge — Fear & Greed, 0–100 ────────────────────────────────────── */

/**
 * Fear is red, caution is amber, confidence is gold.
 *
 * This dial used to end in emerald, which put a third green object in a row
 * that already had two — and the sentiment index is not a money movement, so
 * it has no claim on the credit/debit pair. It keeps the red end (fear really
 * is the downside) and climbs into brand gold instead.
 */
function moodColor(score: number) {
  if (score < 25) return "var(--debit)"
  if (score < 50) return "var(--warning)"
  return "var(--primary)"
}

export function MoodGauge({ score, size = 148 }: { score: number; size?: number }) {
  const stroke = 12
  const r = (size - stroke) / 2
  // A 240° arc, opening downward — the dial idiom.
  const sweep = 240
  const c = 2 * Math.PI * r
  const arc = (sweep / 360) * c
  const filled = (Math.min(100, Math.max(0, score)) / 100) * arc
  const id = React.useId()

  return (
    <div className="relative" style={{ width: size, height: size * 0.72 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="absolute left-0 top-0">
        <defs>
          <linearGradient id={`mood-${id}`} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--debit)" />
            <stop offset="50%" stopColor="var(--warning)" />
            <stop offset="100%" stopColor="var(--primary)" />
          </linearGradient>
        </defs>
        <g transform={`rotate(${90 + (360 - sweep) / 2} ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${arc} ${c - arc}`}
            className="stroke-foreground/[0.07]"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            stroke={`url(#mood-${id})`}
            strokeDasharray={`${filled} ${c - filled}`}
          />
        </g>
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <span className="font-display text-[34px] font-light leading-none tabular-nums" style={{ color: moodColor(score) }}>
          {score}
        </span>
      </div>
    </div>
  )
}

/* ── ScoreRing — security strength ──────────────────────────────────────── */

export function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const stroke = 6
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const filled = (Math.min(100, Math.max(0, score)) / 100) * c
  // Security isn't money direction, but "are you covered?" is the same
  // question, so it borrows the same two answers.
  const tone = score >= 100 ? "var(--credit)" : score >= 60 ? "var(--warning)" : "var(--debit)"

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-foreground/[0.08]" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={tone}
          strokeDasharray={`${filled} ${c - filled}`}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold tabular-nums"
        style={{ color: tone }}
      >
        {score}%
      </span>
    </div>
  )
}

/* ── VolumeBars — monthly traded volume ─────────────────────────────────── */

export function VolumeBars({
  data,
  format,
}: {
  data: { month: string; value: number }[]
  format: (v: number) => string
}) {
  const max = Math.max(...data.map((d) => d.value)) || 1
  return (
    <div className="flex h-full gap-2">
      {data.map((d, i) => {
        const last = i === data.length - 1
        return (
          <div key={d.month} className="group flex h-full min-w-0 flex-1 flex-col items-center gap-1.5">
            <span
              className={cn(
                "text-[10px] font-medium tabular-nums transition-opacity",
                last ? "opacity-100" : "opacity-0 group-hover:opacity-100",
              )}
            >
              {format(d.value)}
            </span>
            {/* The track is flex-1 of a definite-height column, which is what
                gives the bar's percentage height something to resolve against. */}
            <span className="flex w-full flex-1 items-end">
              <span
                className={cn(
                  "w-full rounded-t-[4px] transition-colors",
                  // The current month is the one being reported; the rest are
                  // context, so only it takes the accent.
                  last ? "bg-primary/80" : "bg-foreground/[0.14] group-hover:bg-foreground/25",
                )}
                style={{ height: `${Math.max(6, (d.value / max) * 100)}%` }}
              />
            </span>
            <span className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">{d.month}</span>
          </div>
        )
      })}
    </div>
  )
}

"use client"

/**
 * PriceChart — the portfolio curve.
 *
 * Drawn at the container's REAL pixel size (measured with a ResizeObserver)
 * rather than stretched from a fixed viewBox, so the stroke stays one weight
 * edge to edge, the end dot stays round, and the axis labels can sit on the
 * exact gridlines they name.
 *
 * Every range carries the same number of points, which lets the line MORPH
 * from one range to the next instead of cutting — the single motion on this
 * page that tells you the data changed rather than the screen.
 */

import * as React from "react"
import { animate, motion, useMotionValue, useMotionValueEvent } from "motion/react"
import { cn } from "@/lib/utils"

const AXIS_W = 64 // room for "$48,900" on the right
const AXIS_H = 26 // room for the date row underneath
const PAD_TOP = 14

type Props = {
  points: number[]
  /** Tick labels for the x axis, spread evenly. Client-resolved, so optional. */
  ticks?: string[]
  /** One label per point, for the hover readout. */
  pointLabels?: string[]
  format: (v: number) => string
  formatAxis: (v: number) => string
  height?: number
  className?: string
}

/** Catmull-Rom → cubic Bézier, so a price curve reads as a curve. */
function smoothPath(xy: [number, number][]) {
  if (xy.length < 2) return ""
  let d = `M${xy[0][0].toFixed(2)},${xy[0][1].toFixed(2)}`
  for (let i = 0; i < xy.length - 1; i++) {
    const p0 = xy[Math.max(0, i - 1)]
    const p1 = xy[i]
    const p2 = xy[i + 1]
    const p3 = xy[Math.min(xy.length - 1, i + 2)]
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`
  }
  return d
}

/** Pad the band 12% each side so the curve never kisses the frame. */
function band(points: number[]) {
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || max * 0.01 || 1
  return { lo: min - span * 0.12, hi: max + span * 0.12 }
}

export function PriceChart({ points, ticks, pointLabels, format, formatAxis, height = 220, className }: Props) {
  const id = React.useId().replace(/:/g, "")
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const [width, setWidth] = React.useState(0)
  const [hover, setHover] = React.useState<number | null>(null)

  React.useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    ro.observe(el)
    setWidth(Math.round(el.getBoundingClientRect().width))
    return () => ro.disconnect()
  }, [])

  // On a range change both the POINTS and the vertical band tween from what
  // is on screen to the new series, driven by one progress value — so the
  // curve reshapes and re-scales as a single movement.
  const target = React.useMemo(() => band(points), [points])
  const progress = useMotionValue(1)
  const from = React.useRef({ points, band: target })
  const shown = React.useRef({ points, band: target })
  const [frame, setFrame] = React.useState(() => ({ points, band: target }))

  useMotionValueEvent(progress, "change", (t) => {
    const a = from.current
    const lerp = (p: number, q: number) => p + (q - p) * t
    const next = {
      points: points.map((v, i) => lerp(a.points[i] ?? v, v)),
      band: { lo: lerp(a.band.lo, target.lo), hi: lerp(a.band.hi, target.hi) },
    }
    shown.current = next
    setFrame(next)
  })

  React.useEffect(() => {
    if (shown.current.points === points) return
    from.current = shown.current
    progress.set(0)
    const anim = animate(progress, 1, { duration: 0.75, ease: [0.22, 1, 0.36, 1] })
    return () => anim.stop()
  }, [points, progress])

  const drawn = frame.points.length === points.length ? frame.points : points
  const plotW = Math.max(0, width - AXIS_W)
  const plotH = height - AXIS_H
  const span = frame.band.hi - frame.band.lo || 1
  const x = (i: number) => (i / (points.length - 1)) * plotW
  const y = (v: number) => PAD_TOP + (1 - (v - frame.band.lo) / span) * (plotH - PAD_TOP)

  const xy = drawn.map((v, i) => [x(i), y(v)] as [number, number])
  const line = smoothPath(xy)
  const area = line ? `${line} L${plotW.toFixed(2)},${plotH} L0,${plotH} Z` : ""

  // Four rules, labelled on the right. Values are the band's own quarters, so
  // the labels always describe the curve that is actually on screen.
  const rules = [0, 1, 2, 3].map((k) => {
    const v = target.hi - ((target.hi - target.lo) * (k + 0.5)) / 4
    return { v, y: y(v) }
  })

  const last = xy[xy.length - 1]
  const onMove = (e: React.PointerEvent) => {
    const box = wrapRef.current?.getBoundingClientRect()
    if (!box || plotW === 0) return
    const t = (e.clientX - box.left) / plotW
    if (t < 0 || t > 1.02) return setHover(null)
    setHover(Math.round(Math.min(1, Math.max(0, t)) * (points.length - 1)))
  }

  const hp = hover === null ? null : xy[hover]

  return (
    <div
      ref={wrapRef}
      className={cn("relative w-full select-none touch-pan-y", className)}
      style={{ height }}
      onPointerMove={onMove}
      onPointerLeave={() => setHover(null)}
    >
      {width > 0 && (
        <svg width={width} height={height} className="absolute inset-0 overflow-visible" aria-hidden>
          <defs>
            <linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
              <stop offset="60%" stopColor="var(--primary)" stopOpacity="0.06" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`stroke-${id}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.55" />
              <stop offset="35%" stopColor="var(--primary)" stopOpacity="1" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="1" />
            </linearGradient>
            <clipPath id={`clip-${id}`}>
              <rect x={0} y={0} width={plotW + 8} height={plotH} />
            </clipPath>
          </defs>

          {rules.map((r, k) => (
            <g key={k}>
              <line
                x1={0}
                x2={plotW}
                y1={r.y}
                y2={r.y}
                stroke="currentColor"
                className="text-white/[0.055]"
                strokeDasharray="2 5"
              />
              <text
                x={width}
                y={r.y}
                dy="0.32em"
                textAnchor="end"
                className="fill-muted-foreground/80 text-[11px] font-medium tabular-nums"
              >
                {formatAxis(r.v)}
              </text>
            </g>
          ))}

          <g clipPath={`url(#clip-${id})`}>
            <path d={area} fill={`url(#fill-${id})`} />
            {/* The glow is a blurred copy under the line, not a CSS filter on
                it — a filter on the stroke itself softens its edge too. */}
            <path d={line} fill="none" stroke="var(--primary)" strokeOpacity="0.35" strokeWidth={6} className="blur-[6px]" />
            <motion.path
              d={line}
              fill="none"
              stroke={`url(#stroke-${id})`}
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.4, ease: [0.65, 0, 0.35, 1] }}
            />
          </g>

          {hp && (
            <g>
              <line x1={hp[0]} x2={hp[0]} y1={PAD_TOP - 6} y2={plotH} className="stroke-primary/40" strokeDasharray="3 3" />
              <circle cx={hp[0]} cy={hp[1]} r={9} className="fill-primary/15" />
              <circle cx={hp[0]} cy={hp[1]} r={4.5} className="fill-primary stroke-background" strokeWidth={2} />
            </g>
          )}
        </svg>
      )}

      {/* "Now" — a live dot with a breathing halo. HTML, so the halo can use
          a CSS animation without restarting on every re-render. */}
      {width > 0 && last && hover === null && (
        <span
          aria-hidden
          className="pointer-events-none absolute"
          style={{ left: last[0], top: last[1] }}
        >
          <span className="absolute -left-[11px] -top-[11px] size-[22px] animate-[dash-ping_2.4s_cubic-bezier(0,0,0.2,1)_infinite] rounded-full bg-primary/35" />
          <span className="absolute -left-[5px] -top-[5px] size-[10px] rounded-full border-2 border-background bg-primary shadow-[0_0_14px_var(--primary)]" />
        </span>
      )}

      {hp && hover !== null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-xl border border-white/10 bg-[#141414]/95 px-3 py-2 shadow-[0_12px_32px_-8px_rgb(0_0_0/0.7)] backdrop-blur"
          style={{ left: Math.min(plotW - 56, Math.max(56, hp[0])), top: Math.max(0, hp[1] - 64) }}
        >
          <span className="block font-display text-[13.5px] font-semibold tabular-nums text-foreground">
            {format(points[hover])}
          </span>
          {pointLabels?.[hover] && (
            <span className="block text-[11px] font-medium text-muted-foreground">{pointLabels[hover]}</span>
          )}
        </div>
      )}

      {/* Date row — spread across the plot only, not under the value axis. */}
      <div
        className="absolute bottom-0 left-0 flex justify-between text-[11px] font-medium tabular-nums text-muted-foreground/80"
        style={{ width: plotW || "calc(100% - 64px)" }}
      >
        {(ticks ?? Array.from({ length: 7 }, () => "")).map((t, i) => (
          <span key={i} className="min-w-0 whitespace-nowrap">
            {t || " "}
          </span>
        ))}
      </div>
    </div>
  )
}

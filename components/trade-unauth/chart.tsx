"use client"

/**
 * The price chart.
 *
 * Two renderings, and the mode picks one: Simple gets an AREA chart, Pro gets
 * candles. The live screen shows candlesticks in Simple mode with no
 * timeframe control at all — a chart you can read four ways but cannot
 * change, in the mode built for people who do not read candles.
 *
 * Both draw with `preserveAspectRatio="none"` so they stretch to the pane, and
 * every stroke carries `vectorEffect="non-scaling-stroke"` so a wide viewport
 * does not smear the lines into wedges.
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import { formatPrice, type Candle } from "@/components/trade-unauth/trade-data"

const VB_W = 1000
const VB_H = 420
const PAD = 16

type Scale = {
  x: (i: number) => number
  y: (v: number) => number
  min: number
  max: number
}

function useScale(candles: Candle[], count: number): Scale {
  return React.useMemo(() => {
    const min = Math.min(...candles.map((c) => c.l))
    const max = Math.max(...candles.map((c) => c.h))
    const span = max - min || 1
    return {
      min,
      max,
      x: (i: number) => (i / Math.max(1, count - 1)) * VB_W,
      y: (v: number) => VB_H - PAD - ((v - min) / span) * (VB_H - PAD * 2),
    }
  }, [candles, count])
}

/** Gridlines + the right-hand price axis, shared by both renderings. */
function Grid() {
  const steps = [0, 0.25, 0.5, 0.75, 1]
  return (
    <g aria-hidden>
      {steps.map((f) => (
        <line
          key={f}
          x1="0"
          x2={VB_W}
          y1={PAD + f * (VB_H - PAD * 2)}
          y2={PAD + f * (VB_H - PAD * 2)}
          stroke="currentColor"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
          className="text-foreground/[0.055]"
        />
      ))}
    </g>
  )
}

function PriceAxis({ scale }: { scale: Scale }) {
  const steps = [0, 0.25, 0.5, 0.75, 1]
  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 flex w-16 flex-col justify-between py-[3.8%] text-right">
      {steps.map((f) => (
        <span key={f} className="text-[10.5px] tabular-nums text-muted-foreground/60">
          {formatPrice(scale.max - f * (scale.max - scale.min))}
        </span>
      ))}
    </div>
  )
}

/* ── Simple: an area chart ────────────────────────────────────────────────── */

export function AreaPrice({
  candles,
  height = "100%",
}: {
  candles: Candle[]
  /** A number is pixels; "100%" fills a parent that has a definite height. */
  height?: number | string
}) {
  const id = React.useId()
  const scale = useScale(candles, candles.length)
  const closes = candles.map((c) => c.c)
  const up = closes[closes.length - 1] >= closes[0]
  const stroke = up ? "var(--credit)" : "var(--debit)"

  const line = closes.map((v, i) => `${scale.x(i).toFixed(2)},${scale.y(v).toFixed(2)}`).join(" ")

  return (
    <div className="relative w-full pr-16" style={{ height }}>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" aria-hidden className="h-full w-full">
        <defs>
          <linearGradient id={`ap-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <Grid />
        <polygon points={`0,${VB_H} ${line} ${VB_W},${VB_H}`} fill={`url(#ap-${id})`} />
        <polyline
          points={line}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <PriceAxis scale={scale} />
    </div>
  )
}

/* ── Pro: candles + volume ────────────────────────────────────────────────── */

export function Candles({
  candles,
  height = "100%",
  onHover,
}: {
  candles: Candle[]
  height?: number | string
  onHover?: (c: Candle | null) => void
}) {
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const [hover, setHover] = React.useState<number | null>(null)
  const scale = useScale(candles, candles.length)
  const volMax = Math.max(...candles.map((c) => c.v)) || 1

  // Candles are drawn in a NON-stretched coordinate space for their bodies by
  // sizing them in viewBox units and accepting the stretch: the alternative
  // (HTML overlay per candle) costs 60 absolutely-positioned nodes per frame.
  const bodyW = Math.max(3, (VB_W / candles.length) * 0.62)

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = wrapRef.current?.getBoundingClientRect()
    if (!box || box.width === 0) return
    const t = Math.min(1, Math.max(0, (e.clientX - box.left) / (box.width - 64)))
    const i = Math.min(candles.length - 1, Math.round(t * (candles.length - 1)))
    setHover(i)
    onHover?.(candles[i] ?? null)
  }

  return (
    <div
      ref={wrapRef}
      className="relative w-full touch-none pr-16"
      style={{ height }}
      onPointerMove={onMove}
      onPointerLeave={() => {
        setHover(null)
        onHover?.(null)
      }}
    >
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" aria-hidden className="h-full w-full">
        <Grid />

        {/* Volume, in the bottom fifth — context, so it stays quiet. */}
        <g opacity="0.5">
          {candles.map((c, i) => {
            const h = (c.v / volMax) * (VB_H * 0.16)
            return (
              <rect
                key={`v${i}`}
                x={scale.x(i) - bodyW / 2}
                y={VB_H - h}
                width={bodyW}
                height={h}
                fill={c.c >= c.o ? "var(--credit)" : "var(--debit)"}
                opacity="0.35"
              />
            )
          })}
        </g>

        {candles.map((c, i) => {
          const rising = c.c >= c.o
          const colour = rising ? "var(--credit)" : "var(--debit)"
          const top = scale.y(Math.max(c.o, c.c))
          const bottom = scale.y(Math.min(c.o, c.c))
          return (
            <g key={i}>
              <line
                x1={scale.x(i)}
                x2={scale.x(i)}
                y1={scale.y(c.h)}
                y2={scale.y(c.l)}
                stroke={colour}
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              <rect
                x={scale.x(i) - bodyW / 2}
                y={top}
                width={bodyW}
                height={Math.max(1, bottom - top)}
                fill={colour}
              />
            </g>
          )
        })}

        {hover !== null && (
          <line
            x1={scale.x(hover)}
            x2={scale.x(hover)}
            y1="0"
            y2={VB_H}
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
            className="text-foreground/30"
          />
        )}

        {/* Last price marker — the one line that is always worth finding. */}
        <line
          x1="0"
          x2={VB_W}
          y1={scale.y(candles[candles.length - 1].c)}
          y2={scale.y(candles[candles.length - 1].c)}
          stroke="var(--primary)"
          strokeWidth="1"
          strokeDasharray="4 4"
          vectorEffect="non-scaling-stroke"
          opacity="0.75"
        />
      </svg>

      <PriceAxis scale={scale} />

      {/* The last-price tag rides the axis, in brand gold rather than the
          direction colours — it marks WHERE, not which way. */}
      <span
        className="pointer-events-none absolute right-0 -translate-y-1/2 rounded bg-primary px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-primary-foreground"
        style={{
          top: `${(scale.y(candles[candles.length - 1].c) / VB_H) * 100}%`,
        }}
      >
        {formatPrice(candles[candles.length - 1].c)}
      </span>
    </div>
  )
}

/** OHLC readout for the Pro chart header. */
export function OhlcReadout({ candle }: { candle: Candle }) {
  const rising = candle.c >= candle.o
  const cell = (label: string, value: number) => (
    <span className="flex items-baseline gap-1">
      <span className="text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      <span className={cn("text-[12px] font-medium tabular-nums", rising ? "text-credit" : "text-debit")}>
        {formatPrice(value)}
      </span>
    </span>
  )
  return (
    <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      {cell("O", candle.o)}
      {cell("H", candle.h)}
      {cell("L", candle.l)}
      {cell("C", candle.c)}
    </span>
  )
}

"use client"

/**
 * The preview's trading chart (components/trade-unauth/candle-chart.tsx), on
 * real candles from useChartFeed: candles (or a line), volume, two moving
 * averages, a crosshair with an OHLC readout, and the last price pinned to the
 * axis. The drawing is the preview's; what changed is the data (real bars and
 * their real timestamps), theme colours instead of hard-coded white, and two
 * real states the preview didn't need: loading, and no price history.
 *
 * A CoinGecko price series is drawn as a line with no volume, whatever the
 * candles/line switch says: it is sampled prices, not trades, and drawing it
 * as candles would invent highs and lows.
 */

import * as React from "react"

import { cn } from "@/lib/utils"
import type { Candle as FeedCandle } from "@/components/trade/candle-chart"
import type { FeedState } from "@/components/trade/redesign/chart-feed"

const AXIS_W = 72
const TIME_H = 24
const VOL_FRAC = 0.18

export type ChartKind = "candles" | "line"

type Candle = { o: number; h: number; l: number; c: number; v: number; t: number }

/** The preview's price format, extended for the registry's long tail. */
export function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return "—"
  const abs = Math.abs(value)
  if (abs > 0 && abs < 0.000001) return value.toPrecision(4)
  const frac = abs >= 1 ? 2 : abs >= 0.01 ? 4 : abs >= 0.0001 ? 6 : 8
  return value.toLocaleString("en-US", { minimumFractionDigits: frac, maximumFractionDigits: frac })
}

function sma(values: number[], n: number) {
  return values.map((_, i) => (i < n - 1 ? null : values.slice(i - n + 1, i + 1).reduce((s, v) => s + v, 0) / n))
}

export function CandleChart({
  feed,
  state,
  kind,
  showMA,
  minutesPerCandle,
  height,
  asLine = false,
  className,
}: {
  feed: FeedCandle[]
  state: FeedState
  kind: ChartKind
  showMA: boolean
  /** Candle duration — drives the time axis format. */
  minutesPerCandle: number
  height: number
  /** A sampled price series: always a line, no volume. */
  asLine?: boolean
  className?: string
}) {
  const wrap = React.useRef<HTMLDivElement>(null)
  const [width, setWidth] = React.useState(0)
  const [hover, setHover] = React.useState<number | null>(null)

  React.useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)))
    ro.observe(el)
    setWidth(Math.round(el.getBoundingClientRect().width))
    return () => ro.disconnect()
  }, [])

  const candles: Candle[] = React.useMemo(
    () => feed.map((c) => ({ o: c.open, h: c.high, l: c.low, c: c.close, v: asLine ? 0 : c.volume, t: c.time })),
    [feed, asLine],
  )
  const drawAs: ChartKind = asLine ? "line" : kind

  const plotW = Math.max(0, width - AXIS_W)
  const plotH = height - TIME_H
  const priceH = plotH * (1 - VOL_FRAC) - 8
  const n = candles.length

  const lo = n ? Math.min(...candles.map((c) => c.l)) : 0
  const hi = n ? Math.max(...candles.map((c) => c.h)) : 0
  const pad = (hi - lo) * 0.08 || hi * 0.01
  const pLo = lo - pad
  const pHi = hi + pad
  const y = (v: number) => 8 + (1 - (v - pLo) / (pHi - pLo || 1)) * priceH
  const step = n > 0 ? plotW / n : 0
  const x = (i: number) => i * step + step / 2
  const body = Math.max(1, Math.min(14, step * 0.62))
  const vMax = Math.max(...candles.map((c) => c.v), 1)
  const volTop = plotH * (1 - VOL_FRAC)

  const closes = candles.map((c) => c.c)
  const ma7 = sma(closes, 7)
  const ma25 = sma(closes, 25)
  const path = (vals: (number | null)[]) =>
    vals.reduce<string>((d, v, i) => (v === null ? d : `${d}${d ? " L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`), "")

  const last = candles[n - 1]
  const up = last ? last.c >= (candles[0]?.o ?? last.o) : true
  const lastUp = last ? last.c >= last.o : true
  const ticks = 5
  const grid = Array.from({ length: ticks }, (_, k) => pHi - ((pHi - pLo) * (k + 0.5)) / ticks)

  // Time labels from each bar's own timestamp.
  const timeLabel = (i: number) => {
    const c = candles[i]
    if (!c) return ""
    const t = new Date(c.t * 1000)
    if (minutesPerCandle >= 1440) return t.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    if (minutesPerCandle >= 240) return `${t.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${t.getHours().toString().padStart(2, "0")}h`
    return t.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
  }
  const labelCount = plotW < 420 ? 4 : 6
  // Distinct bars only: a short series would otherwise label one bar twice.
  const timeIdx = n > 1 ? [...new Set(Array.from({ length: Math.min(labelCount, n) }, (_, k) => Math.round((k / (Math.min(labelCount, n) - 1)) * (n - 1))))] : []

  const onMove = (e: React.PointerEvent) => {
    const box = wrap.current?.getBoundingClientRect()
    if (!box || step === 0) return
    const i = Math.floor((e.clientX - box.left) / step)
    setHover(i >= 0 && i < n ? i : null)
  }

  const shown = hover !== null ? candles[hover] : last
  const shownUp = shown ? shown.c >= shown.o : true
  const linePath = path(closes)
  const lineColor = (asLine ? up : lastUp) ? "var(--credit)" : "var(--debit)"

  return (
    <div className={cn("relative select-none", className)}>
      {/* OHLC readout — follows the crosshair, rests on the latest bar. A
          sampled line has only a price, so it reads just that. */}
      {shown && (
        <div className="pointer-events-none absolute left-1 top-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] tabular-nums">
          {asLine ? (
            <span className="text-muted-foreground">
              Price <span className="text-foreground">{formatPrice(shown.c)}</span>
            </span>
          ) : (
            <>
              {(["o", "h", "l", "c"] as const).map((k) => (
                <span key={k} className="text-muted-foreground">
                  {k.toUpperCase()} <span className={shownUp ? "text-credit" : "text-debit"}>{formatPrice(shown[k])}</span>
                </span>
              ))}
              <span className={cn("font-semibold", shownUp ? "text-credit" : "text-debit")}>
                {shownUp ? "+" : "−"}
                {Math.abs(((shown.c - shown.o) / (shown.o || 1)) * 100).toFixed(2)}%
              </span>
            </>
          )}
          {showMA && (
            <>
              <span className="text-[#f5b700]">MA7</span>
              <span className="text-[#a78bfa]">MA25</span>
            </>
          )}
        </div>
      )}

      <div ref={wrap} className="relative w-full touch-pan-y" style={{ height }} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {n === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            {state === "empty" ? (
              <p className="max-w-xs px-6 text-center text-[12.5px] leading-relaxed text-muted-foreground">
                No price history for this token yet — it isn&apos;t in an indexed pool. You can still trade it.
              </p>
            ) : (
              <div className="size-5 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground/70" aria-label="Loading chart" />
            )}
          </div>
        )}
        {width > 0 && n > 0 && (
          <svg width={width} height={height} className="absolute inset-0" aria-hidden>
            <defs>
              <linearGradient id="tc-line" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity="0.22" />
                <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
              </linearGradient>
            </defs>

            {grid.map((v, k) => (
              <g key={k}>
                <line x1={0} x2={plotW} y1={y(v)} y2={y(v)} stroke="color-mix(in oklab, var(--foreground) 5%, transparent)" />
                {!(last && Math.abs(y(v) - y(last.c)) < 16) && (
                  <text x={width - 6} y={y(v)} dy="0.32em" textAnchor="end" className="fill-muted-foreground/75 text-[11px] tabular-nums">
                    {formatPrice(v)}
                  </text>
                )}
              </g>
            ))}
            {timeIdx.map((i) => (
              <line key={`g${i}`} x1={x(i)} x2={x(i)} y1={0} y2={plotH} stroke="color-mix(in oklab, var(--foreground) 3%, transparent)" />
            ))}

            {/* Volume */}
            {!asLine &&
              candles.map((c, i) => {
                const h = (c.v / vMax) * (plotH - volTop - 2)
                return (
                  <rect
                    key={`v${i}`}
                    x={x(i) - body / 2}
                    y={plotH - h}
                    width={body}
                    height={h}
                    fill={c.c >= c.o ? "var(--credit)" : "var(--debit)"}
                    opacity={hover === i ? 0.5 : 0.22}
                  />
                )
              })}

            {drawAs === "candles" ? (
              candles.map((c, i) => {
                const green = c.c >= c.o
                const top = y(Math.max(c.o, c.c))
                const bh = Math.max(1, Math.abs(y(c.o) - y(c.c)))
                return (
                  <g key={i} opacity={hover === null || hover === i ? 1 : 0.55}>
                    <line x1={x(i)} x2={x(i)} y1={y(c.h)} y2={y(c.l)} stroke={green ? "var(--credit)" : "var(--debit)"} strokeWidth={1} />
                    <rect x={x(i) - body / 2} y={top} width={body} height={bh} rx={Math.min(1.5, body / 4)} fill={green ? "var(--credit)" : "var(--debit)"} />
                  </g>
                )
              })
            ) : (
              <>
                <path d={`${linePath} L${x(n - 1)},${volTop} L${x(0)},${volTop} Z`} fill="url(#tc-line)" />
                <path d={linePath} fill="none" stroke={lineColor} strokeWidth={2} strokeLinejoin="round" />
              </>
            )}

            {showMA && (
              <>
                <path d={path(ma7)} fill="none" stroke="#f5b700" strokeWidth={1.3} opacity={0.9} />
                <path d={path(ma25)} fill="none" stroke="#a78bfa" strokeWidth={1.3} opacity={0.9} />
              </>
            )}

            {/* Last price — a dashed rule and a tag on the axis. */}
            {last && (
              <g>
                <line x1={0} x2={plotW} y1={y(last.c)} y2={y(last.c)} stroke={lastUp ? "var(--credit)" : "var(--debit)"} strokeDasharray="3 3" opacity={0.7} />
                <rect x={plotW + 2} y={y(last.c) - 10} width={AXIS_W - 4} height={20} rx={5} fill={lastUp ? "var(--credit)" : "var(--debit)"} />
                <text x={plotW + AXIS_W / 2} y={y(last.c)} dy="0.34em" textAnchor="middle" className="fill-black text-[11px] font-bold tabular-nums">
                  {formatPrice(last.c)}
                </text>
              </g>
            )}

            {/* Crosshair */}
            {hover !== null && candles[hover] && (
              <g>
                <line x1={x(hover)} x2={x(hover)} y1={0} y2={plotH} stroke="color-mix(in oklab, var(--foreground) 25%, transparent)" strokeDasharray="3 3" />
                <line x1={0} x2={plotW} y1={y(candles[hover].c)} y2={y(candles[hover].c)} stroke="color-mix(in oklab, var(--foreground) 18%, transparent)" strokeDasharray="3 3" />
                <g>
                  <rect x={Math.min(plotW - 92, Math.max(0, x(hover) - 46))} y={plotH + 2} width={92} height={19} rx={5} fill="var(--popover)" />
                  <text x={Math.min(plotW - 46, Math.max(46, x(hover)))} y={plotH + 11.5} dy="0.34em" textAnchor="middle" className="fill-foreground text-[10.5px] tabular-nums">
                    {timeLabel(hover)}
                  </text>
                </g>
              </g>
            )}

            {timeIdx.map((i, k) => (
              <text
                key={`t${i}`}
                x={k === 0 ? 2 : k === timeIdx.length - 1 ? plotW - 2 : x(i)}
                y={plotH + 15}
                textAnchor={k === 0 ? "start" : k === timeIdx.length - 1 ? "end" : "middle"}
                className={cn("fill-muted-foreground/70 text-[10.5px] tabular-nums", hover !== null && "opacity-0")}
              >
                {timeLabel(i)}
              </text>
            ))}
          </svg>
        )}
      </div>
    </div>
  )
}

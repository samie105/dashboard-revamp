"use client"

/**
 * Price chart for a launch: candles (or a line) with volume underneath,
 * drawn at the container's real width so strokes stay crisp. Hover (or
 * touch) shows the bucket's open/high/low/close and volume. Prices are SOL
 * per token and usually tiny, so labels use tinyPrice (0.0₇284).
 */

import * as React from "react"

import type { Candle } from "@/lib/launchpad-market/types"
import { tinyPrice } from "@/lib/launchpad-market/view"
import { cn } from "@/lib/utils"

const AXIS_W = 78
const AXIS_H = 22
const PAD_T = 10
const VOLUME_SHARE = 0.18

export type ChartMode = "candles" | "line"

function timeLabel(t: number, spanMs: number): string {
  const d = new Date(t)
  if (spanMs <= 36 * 3_600_000) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function CandleChart({ candles, mode, height = 340, className }: { candles: Candle[]; mode: ChartMode; height?: number; className?: string }) {
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

  const plotW = Math.max(0, width - AXIS_W)
  const plotH = height - AXIS_H
  const priceH = plotH * (1 - VOLUME_SHARE) - PAD_T
  const n = candles.length
  const lo = n ? Math.min(...candles.map((c) => c.l)) : 0
  const hi = n ? Math.max(...candles.map((c) => c.h)) : 1
  const pad = (hi - lo) * 0.08 || hi * 0.05 || 1
  const yLo = lo - pad
  const yHi = hi + pad
  const y = (v: number) => PAD_T + (1 - (v - yLo) / (yHi - yLo)) * priceH
  const slot = n ? plotW / n : 0
  const x = (i: number) => slot * i + slot / 2
  const body = Math.max(1, Math.min(14, slot * 0.66))
  const vMax = n ? Math.max(...candles.map((c) => c.v), 1e-12) : 1
  const volTop = plotH * (1 - VOLUME_SHARE)

  const ticks = [0, 1, 2, 3].map((k) => yHi - ((yHi - yLo) * (k + 0.5)) / 4)
  const span = n ? candles[n - 1]!.t - candles[0]!.t : 0
  const timeTicks = n ? [0, 0.25, 0.5, 0.75, 1].map((f) => Math.min(n - 1, Math.round(f * (n - 1)))) : []
  const last = n ? candles[n - 1]! : null
  const up = last ? last.c >= candles[0]!.o : true
  const line = candles.map((c, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(c.c).toFixed(1)}`).join(" ")
  const h = hover === null ? null : candles[hover] ?? null

  const onMove = (e: React.PointerEvent) => {
    const box = wrap.current?.getBoundingClientRect()
    if (!box || !n) return
    const i = Math.floor((e.clientX - box.left) / slot)
    setHover(i >= 0 && i < n ? i : null)
  }

  return (
    <div ref={wrap} className={cn("relative w-full select-none touch-pan-y", className)} style={{ height }} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
      {width > 0 && n > 0 && (
        <svg width={width} height={height} className="absolute inset-0" aria-hidden>
          <defs>
            <linearGradient id="lp-line-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={up ? "var(--credit)" : "var(--debit)"} stopOpacity="0.22" />
              <stop offset="100%" stopColor={up ? "var(--credit)" : "var(--debit)"} stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((v, k) => (
            <g key={k}>
              <line x1={0} x2={plotW} y1={y(v)} y2={y(v)} stroke="currentColor" className="text-foreground/[0.06]" strokeDasharray="2 5" />
              <text x={width} y={y(v)} dy="0.32em" textAnchor="end" className="fill-muted-foreground/80 text-[10.5px] font-medium tabular-nums">{tinyPrice(v)}</text>
            </g>
          ))}
          <line x1={0} x2={plotW} y1={volTop} y2={volTop} stroke="currentColor" className="text-foreground/[0.06]" />

          {/* Volume */}
          {candles.map((c, i) => {
            const vh = (c.v / vMax) * (plotH - volTop - 2)
            return <rect key={`v${c.t}`} x={x(i) - body / 2} y={plotH - vh} width={body} height={Math.max(0, vh)} className={c.c >= c.o ? "fill-credit/30" : "fill-debit/30"} />
          })}

          {mode === "candles" ? (
            candles.map((c, i) => {
              const rising = c.c >= c.o
              const top = y(Math.max(c.o, c.c))
              const bottom = y(Math.min(c.o, c.c))
              return (
                <g key={c.t} className={rising ? "text-credit" : "text-debit"}>
                  <line x1={x(i)} x2={x(i)} y1={y(c.h)} y2={y(c.l)} stroke="currentColor" strokeWidth={1} />
                  <rect x={x(i) - body / 2} y={top} width={body} height={Math.max(1, bottom - top)} fill="currentColor" rx={body > 4 ? 1 : 0} />
                </g>
              )
            })
          ) : (
            <>
              <path d={`${line} L${x(n - 1).toFixed(1)},${volTop} L${x(0).toFixed(1)},${volTop} Z`} fill="url(#lp-line-fill)" />
              <path d={line} fill="none" stroke={up ? "var(--credit)" : "var(--debit)"} strokeWidth={1.8} strokeLinejoin="round" />
            </>
          )}

          {/* Last price marker */}
          {last && (
            <g>
              <line x1={0} x2={plotW} y1={y(last.c)} y2={y(last.c)} stroke={up ? "var(--credit)" : "var(--debit)"} strokeOpacity={0.5} strokeDasharray="3 3" />
              <rect x={plotW + 2} y={y(last.c) - 9} width={AXIS_W - 4} height={18} rx={4} fill={up ? "var(--credit)" : "var(--debit)"} />
              <text x={plotW + AXIS_W / 2} y={y(last.c)} dy="0.34em" textAnchor="middle" className="fill-background text-[10.5px] font-semibold tabular-nums">{tinyPrice(last.c)}</text>
            </g>
          )}

          {h && hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD_T} y2={plotH} className="stroke-foreground/30" strokeDasharray="3 3" />}
        </svg>
      )}

      {/* Readout: hovered bucket, else the latest */}
      {(h ?? last) && (
        <div className="pointer-events-none absolute left-1 top-0 flex flex-wrap gap-x-3 gap-y-0.5 rounded-lg bg-background/70 px-2 py-1 text-[11px] tabular-nums text-muted-foreground backdrop-blur">
          {(() => {
            const c = (h ?? last)!
            const tone = c.c >= c.o ? "text-credit" : "text-debit"
            return (
              <>
                <span>{new Date(c.t).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                <span>O <span className={tone}>{tinyPrice(c.o)}</span></span>
                <span>H <span className={tone}>{tinyPrice(c.h)}</span></span>
                <span>L <span className={tone}>{tinyPrice(c.l)}</span></span>
                <span>C <span className={tone}>{tinyPrice(c.c)}</span></span>
                <span>Vol <span className="text-foreground">{c.v.toFixed(2)} SOL</span></span>
              </>
            )
          })()}
        </div>
      )}

      <div className="absolute bottom-0 left-0 flex justify-between text-[10.5px] font-medium tabular-nums text-muted-foreground/80" style={{ width: plotW || "calc(100% - 78px)" }}>
        {timeTicks.map((i, k) => (
          <span key={k}>{timeLabel(candles[i]!.t, span)}</span>
        ))}
      </div>
    </div>
  )
}

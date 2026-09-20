"use client"

/**
 * The curve: price against SOL raised, with the token's position marked.
 *
 * This is the curve's own shape, served by the backend from the on-chain
 * config — not price history. A bonding curve's price is a FUNCTION of how
 * much SOL has come in, so this line is the same before anyone trades and
 * after, and the marker is the only thing that moves. Trade history (candles)
 * needs an indexer we don't have, and a chart that implied one would be
 * inventing it.
 */

import * as React from "react"
import { CardShell } from "@/components/ui/system"
import { CARD_HUE } from "@/components/ui/surface"
import { cn } from "@/lib/utils"

export type CurvePoint = { solRaised: string; price: number }

/** Curve prices are around 1e-8 SOL, where toFixed(4) would print 0.0000. */
export function formatTinyPrice(price: number) {
  if (!Number.isFinite(price) || price <= 0) return "—"
  if (price >= 0.01) return price.toFixed(4)
  // Enough decimals to carry three significant digits, trailing zeros cut.
  const decimals = Math.min(18, Math.ceil(-Math.log10(price)) + 3)
  return price.toFixed(decimals).replace(/0+$/, "")
}

const W = 720
const H = 240
const PAD = { top: 16, right: 16, bottom: 28, left: 16 }

export function CurveChart({
  points,
  current,
  graduationLamports,
  symbol,
  loading,
  error,
}: {
  points: CurvePoint[]
  current: CurvePoint | null
  graduationLamports: string
  symbol: string
  loading?: boolean
  error?: string | null
}) {
  const geometry = React.useMemo(() => {
    if (points.length < 2) return null
    const maxX = Number(graduationLamports) / 1e9
    const maxY = Math.max(...points.map((p) => p.price))
    const x = (lamports: string) =>
      PAD.left + (Number(lamports) / 1e9 / maxX) * (W - PAD.left - PAD.right)
    const y = (price: number) =>
      H - PAD.bottom - (price / maxY) * (H - PAD.top - PAD.bottom)
    const line = points
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"}${x(p.solRaised).toFixed(2)},${y(p.price).toFixed(2)}`
      )
      .join(" ")
    const area = `${line} L${x(points.at(-1)!.solRaised).toFixed(2)},${H - PAD.bottom} L${x(points[0]!.solRaised).toFixed(2)},${H - PAD.bottom} Z`
    return { line, area, x, y, maxX, maxY }
  }, [points, graduationLamports])

  const marker =
    geometry && current
      ? { cx: geometry.x(current.solRaised), cy: geometry.y(current.price) }
      : null

  return (
    <CardShell className={cn(CARD_HUE, "flex h-auto flex-col gap-4 p-5")}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-[13px] font-semibold">The curve</span>
          <span className="text-[11.5px] text-muted-foreground">
            Price rises as SOL comes in, and is set by the curve — not by an
            order book
          </span>
        </div>
        {current && (
          <span className="text-right">
            <span className="block text-[11.5px] text-muted-foreground">
              Price now
            </span>
            <span className="block text-[15px] font-semibold tabular-nums">
              {formatTinyPrice(current.price)}{" "}
              <span className="text-[12px] font-medium text-muted-foreground">
                SOL / {symbol}
              </span>
            </span>
          </span>
        )}
      </div>

      {error ? (
        <p className="py-8 text-center text-[12.5px] text-muted-foreground">
          {error}
        </p>
      ) : loading || !geometry ? (
        <div className="h-60 shrink-0 animate-pulse rounded-2xl bg-foreground/[0.04]" />
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-60 w-full shrink-0"
          role="img"
          aria-label={`Price of ${symbol} against SOL raised on the curve`}
        >
          <defs>
            <linearGradient id="curve-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((t) => (
            <line
              key={t}
              x1={PAD.left}
              x2={W - PAD.right}
              y1={H - PAD.bottom - t * (H - PAD.top - PAD.bottom)}
              y2={H - PAD.bottom - t * (H - PAD.top - PAD.bottom)}
              stroke="currentColor"
              strokeOpacity="0.08"
              strokeWidth="1"
            />
          ))}
          <path d={geometry.area} fill="url(#curve-fill)" />
          <path
            d={geometry.line}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {marker && (
            <>
              <line
                x1={marker.cx}
                x2={marker.cx}
                y1={marker.cy}
                y2={H - PAD.bottom}
                stroke="var(--primary)"
                strokeOpacity="0.45"
                strokeDasharray="3 3"
              />
              <circle
                cx={marker.cx}
                cy={marker.cy}
                r="6"
                fill="var(--primary)"
              />
              <circle
                cx={marker.cx}
                cy={marker.cy}
                r="11"
                fill="var(--primary)"
                fillOpacity="0.2"
              />
            </>
          )}
          <text
            x={PAD.left}
            y={H - 8}
            fill="currentColor"
            fillOpacity="0.55"
            fontSize="11"
          >
            0 SOL
          </text>
          <text
            x={W - PAD.right}
            y={H - 8}
            textAnchor="end"
            fill="currentColor"
            fillOpacity="0.55"
            fontSize="11"
          >
            {Math.round(geometry.maxX)} SOL · graduates
          </text>
        </svg>
      )}

      <p className="text-[11.5px] leading-relaxed text-muted-foreground">
        The dot is where this token sits today. There is no trade history here
        yet: that needs an index of every curve trade, which isn&apos;t built.
      </p>
    </CardShell>
  )
}

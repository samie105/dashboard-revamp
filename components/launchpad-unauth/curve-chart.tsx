/**
 * The bonding curve, with where this launch sits on it.
 *
 * This charts the CURVE — price against tokens sold — not a price history.
 * That is a deliberate substitution. A history chart needs an index of every
 * curve trade, which does not exist and is listed in the manifest as a figure
 * to keep off this screen. The curve is config: it is fully known before a
 * single trade, so drawing it invents nothing. And it answers the question a
 * buyer on a curve actually has — not "where has the price been" but "where
 * is it going if people keep buying".
 *
 * The SVG stretches to its box (`preserveAspectRatio="none"`), so the marker
 * is an HTML dot positioned in percentages rather than an SVG circle: a
 * circle inside a non-uniformly scaled SVG renders as an ellipse.
 */

import * as React from "react"
import {
  CURVE_SUPPLY,
  GRADUATION_SOL,
  SOL_USD,
  curvePoints,
  fmtPct,
  fmtTinyUsd,
  fmtTokens,
  priceAt,
  tokensSoldAt,
  type LaunchView,
} from "@/components/launchpad-unauth/launch-data"

const W = 600
const H = 220

export function CurveChart({ launch }: { launch: LaunchView }) {
  const points = curvePoints(80)
  const maxPrice = priceAt(GRADUATION_SOL)
  const x = (sold: number) => (sold / CURVE_SUPPLY) * W
  const y = (price: number) => H - (price / maxPrice) * (H - 8)

  const line = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${x(p.sold).toFixed(2)},${y(p.price).toFixed(2)}`
    )
    .join(" ")

  // The filled region is everything already bought: the curve up to here.
  const here = Math.min(launch.solRaised, GRADUATION_SOL)
  const filledPts = points.filter((p) => p.sol <= here)
  filledPts.push({ sol: here, sold: tokensSoldAt(here), price: priceAt(here) })
  const filled =
    `M0,${H} ` +
    filledPts
      .map((p) => `L${x(p.sold).toFixed(2)},${y(p.price).toFixed(2)}`)
      .join(" ") +
    ` L${x(tokensSoldAt(here)).toFixed(2)},${H} Z`

  const markerX = (tokensSoldAt(here) / CURVE_SUPPLY) * 100
  const markerY = (y(priceAt(here)) / H) * 100
  const gradX = (tokensSoldAt(GRADUATION_SOL) / CURVE_SUPPLY) * 100
  const closed = launch.status !== "live"

  return (
    <figure className="flex flex-col gap-3">
      {/* The plot is inset 6px each side — half the marker's width. A
          graduated launch's marker sits at 99% of the curve, and centring it
          there hung half of it outside the chart: invisible on desktop, a
          clipped dot and a sideways scroll on a phone. The percentages below
          are all relative to this inner box, so nothing shifts. */}
      <div className="relative h-[220px] w-full">
        <div className="absolute inset-y-0 right-1.5 left-1.5">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full overflow-visible"
            role="img"
            aria-label={`Bonding curve. ${fmtPct(launch.progressBps)} of the way to graduation.`}
          >
            <defs>
              <linearGradient
                id={`fill-${launch.id}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="var(--primary)"
                  stopOpacity="0.32"
                />
                <stop
                  offset="100%"
                  stopColor="var(--primary)"
                  stopOpacity="0.02"
                />
              </linearGradient>
            </defs>
            {/* Quarter gridlines — structure without a scale to misread. */}
            {[0.25, 0.5, 0.75].map((f) => (
              <line
                key={f}
                x1="0"
                x2={W}
                y1={H * f}
                y2={H * f}
                stroke="var(--border)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <path d={filled} fill={`url(#fill-${launch.id})`} />
            <path
              d={line}
              fill="none"
              stroke="var(--muted-foreground)"
              strokeOpacity="0.45"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
            {/* The part already travelled, solid. */}
            <path
              d={
                `M0,${y(priceAt(0))} ` +
                filledPts
                  .map(
                    (p) => `L${x(p.sold).toFixed(2)},${y(p.price).toFixed(2)}`
                  )
                  .join(" ")
              }
              fill="none"
              stroke="var(--primary)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* Graduation line — where the curve closes. */}
          <div
            aria-hidden
            className="absolute inset-y-0 border-l border-dashed border-foreground/25"
            style={{ left: `${gradX}%` }}
          >
            <span className="absolute -top-0.5 right-1.5 text-[10.5px] font-semibold tracking-[0.06em] whitespace-nowrap text-muted-foreground uppercase">
              Graduates
            </span>
          </div>

          {/* You are here. */}
          <div
            aria-hidden
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${markerX}%`, top: `${markerY}%` }}
          >
            <span className="relative flex h-3 w-3">
              {!closed && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-50 motion-reduce:hidden" />
              )}
              <span className="relative inline-flex h-3 w-3 rounded-full bg-primary ring-2 ring-card" />
            </span>
          </div>
        </div>
      </div>

      <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground tabular-nums">
        <span>
          Starts at{" "}
          <span className="font-semibold text-foreground">
            {fmtTinyUsd(priceAt(0) * SOL_USD)}
          </span>
        </span>
        <span>
          {closed ? "Closed at" : "Now"}{" "}
          <span className="font-semibold text-foreground">
            {fmtTinyUsd(launch.priceUsd)}
          </span>{" "}
          · {fmtTokens(launch.tokensSold)} of {fmtTokens(CURVE_SUPPLY)} sold
        </span>
        <span>
          Graduates at{" "}
          <span className="font-semibold text-foreground">
            {fmtTinyUsd(maxPrice * SOL_USD)}
          </span>
        </span>
      </figcaption>
    </figure>
  )
}

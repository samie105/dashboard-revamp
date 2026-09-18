"use client"

/**
 * The quote countdown ring, shared.
 *
 * Moved here from components/swap/quote-detail.tsx when the launchpad's curve
 * ticket needed the same thing. Two tickets drawing the same clock from two
 * copies is how they end up disagreeing about what "about to expire" looks
 * like. `total` is a prop now rather than the swap's TTL constant, because a
 * curve quote and a swap quote do not have to live for the same time.
 */

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * The countdown, as a ring.
 *
 * It was a line of text — "New price in 24s" — sharing a row with a refresh
 * button, which is the least legible way to show a number that is running
 * out. A ring drains, so the state is readable without reading: full means
 * fresh, nearly empty means about to move.
 *
 * `seconds` null is a real and distinct state ("no live price yet"), NOT zero:
 * an empty ring would say the quote had just expired, which is the opposite
 * of never having had one.
 */
export function QuoteClock({
  seconds,
  total,
  refreshing = false,
}: {
  /** Seconds left, or null when no quote is live. */
  seconds: number | null
  /** The quote's full lifetime — the ring is full at this many seconds. */
  total: number
  refreshing?: boolean
}) {
  const size = 34
  const stroke = 2.5
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const ratio = seconds === null ? 0 : Math.min(1, Math.max(0, seconds / total))
  // Under five seconds the quote is about to be replaced under the reader's
  // hands, which is worth a colour. Warning, never gold: gold is brand.
  const urgent = seconds !== null && seconds <= 5

  return (
    <span className="relative inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        {seconds !== null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={urgent ? "var(--warning)" : "var(--primary)"}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - ratio)}
            className="transition-[stroke-dashoffset] duration-1000 ease-linear motion-reduce:transition-none"
          />
        )}
      </svg>
      <span
        className={cn(
          "absolute text-[11px] font-bold tabular-nums",
          refreshing && "animate-pulse",
          urgent
            ? "text-warning"
            : seconds === null
              ? "text-muted-foreground/50"
              : "text-foreground"
        )}
      >
        {seconds === null ? "–" : Math.max(0, seconds)}
      </span>
    </span>
  )
}

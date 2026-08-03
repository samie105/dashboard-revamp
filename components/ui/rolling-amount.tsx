"use client"

/**
 * RollingAmount — the balance odometer, ported from the mobile app's
 * `features/wallet/rolling-amount.tsx`.
 *
 * When the value changes (chain tap, view switch, live refresh) each character
 * rolls to its replacement vertically, and ADJACENT DIGITS ROLL IN OPPOSITE
 * DIRECTIONS, so the number reads as a bank of counters spinning against each
 * other rather than one block sliding. Each slot carves out its own staggered
 * window, so the cascade sweeps left to right.
 *
 * Travel is in `em`, so this works at any font-size — including the hero's
 * clamp() — without being told a pixel height.
 */

import * as React from "react"
import { cn } from "@/lib/utils"

const ROLL_MS = 340    // one slot's roll
const STAGGER_MS = 22  // per-slot offset of the sweep

export function RollingAmount({
  value,
  className,
}: {
  /** Pre-formatted display string, e.g. "$1,234.56". */
  value: string
  className?: string
}) {
  // What we last received, and what we were showing before it. Refs swapped
  // during render so the DISPLAYED text is always the incoming prop — a
  // state-based version lags a commit and freezes stale numbers.
  const shown = React.useRef(value)
  const outgoing = React.useRef(value)
  // Bumped on every change so React remounts the slots and CSS animations
  // actually re-fire (same-name animations don't restart on their own).
  const [gen, setGen] = React.useState(0)
  const kick = React.useRef(false)

  if (value !== shown.current) {
    outgoing.current = shown.current
    shown.current = value
    kick.current = true
  }

  React.useLayoutEffect(() => {
    if (!kick.current) return
    kick.current = false
    setGen((g) => g + 1)
  })

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

  const chars = value.split("")
  const prevChars = outgoing.current.split("")
  // Direction alternates per DIGIT position (not raw index), so separators
  // don't break the up/down/up rhythm the eye latches onto.
  let digitAt = 0

  return (
    <span className={cn("inline-flex items-end tabular-nums", className)} aria-label={value}>
      {chars.map((ch, i) => {
        const isDigit = ch >= "0" && ch <= "9"
        const dir = isDigit ? (digitAt++ % 2 === 0 ? -1 : 1) : -1
        const prev = prevChars[i] ?? ""
        const changed = ch !== prev && !reduced

        return (
          <span
            key={`${gen}-${i}`}
            className="relative inline-block overflow-hidden"
            style={{ ["--rd" as string]: String(dir) }}
          >
            {/* invisible sizer keeps the slot exactly the width of the current char */}
            <span className="invisible" aria-hidden>{ch === " " ? " " : ch}</span>

            <span
              aria-hidden
              className={cn("absolute left-0 top-0 whitespace-pre", changed && "roll-in")}
              style={changed ? { animationDelay: `${i * STAGGER_MS}ms` } : undefined}
            >
              {ch}
            </span>

            {changed && (
              <span
                aria-hidden
                className="roll-out absolute left-0 top-0 whitespace-pre"
                style={{ animationDelay: `${i * STAGGER_MS}ms` }}
              >
                {prev}
              </span>
            )}
          </span>
        )
      })}
    </span>
  )
}

export const ROLL_TIMING = { ROLL_MS, STAGGER_MS }

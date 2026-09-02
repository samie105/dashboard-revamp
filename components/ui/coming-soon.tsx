"use client"

/**
 * The one "not yet available" treatment.
 *
 * Futures is the first thing to use it: the venue is not open, but the tabs,
 * tables and rails that lead to it are already built and already discovered by
 * people using the product. Deleting them would be a lie of omission — the
 * feature is coming — and leaving them live is worse, because a control that
 * accepts a click and does nothing reads as a broken platform rather than an
 * unfinished one.
 *
 * So the surface stays visible and stops being operable: its own content is
 * blurred (a CSS `filter` on the content, NOT `backdrop-filter` — the design
 * system bans the latter, and it breaks under transformed ancestors anyway),
 * pointer events and tab focus are removed from everything underneath, and a
 * plain statement sits on top saying what is happening and that nothing is
 * required of the reader.
 *
 * Tone rule: state the fact, give a timeframe only if it is real, never
 * apologise twice, and never say "oops" or "stay tuned" to people who are
 * holding money on the platform.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Clock01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"

/** House copy, so every futures surface says the same thing. */
export const FUTURES_SOON_TITLE = "Futures is not open yet"
export const FUTURES_SOON_BODY =
  "Perpetual futures are still being finished. Everything else on your account works as normal, and we'll let you know here the moment futures opens."
/** The same fact in one line, for a toast — where the full body would be four
 *  lines of text over the thing the reader is trying to look at. */
export const FUTURES_SOON_SHORT =
  "Still being finished. We'll let you know the moment it opens."

/**
 * Wraps a surface that exists but cannot be used yet.
 *
 * `inert` on the wrapped content is what actually makes it unusable — opacity
 * and blur are appearance, and a sighted-but-keyboard user would otherwise tab
 * straight into a dead form. React 19 passes `inert` through as a real
 * attribute, so children are removed from the tab order and the a11y tree.
 */
export function ComingSoon({
  title = FUTURES_SOON_TITLE,
  body = FUTURES_SOON_BODY,
  children,
  className,
  /** Shorter presentation for a panel inside a card rather than a whole page. */
  compact = false,
}: {
  title?: string
  body?: string
  children?: React.ReactNode
  className?: string
  compact?: boolean
}) {
  return (
    <div className={cn("relative isolate", className)}>
      {children ? (
        <div
          aria-hidden
          // @ts-expect-error — `inert` is a valid DOM attribute; React's types
          // lag it on some versions. It is the load-bearing half of this.
          inert=""
          className="pointer-events-none select-none blur-[6px] saturate-50 [filter:blur(6px)_saturate(0.5)] motion-reduce:blur-none"
        >
          {children}
        </div>
      ) : null}

      <div
        className={cn(
          "inset-0 flex flex-col items-center justify-center gap-2 text-center",
          children ? "absolute z-10 px-6" : "px-6 py-10",
          compact ? "gap-1.5" : "gap-2",
        )}
      >
        <span
          className={cn(
            "flex items-center justify-center rounded-full bg-primary/[0.12] text-primary",
            compact ? "h-9 w-9" : "h-11 w-11",
          )}
        >
          <HugeiconsIcon icon={Clock01Icon} className={compact ? "h-4 w-4" : "h-5 w-5"} />
        </span>
        <p className={cn("font-display font-semibold", compact ? "text-[14px]" : "text-[16px]")}>
          {title}
        </p>
        <p
          className={cn(
            "max-w-xs text-muted-foreground",
            compact ? "text-[12px] leading-snug" : "text-[13px] leading-relaxed",
          )}
        >
          {body}
        </p>
      </div>
    </div>
  )
}

/**
 * The marker on a tab or nav item that leads somewhere not yet open. Small,
 * quiet, and never gold — gold means "active/primary" in this system, and this
 * is the opposite of an invitation.
 */
export function SoonBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "rounded-full bg-foreground/[0.08] px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground",
        className,
      )}
    >
      Soon
    </span>
  )
}

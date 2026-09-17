"use client"

/**
 * The shape the three trading-account money doors share.
 *
 * LANDSCAPE from `sm` up: what you fill in on the left, what it commits you to
 * on the right. Stacked on a phone, in the order you actually work — type the
 * amount, then read what it means.
 *
 * ── Why the right pane exists ─────────────────────────────────────────────
 * All three forms were a single portrait column ending in one amber line of
 * prose: "Bridge deposits are not instant — they usually take a few minutes."
 * That sentence is the most important thing on the deposit screen and it was
 * the smallest, sitting directly above the button that starts the wait.
 *
 * The flow already knows the stages it will go through — the same
 * FUNDING_STAGES the status screen ticks off afterwards. Showing them BEFORE
 * you commit is the whole change: "a few minutes" becomes three named steps,
 * so the wait is something you were told about rather than something you
 * discover. Nothing here is invented; `StageOutline` is handed the same list
 * the progress screen reads.
 */

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * The two-pane frame.
 *
 * `aside` is optional: a flow with nothing worth saying on the right (the
 * instant one) renders a single column rather than an empty half.
 */
export function FundingLayout({
  children,
  aside,
}: {
  children: React.ReactNode
  aside?: React.ReactNode
}) {
  if (!aside) return <div className="flex flex-col gap-4">{children}</div>

  return (
    <div className="flex flex-col gap-4 sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] sm:items-start sm:gap-5">
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
      <div className="flex min-w-0 flex-col gap-3">{aside}</div>
    </div>
  )
}

/** A titled block on the right pane. */
export function FundingAside({
  title,
  children,
  tone = "plain",
}: {
  title: string
  children: React.ReactNode
  /** `warning` for the one thing that costs you time or money if ignored. */
  tone?: "plain" | "warning"
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-2xl p-4",
        tone === "warning" ? "bg-warning-chip" : "bg-foreground/[0.05]",
      )}
    >
      <span
        className={cn(
          "text-[11px] font-semibold uppercase tracking-[0.07em]",
          tone === "warning" ? "text-warning" : "text-muted-foreground",
        )}
      >
        {title}
      </span>
      {children}
    </div>
  )
}

/**
 * The stages this flow will pass through, before it starts.
 *
 * Deliberately NOT a progress indicator: nothing has happened yet, so no step
 * is marked done, in progress, or failed. It is an outline of the route — the
 * status screen is what reports position along it. Numbering rather than
 * ticking is what keeps those two readings apart.
 */
export function StageOutline({ stages }: { stages: readonly { key: string; label: string }[] }) {
  return (
    <ol className="flex flex-col gap-2">
      {stages.map((stage, index) => (
        <li key={stage.key} className="flex items-start gap-2.5">
          <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-foreground/[0.09] text-[10px] font-bold tabular-nums text-muted-foreground">
            {index + 1}
          </span>
          <span className="text-[12.5px] leading-snug text-muted-foreground">{stage.label}</span>
        </li>
      ))}
    </ol>
  )
}

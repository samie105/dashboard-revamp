"use client"

/**
 * The states the previews never drew, in their visual language: skeletons,
 * an error panel, an empty state and an "unavailable" panel. Every ported
 * screen keeps its loading / empty / error / unavailable states through these.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Alert02Icon, AlertCircleIcon, InboxIcon } from "@hugeicons/core-free-icons"

import { NeutralButton } from "@/components/dash/buttons"
import { cn } from "@/lib/utils"

type IconData = React.ComponentProps<typeof HugeiconsIcon>["icon"]

/* ── Skeletons ────────────────────────────────────────────────────────── */

/** One shimmering block (the app's .skel, so reduced motion is handled). */
export function SkeletonBlock({ className }: { className?: string }) {
  return <span aria-hidden className={cn("skel block rounded-lg", className)} />
}

/** Rows in the preview's list shape: avatar, two lines, a figure on the right. */
export function SkeletonList({ rows = 4, label = "Loading", className }: { rows?: number; label?: string; className?: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={cn("flex flex-col", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-2.5" style={{ opacity: 1 - i * (0.5 / Math.max(1, rows - 1)) }}>
          <SkeletonBlock className="size-9 shrink-0 rounded-full" />
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <SkeletonBlock className="h-3 w-28 max-w-[45%]" />
            <SkeletonBlock className="h-2.5 w-20 max-w-[30%]" />
          </span>
          <span className="flex flex-col items-end gap-1.5">
            <SkeletonBlock className="h-3 w-16" />
            <SkeletonBlock className="h-2.5 w-12" />
          </span>
        </div>
      ))}
    </div>
  )
}

/** A panel-shaped placeholder: title line, a hero figure, then rows. */
export function SkeletonPanel({ rows = 3, className, label = "Loading" }: { rows?: number; className?: string; label?: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={cn("flex flex-col gap-4", className)}>
      <SkeletonBlock className="h-4 w-32" />
      <SkeletonBlock className="h-9 w-48" />
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: rows }, (_, i) => (
          <SkeletonBlock key={i} className="h-3" />
        ))}
      </div>
    </div>
  )
}

/* ── State panels ─────────────────────────────────────────────────────── */

type StateTone = "error" | "warning" | "empty" | "muted"

const STATE_CHIP: Record<StateTone, string> = {
  error: "border-debit/25 bg-debit/[0.1] text-debit",
  warning: "border-warning/25 bg-warning/[0.1] text-warning",
  empty: "border-primary/25 bg-primary/[0.08] text-primary",
  muted: "border-foreground/[0.08] bg-foreground/[0.04] text-muted-foreground",
}

const STATE_ICON: Record<StateTone, IconData> = {
  error: AlertCircleIcon,
  warning: Alert02Icon,
  empty: InboxIcon,
  muted: InboxIcon,
}

export function StatePanel({
  tone,
  title,
  description,
  icon,
  action,
  detail,
  compact = false,
  className,
}: {
  tone: StateTone
  title: string
  description?: React.ReactNode
  icon?: IconData
  /** A way forward: retry, set up, go elsewhere. */
  action?: React.ReactNode
  /** Small print for support, e.g. a request reference. */
  detail?: React.ReactNode
  /** Inline inside a panel rather than filling one. */
  compact?: boolean
  className?: string
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex flex-col items-center gap-3 text-center", compact ? "px-4 py-6" : "px-6 py-12", className)}
    >
      <span className={cn("flex size-11 items-center justify-center rounded-2xl border", STATE_CHIP[tone])}>
        <HugeiconsIcon icon={icon ?? STATE_ICON[tone]} className="size-5" strokeWidth={1.8} />
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <p className="font-display text-[15.5px] font-semibold text-foreground">{title}</p>
        {description && <p className="text-[13px] leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {action}
      {detail && <p className="break-all font-mono text-[11px] text-muted-foreground/80">{detail}</p>}
    </div>
  )
}

/** Something failed to load. Always offers a retry when one is possible. */
export function ErrorPanel({
  title = "Couldn't load this",
  message,
  onRetry,
  reference,
  compact,
  className,
}: {
  title?: string
  message?: React.ReactNode
  onRetry?: () => void
  /** A request id for support; shown as small print, never the backend's text. */
  reference?: string | null
  compact?: boolean
  className?: string
}) {
  return (
    <StatePanel
      tone="error"
      title={title}
      description={message}
      compact={compact}
      className={className}
      action={onRetry && <NeutralButton onClick={onRetry}>Try again</NeutralButton>}
      detail={reference ? `Reference: ${reference}` : undefined}
    />
  )
}

/** Nothing here yet. Says what will appear, so it never reads as a failure. */
export function EmptyPanel({ title, description, icon, action, compact, className }: { title: string; description?: React.ReactNode; icon?: IconData; action?: React.ReactNode; compact?: boolean; className?: string }) {
  return <StatePanel tone="empty" title={title} description={description} icon={icon} action={action} compact={compact} className={className} />
}

/** A feature that is switched off, paused or not open yet: calm, never an error. */
export function UnavailableState({ title, description, paused = false, action, compact, className }: { title: string; description?: React.ReactNode; paused?: boolean; action?: React.ReactNode; compact?: boolean; className?: string }) {
  return <StatePanel tone={paused ? "warning" : "muted"} title={title} description={description} action={action} compact={compact} className={className} />
}

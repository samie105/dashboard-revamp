/**
 * A status badge: icon + word + colour, never colour alone. The tone says
 * what the status means (success = money arrived, danger = failed); the
 * label is whatever the screen calls the state.
 */

import { HugeiconsIcon } from "@hugeicons/react"
import { Alert02Icon, CancelCircleIcon, CheckmarkCircle02Icon, Clock01Icon, InformationCircleIcon } from "@hugeicons/core-free-icons"

import { TONE_CLASSES, type DashTone } from "@/lib/dash-ui"
import { cn } from "@/lib/utils"

const TONE_ICON = {
  neutral: InformationCircleIcon,
  info: Clock01Icon,
  success: CheckmarkCircle02Icon,
  warning: Alert02Icon,
  danger: CancelCircleIcon,
} as const

export function StatusBadge({ tone, label, className }: { tone: DashTone; label: string; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.04em]", TONE_CLASSES[tone], className)}>
      <HugeiconsIcon icon={TONE_ICON[tone]} className="size-3" strokeWidth={2.2} />
      {label}
    </span>
  )
}

/** A neutral label chip, e.g. "Demo data" in the previews or a network name. */
export function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-full border border-foreground/[0.08] bg-foreground/[0.03] px-2 py-0.5 text-[11px] font-semibold text-muted-foreground", className)}>
      {children}
    </span>
  )
}

/**
 * A signed percentage: arrow + figure + colour (up = credit, down = debit).
 * Flat reads neutral rather than green, so a missing move never looks like a gain.
 */
export function ChangeChip({ value, className }: { value: number; className?: string }) {
  const up = value > 0
  const down = value < 0
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[12px] font-semibold tabular-nums",
        up ? "bg-credit/[0.12] text-credit" : down ? "bg-debit/[0.12] text-debit" : "bg-foreground/[0.06] text-muted-foreground",
        className,
      )}
    >
      <span aria-hidden>{up ? "▲" : down ? "▼" : "•"}</span>
      <span className="sr-only">{up ? "Up" : down ? "Down" : "Unchanged"}</span>
      {Math.abs(value).toFixed(2)}%
    </span>
  )
}

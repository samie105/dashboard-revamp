"use client"

/**
 * Toast — a transient answer to something the user just did.
 *
 * The app had no toast until now, though the design system already reserved
 * the layer for one (06-motion-accessibility: sticky 100 → dropdown 400 →
 * modal 800 → toast 1200, and `role="status"`, `role="alert"` for danger).
 * This is that layer, built to the same house rules as the rest of the chrome:
 * a SOLID surface with a hairline — the glass ban covers anything that floats
 * over content — 20px corners, and the standard Rise entrance so it arrives
 * the way every other section of the product does.
 *
 * It is deliberately not a queue or a global store. One message, owned by the
 * screen that raised it, dismissed by a timer or by the reader. A second
 * caller that needs stacking can grow this; inventing the stack before there
 * are two callers would be inventing a shape nothing has asked for.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertCircleIcon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

export type ToastTone = "info" | "success" | "warning"

const TONE: Record<ToastTone, { icon: typeof AlertCircleIcon; chip: string }> = {
  info: { icon: InformationCircleIcon, chip: "bg-primary/[0.12] text-primary" },
  success: { icon: CheckmarkCircle02Icon, chip: "bg-credit-chip text-credit" },
  warning: { icon: AlertCircleIcon, chip: "bg-warning-chip text-warning" },
}

export function Toast({
  open,
  onClose,
  title,
  description,
  icon,
  tone = "info",
  /** Milliseconds on screen. `null` keeps it up until dismissed. */
  duration = 7000,
  className,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  /** Overrides the tone's default glyph. */
  icon?: typeof AlertCircleIcon
  tone?: ToastTone
  duration?: number | null
  className?: string
}) {
  /* The timer is keyed to `open` so re-raising a dismissed toast restarts it.
     A caller that raises the SAME toast twice (pressing a gated tab again)
     remounts it with a `key`, which restarts this too. */
  React.useEffect(() => {
    if (!open || duration === null) return
    const id = setTimeout(onClose, duration)
    return () => clearTimeout(id)
  }, [open, duration, onClose])

  // Escape dismisses, the same as every other transient surface in the app.
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  const { icon: toneIcon, chip } = TONE[tone]

  return (
    <div
      // `status` not `alert`: this reports something, it doesn't interrupt.
      role="status"
      aria-live="polite"
      className={cn(
        "rise fixed inset-x-4 bottom-4 z-[1200] flex items-start gap-3 rounded-2xl bg-card p-4 shadow-[0_18px_44px_-16px_rgb(0_0_0/0.7)] ring-1 ring-border/60",
        "sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[22rem]",
        className,
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          chip,
        )}
      >
        <HugeiconsIcon icon={icon ?? toneIcon} className="h-[18px] w-[18px]" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="font-display text-[14px] font-semibold leading-tight tracking-[-0.01em]">
          {title}
        </p>
        {description && (
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
        className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
      >
        <HugeiconsIcon icon={Cancel01Icon} className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

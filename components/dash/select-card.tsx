"use client"

/**
 * Selectable cards: one choice from a set, each card describing itself (icon,
 * label, detail, optional meta on the right). The selected card is lit gold
 * and the highlight slides between cards. A radiogroup with roving focus and
 * arrow keys, so it behaves like the native control it replaces.
 */

import * as React from "react"
import { motion } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"

import { cn } from "@/lib/utils"

type IconData = React.ComponentProps<typeof HugeiconsIcon>["icon"]

export interface SelectCardOption<T extends string> {
  key: T
  label: string
  detail?: string
  icon?: IconData
  /** Right-hand meta, e.g. an arrival time. */
  meta?: React.ReactNode
  /** Shown but not selectable; `disabledLabel` says why. */
  disabled?: boolean
  disabledLabel?: string
}

/** The same spring the preview uses for every sliding indicator. */
const SLIDE = { type: "spring", stiffness: 520, damping: 42, mass: 0.9 } as const

export function SelectCards<T extends string>({
  label,
  options,
  value,
  onChange,
  columns = 2,
  disabled = false,
}: {
  label: string
  options: readonly SelectCardOption<T>[]
  value: T | null
  onChange: (key: T) => void
  columns?: 1 | 2 | 3
  /** The whole group, e.g. while a request made from this choice is in flight. */
  disabled?: boolean
}) {
  const layoutId = React.useId()
  const refs = React.useRef<Record<string, HTMLButtonElement | null>>({})
  const enabled = options.filter((o) => !o.disabled)
  const focusKey = value ?? enabled[0]?.key

  const move = (from: T, step: number) => {
    const i = enabled.findIndex((o) => o.key === from)
    const next = enabled[(i + step + enabled.length) % enabled.length]
    if (!next) return
    onChange(next.key)
    refs.current[next.key]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("grid grid-cols-1 gap-2", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-3")}
    >
      {options.map((o) => {
        const on = o.key === value
        const off = disabled || o.disabled
        return (
          <button
            key={o.key}
            ref={(node) => {
              refs.current[o.key] = node
            }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-disabled={off || undefined}
            tabIndex={o.key === focusKey && !off ? 0 : -1}
            onClick={() => !off && onChange(o.key)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault()
                move(o.key, 1)
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault()
                move(o.key, -1)
              }
            }}
            className={cn(
              "relative flex items-center gap-3 rounded-2xl border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/60",
              off
                ? "cursor-not-allowed border-foreground/[0.05] opacity-50"
                : on
                  ? "border-primary/55"
                  : "border-foreground/[0.08] hover:border-foreground/[0.15]",
            )}
          >
            {on && <motion.span layoutId={layoutId} transition={SLIDE} aria-hidden className="absolute inset-0 rounded-2xl bg-primary/[0.07]" />}
            {o.icon && (
              <span
                className={cn(
                  "relative flex size-10 shrink-0 items-center justify-center rounded-xl border transition-colors",
                  on ? "border-primary/40 bg-primary/[0.12] text-primary" : "border-foreground/[0.08] bg-foreground/[0.03] text-foreground/80",
                )}
              >
                <HugeiconsIcon icon={o.icon} className="size-[18px]" strokeWidth={1.7} />
              </span>
            )}
            <span className="relative flex min-w-0 flex-1 flex-col leading-tight">
              <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-foreground">
                <span className="truncate">{o.label}</span>
                {o.disabled && o.disabledLabel && (
                  <span className="rounded bg-foreground/[0.08] px-1 text-[9.5px] font-bold uppercase tracking-[0.05em] text-muted-foreground">{o.disabledLabel}</span>
                )}
              </span>
              {o.detail && <span className="mt-0.5 truncate text-[12px] text-muted-foreground">{o.detail}</span>}
            </span>
            {o.meta && <span className="relative shrink-0 text-right text-[12px] leading-tight text-muted-foreground">{o.meta}</span>}
          </button>
        )
      })}
    </div>
  )
}

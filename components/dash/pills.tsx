"use client"

/**
 * Pill tabs: a small segmented choice whose gold marker slides to the
 * selected option. WAI-ARIA tabs with roving focus and arrow keys.
 */

import * as React from "react"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"

const SLIDE = { type: "spring", stiffness: 520, damping: 42, mass: 0.9 } as const

export function PillTabs<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string
  options: readonly { key: T; label: string }[]
  value: T
  onChange: (key: T) => void
  className?: string
}) {
  const layoutId = React.useId()
  const refs = React.useRef<Record<string, HTMLButtonElement | null>>({})
  const move = (from: number, step: number) => {
    const next = options[(from + step + options.length) % options.length]
    onChange(next.key)
    refs.current[next.key]?.focus()
  }
  return (
    <div role="tablist" aria-label={label} className={cn("inline-flex items-center gap-0 rounded-full border sm:gap-0.5 border-foreground/[0.07] bg-foreground/[0.025] p-0.5", className)}>
      {options.map((o, i) => {
        const on = o.key === value
        return (
          <button
            key={o.key}
            ref={(node) => {
              refs.current[o.key] = node
            }}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.key)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") {
                e.preventDefault()
                move(i, 1)
              } else if (e.key === "ArrowLeft") {
                e.preventDefault()
                move(i, -1)
              }
            }}
            className={cn(
              "relative h-7 rounded-full px-2.5 text-[12px] font-semibold sm:px-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/60",
              on ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {on && <motion.span layoutId={layoutId} transition={SLIDE} aria-hidden className="ds-gold absolute inset-0 rounded-full" />}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

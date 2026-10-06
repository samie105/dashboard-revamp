"use client"

/**
 * Small primitives shared by the dashboard preview's panels.
 *
 * One surface, one tab treatment, one change chip — so every panel on the
 * page reads as the same object at a different size, which is most of what
 * makes a dashboard feel composed rather than assembled.
 */

import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@/lib/utils"
import { useSettings } from "@/components/settings-unauth/settings-store"

export type IconSvg = React.ComponentProps<typeof HugeiconsIcon>["icon"]

export function Icon({ icon, className, strokeWidth = 1.7 }: { icon: IconSvg; className?: string; strokeWidth?: number }) {
  return <HugeiconsIcon icon={icon} strokeWidth={strokeWidth} className={cn("size-[18px] shrink-0", className)} />
}

/** A spring that settles quickly without bouncing — used for every indicator
 *  that slides between options, so they all move with the same hand. */
export const SLIDE = { type: "spring", stiffness: 520, damping: 42, mass: 0.9 } as const

/* ── Privacy ──────────────────────────────────────────────────────────────
   One switch for the whole page: hiding the headline balance and leaving the
   four balance cards beside it readable would hide nothing. */

const PrivacyContext = React.createContext<{ hidden: boolean; toggle: () => void }>({
  hidden: false,
  toggle: () => {},
})

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  // Starts from Settings → Preferences → "Hide balances by default"; the eye
  // button then overrides it for the session.
  const byDefault = useSettings().prefs.hideBalances
  const [override, setOverride] = React.useState<boolean | null>(null)
  const hidden = override ?? byDefault
  const value = React.useMemo(() => ({ hidden, toggle: () => setOverride(!hidden) }), [hidden])
  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>
}

export const usePrivacy = () => React.useContext(PrivacyContext)

/** Renders the figure, or a mask of the same rhythm when balances are hidden. */
export function Figure({ children, mask = "••••••" }: { children: React.ReactNode; mask?: string }) {
  const { hidden } = usePrivacy()
  return <>{hidden ? mask : children}</>
}

/* ── Panel — the one card surface ─────────────────────────────────────────
   A hairline border, a faint top-lit gradient and a 1px inner highlight on
   the upper edge. The highlight is what separates a panel from a box: it
   catches light the way a bevelled edge does, without any drop shadow. */

export function Panel({
  className,
  children,
  as: Tag = "section",
  ref,
  ...rest
}: React.HTMLAttributes<HTMLElement> & { as?: "section" | "div" | "article"; ref?: React.Ref<HTMLElement> }) {
  return (
    // The cast: `Tag` is a union, and TS types its ref as the narrowest
    // member's (HTMLDivElement). All three are plain HTMLElements at runtime.
    <Tag ref={ref as React.Ref<HTMLDivElement>} className={cn("dash-panel relative overflow-hidden rounded-[20px]", className)} {...rest}>
      {children}
    </Tag>
  )
}

export function PanelTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={cn("font-display text-[16px] font-semibold tracking-[-0.01em] text-foreground", className)}>
      {children}
    </h2>
  )
}

/* ── Tabs ─────────────────────────────────────────────────────────────────
   Three looks, one behaviour. The active marker is a shared-layout element,
   so it SLIDES to the new option instead of blinking out and back in. */

type TabOption<T extends string> = { key: T; label: React.ReactNode }

export function UnderlineTabs<T extends string>({
  options,
  value,
  onChange,
  className,
  id,
}: {
  options: TabOption<T>[]
  value: T
  onChange: (v: T) => void
  className?: string
  id: string
}) {
  return (
    <div role="tablist" className={cn("flex items-stretch gap-1", className)}>
      {options.map((o) => {
        const active = o.key === value
        return (
          <button
            key={o.key}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(o.key)}
            className={cn(
              "relative whitespace-nowrap px-3 pb-3.5 pt-1 text-[13.5px] font-semibold transition-colors duration-200",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
            {active && (
              <motion.span
                layoutId={`${id}-underline`}
                transition={SLIDE}
                className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-primary shadow-[0_0_12px_var(--primary)]"
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

export function PillTabs<T extends string>({
  options,
  value,
  onChange,
  className,
  id,
  size = "md",
}: {
  options: TabOption<T>[]
  value: T
  onChange: (v: T) => void
  className?: string
  id: string
  size?: "sm" | "md"
}) {
  return (
    <div
      role="tablist"
      className={cn("inline-flex items-center gap-0.5 rounded-xl border border-white/[0.06] bg-white/[0.025] p-1", className)}
    >
      {options.map((o) => {
        const active = o.key === value
        return (
          <button
            key={o.key}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(o.key)}
            className={cn(
              "relative whitespace-nowrap rounded-lg font-semibold tabular-nums transition-colors duration-200",
              size === "sm" ? "h-7 px-2.5 text-[11.5px]" : "h-8 px-3.5 text-[12.5px]",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={`${id}-pill`}
                transition={SLIDE}
                className="absolute inset-0 rounded-lg border border-primary/50 bg-primary/[0.1] shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]"
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/* ── Change chip ──────────────────────────────────────────────────────────
   Direction is the only thing that earns green or red on this page. */

export function ChangeChip({ value, className, size = "md" }: { value: number; className?: string; size?: "sm" | "md" }) {
  const up = value >= 0
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-semibold tabular-nums",
        size === "sm" ? "h-6 min-w-[62px] px-2 text-[11.5px]" : "h-8 px-3 text-[13.5px]",
        up ? "bg-credit/[0.13] text-credit" : "bg-debit/[0.13] text-debit",
        className,
      )}
    >
      {up ? "+" : "−"}
      {Math.abs(value).toFixed(2)}%
    </span>
  )
}

/** A "View all" style link — quiet gold text with an arrow that nudges on hover. */
export function MoreLink({ children, icon, href = "#" }: { children: React.ReactNode; icon: IconSvg; href?: string }) {
  return (
    <a
      href={href}
      className="group inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary transition-opacity hover:opacity-85"
    >
      {children}
      <Icon icon={icon} className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={2} />
    </a>
  )
}

/* ── Spark — the in-row 7-day curve ───────────────────────────────────────
   Coloured by its OWN direction (first point vs last), so a curve can never
   disagree with the percentage printed beside it. A faint fill under the line
   gives it weight at 24px tall, where a bare 1.5px stroke reads as a scratch. */

function sparkPath(points: number[], w: number, h: number, pad = 2) {
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  const xy = points.map((v, i) => [(i / (points.length - 1)) * w, pad + (1 - (v - min) / span) * (h - pad * 2)])
  let d = `M${xy[0][0].toFixed(1)},${xy[0][1].toFixed(1)}`
  for (let i = 0; i < xy.length - 1; i++) {
    const [x0, y0] = xy[Math.max(0, i - 1)]
    const [x1, y1] = xy[i]
    const [x2, y2] = xy[i + 1]
    const [x3, y3] = xy[Math.min(xy.length - 1, i + 2)]
    d += ` C${(x1 + (x2 - x0) / 6).toFixed(1)},${(y1 + (y2 - y0) / 6).toFixed(1)} ${(x2 - (x3 - x1) / 6).toFixed(1)},${(y2 - (y3 - y1) / 6).toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`
  }
  return d
}

export function Spark({
  points,
  width = 88,
  height = 28,
  tone,
  fluid,
  className,
}: {
  points: number[]
  width?: number
  height?: number
  /** Stretch to the container's width; `width` then only sets the curve's
   *  proportions. The stroke stays one weight via non-scaling-stroke. */
  fluid?: boolean
  /** Defaults to the series' own direction. */
  tone?: "credit" | "debit" | "brand"
  className?: string
}) {
  const id = React.useId().replace(/:/g, "")
  const up = points[points.length - 1] >= points[0]
  const color = tone === "brand" ? "var(--primary)" : (tone ?? (up ? "credit" : "debit")) === "credit" ? "var(--credit)" : "var(--debit)"
  const line = sparkPath(points, width, height)
  return (
    <svg
      width={fluid ? "100%" : width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={fluid ? "none" : undefined}
      className={cn("shrink-0 overflow-visible", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${width},${height} L0,${height} Z`} fill={`url(#spark-${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/* ── ViewSelect — a styled dropdown that picks what a panel shows ─────────
   Replaces a row of tabs where the row would overflow (or scroll, headers
   and all) on a phone. One button names the current view and its count;
   the menu lists every view with its count and a one-line hint. Keyboard:
   Enter/Space/↓ open, ↑/↓ move, Enter picks, Esc closes. */

export type ViewOption<T extends string> = { key: T; label: string; count?: number; hint?: string; icon?: IconSvg }

export function ViewSelect<T extends string>({ options, value, onChange, className, align = "left" }: { options: ViewOption<T>[]; value: T; onChange: (v: T) => void; className?: string; align?: "left" | "right" }) {
  const [open, setOpen] = React.useState(false)
  const [focus, setFocus] = React.useState(0)
  const wrap = React.useRef<HTMLDivElement>(null)
  const current = options.find((o) => o.key === value) ?? options[0]

  React.useEffect(() => {
    if (!open) return
    setFocus(Math.max(0, options.findIndex((o) => o.key === value)))
    const onDown = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener("pointerdown", onDown)
    return () => window.removeEventListener("pointerdown", onDown)
  }, [open, options, value])

  const onKey = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault()
      setOpen(true)
      return
    }
    if (!open) return
    if (e.key === "Escape") setOpen(false)
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setFocus((f) => Math.min(options.length - 1, f + 1))
    }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      setFocus((f) => Math.max(0, f - 1))
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onChange(options[focus].key)
      setOpen(false)
    }
  }

  return (
    <div ref={wrap} className={cn("relative", className)} onKeyDown={onKey}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "group flex h-10 items-center gap-2 rounded-xl border bg-white/[0.03] pl-3 pr-2.5 text-left transition-colors",
          open ? "border-primary/45" : "border-white/[0.08] hover:border-white/[0.16]",
        )}
      >
        {current.icon && <Icon icon={current.icon} className="size-4 text-primary" />}
        <span className="font-display text-[14.5px] font-semibold text-foreground">{current.label}</span>
        {current.count !== undefined && <span className="rounded-md bg-primary/[0.14] px-1.5 text-[11px] font-bold tabular-nums text-primary">{current.count}</span>}
        <svg viewBox="0 0 16 16" aria-hidden className={cn("ml-0.5 size-4 text-muted-foreground transition-transform duration-300", open && "rotate-180 text-foreground")}>
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            aria-activedescendant={`opt-${String(options[focus]?.key)}`}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "absolute top-full z-40 mt-2 w-[min(280px,calc(100vw-32px))] rounded-2xl border border-white/[0.08] bg-[#141414]/98 p-1.5 shadow-[0_24px_60px_-12px_rgb(0_0_0/0.85)] backdrop-blur-xl",
              align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left",
            )}
          >
            {options.map((o, i) => {
              const on = o.key === value
              return (
                <li key={o.key} id={`opt-${o.key}`} role="option" aria-selected={on}>
                  <button
                    type="button"
                    onMouseEnter={() => setFocus(i)}
                    onClick={() => {
                      onChange(o.key)
                      setOpen(false)
                    }}
                    className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors", i === focus ? "bg-white/[0.05]" : "", on && "bg-primary/[0.08]")}
                  >
                    {o.icon && (
                      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-[10px] border", on ? "border-primary/40 bg-primary/[0.12] text-primary" : "border-white/[0.07] bg-white/[0.03] text-muted-foreground")}>
                        <Icon icon={o.icon} className="size-4" />
                      </span>
                    )}
                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className={cn("text-[13.5px] font-semibold", on ? "text-primary" : "text-foreground")}>{o.label}</span>
                      {o.hint && <span className="truncate text-[11.5px] text-muted-foreground">{o.hint}</span>}
                    </span>
                    {o.count !== undefined && <span className="rounded-md bg-white/[0.07] px-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground">{o.count}</span>}
                    {on && (
                      <svg viewBox="0 0 16 16" aria-hidden className="size-4 text-primary">
                        <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                </li>
              )
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}

"use client"

/**
 * The preview order form's parts (components/trade-unauth/order-form.tsx):
 * side tabs, type tabs, the field box, the percent and leverage sliders, the
 * summary box and the panel head. Markup copied; colours moved onto theme
 * tokens. They are presentational only: the trade screen's ticket feeds them
 * its own state and handlers, so no order logic lives here.
 */

import * as React from "react"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"
import { SLIDE } from "@/components/dashboard/redesign/ui"

/** The order panel's head: "Spot order" / "Perpetual order" and a note. */
export function OrderPanelHead({ title, note }: { title: string; note?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-display text-[15px] font-semibold">{title}</span>
      {note && <span className="truncate text-[11.5px] font-medium text-muted-foreground">{note}</span>}
    </div>
  )
}

export function SideTabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { key: T; label: string; tone: "credit" | "debit"; attrs?: Record<string, string | undefined> }[]
}) {
  return (
    <div role="tablist" aria-label="Side" className="grid grid-cols-2 gap-1 rounded-2xl border border-foreground/[0.06] bg-foreground/[0.025] p-1">
      {options.map((o) => {
        const on = o.key === value
        return (
          <button
            key={o.key}
            role="tab"
            type="button"
            aria-selected={on}
            onClick={() => onChange(o.key)}
            {...o.attrs}
            className={cn("relative h-10 rounded-xl text-[14px] font-semibold transition-colors", on ? "text-white" : "text-muted-foreground hover:text-foreground")}
          >
            {on && (
              <motion.span
                layoutId="order-side"
                transition={SLIDE}
                className={cn("absolute inset-0 rounded-xl shadow-[inset_0_1px_0_rgb(255_255_255/0.2)]", o.tone === "credit" ? "bg-credit" : "bg-debit")}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function TypeTabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { key: T; label: string; disabled?: boolean; title?: string }[] }) {
  return (
    <div role="tablist" aria-label="Order type" className="flex gap-4 border-b border-foreground/[0.06]">
      {options.map((o) => {
        const on = o.key === value
        return (
          <button
            key={o.key}
            role="tab"
            type="button"
            aria-selected={on}
            disabled={o.disabled}
            title={o.title}
            onClick={() => onChange(o.key)}
            data-vivid-target={`order-type-${o.key}`}
            className={cn("relative pb-2.5 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40", on ? "text-foreground" : "text-muted-foreground enabled:hover:text-foreground")}
          >
            {o.label}
            {on && <motion.span layoutId="order-type" transition={SLIDE} className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-primary" />}
          </button>
        )
      })}
    </div>
  )
}

/** The preview's field box: label on the left, the input right-aligned, a
 *  suffix after it. Takes the real input as its child. */
export function FieldBox({ label, suffix, invalid, disabled, children }: { label: string; suffix?: React.ReactNode; invalid?: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <label
      className={cn(
        "flex h-12 items-center gap-2 rounded-xl border px-3.5 transition-colors",
        disabled ? "border-foreground/[0.05] bg-foreground/[0.015]" : invalid ? "border-debit/50 bg-debit/[0.03]" : "border-foreground/[0.08] bg-foreground/[0.025] focus-within:border-primary/45",
      )}
    >
      <span className="w-14 shrink-0 text-[12px] font-medium text-muted-foreground">{label}</span>
      {children}
      {suffix != null && <span className="shrink-0 text-[12px] font-semibold text-muted-foreground">{suffix}</span>}
    </label>
  )
}

/** The preview perp form's top row: Cross / Isolated and the contract's max
 *  leverage. The venue sets the margin mode per contract, so the row shows
 *  it rather than offering a switch that would change nothing. */
export function MarginModeRow({ mode, maxLeverage }: { mode: "cross" | "isolated"; maxLeverage: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="grid flex-1 grid-cols-2 gap-1 rounded-xl border border-foreground/[0.06] bg-foreground/[0.025] p-1">
        {(["cross", "isolated"] as const).map((k) => (
          <span
            key={k}
            aria-current={mode === k ? "true" : undefined}
            title={mode === k ? undefined : `This contract trades ${mode} margin`}
            className={cn(
              "flex h-8 items-center justify-center rounded-lg text-[12.5px] font-semibold capitalize",
              mode === k ? "bg-foreground/[0.08] text-foreground" : "text-muted-foreground/50",
            )}
          >
            {k}
          </span>
        ))}
      </div>
      <span className="rounded-xl border border-foreground/[0.06] px-2.5 py-2 text-[11.5px] font-semibold tabular-nums text-muted-foreground">Max {maxLeverage}×</span>
    </div>
  )
}

/** The class the field's own input takes. */
export const FIELD_INPUT =
  "min-w-0 flex-1 bg-transparent text-right text-[14px] font-semibold tabular-nums text-foreground outline-none placeholder:font-medium placeholder:text-muted-foreground/60 disabled:text-muted-foreground"

/** 0–100 slider with snap marks at the quarters. */
export function PercentSlider({ value, onChange, tone }: { value: number; onChange: (v: number) => void; tone: "credit" | "debit" }) {
  const track = React.useRef<HTMLDivElement>(null)
  const set = (clientX: number) => {
    const box = track.current?.getBoundingClientRect()
    if (!box) return
    let v = Math.round(((clientX - box.left) / box.width) * 100)
    v = Math.max(0, Math.min(100, v))
    for (const m of [0, 25, 50, 75, 100]) if (Math.abs(v - m) <= 3) v = m
    onChange(v)
  }
  return (
    <div className="flex flex-col gap-1.5 px-1 pt-1">
      <div
        ref={track}
        role="slider"
        aria-label="Percent of available"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        tabIndex={0}
        data-vivid-target="trade-amount-percent"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") onChange(Math.min(100, value + 5))
          if (e.key === "ArrowLeft") onChange(Math.max(0, value - 5))
        }}
        onPointerDown={(e) => {
          ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
          set(e.clientX)
        }}
        onPointerMove={(e) => e.buttons === 1 && set(e.clientX)}
        className="relative h-5 cursor-pointer touch-none outline-none"
      >
        <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-foreground/[0.08]" />
        <span className={cn("absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full", tone === "credit" ? "bg-credit" : "bg-debit")} style={{ width: `${value}%` }} />
        {[0, 25, 50, 75, 100].map((m) => (
          <span
            key={m}
            className={cn(
              "absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] border-2 border-card",
              value >= m ? (tone === "credit" ? "bg-credit" : "bg-debit") : "bg-foreground/15",
            )}
            style={{ left: `${m}%` }}
          />
        ))}
        <span className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-card bg-foreground shadow-[0_0_0_1px_color-mix(in_oklab,var(--foreground)_25%,transparent)]" style={{ left: `${value}%` }} />
      </div>
      <div className="flex justify-between text-[10.5px] font-medium tabular-nums text-muted-foreground">
        {[0, 25, 50, 75, 100].map((m) => (
          <button key={m} type="button" onClick={() => onChange(m)} className="hover:text-foreground">
            {m}%
          </button>
        ))}
      </div>
    </div>
  )
}

export function LeverageSlider({ value, max, onChange }: { value: number; max: number; onChange: (v: number) => void }) {
  const marks = [...new Set([1, ...[0.25, 0.5, 0.75].map((f) => Math.max(2, Math.round(max * f))), max])].filter((m) => m <= max)
  const track = React.useRef<HTMLDivElement>(null)
  const set = (clientX: number) => {
    const box = track.current?.getBoundingClientRect()
    if (!box) return
    const f = Math.max(0, Math.min(1, (clientX - box.left) / box.width))
    onChange(Math.max(1, Math.round(1 + f * (max - 1))))
  }
  const pos = max > 1 ? ((value - 1) / (max - 1)) * 100 : 0
  const risky = value >= max * 0.5

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-muted-foreground">Leverage</span>
        <span className={cn("rounded-lg px-2 py-0.5 font-display text-[14px] font-semibold tabular-nums", risky ? "bg-warning/[0.12] text-warning" : "bg-primary/[0.1] text-primary")}>{value}×</span>
      </div>
      <div
        ref={track}
        role="slider"
        aria-label={`Leverage multiplier, 1 to ${max}`}
        aria-valuemin={1}
        aria-valuemax={max}
        aria-valuenow={value}
        tabIndex={0}
        data-vivid-target="trade-leverage"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") onChange(Math.min(max, value + 1))
          if (e.key === "ArrowLeft") onChange(Math.max(1, value - 1))
        }}
        onPointerDown={(e) => {
          ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
          set(e.clientX)
        }}
        onPointerMove={(e) => e.buttons === 1 && set(e.clientX)}
        className="relative h-5 cursor-pointer touch-none outline-none"
      >
        <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-foreground/[0.08]" />
        <span
          className={cn("absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full transition-colors duration-300", value >= max * 0.8 ? "bg-debit" : risky ? "bg-warning" : "bg-primary")}
          style={{ width: `${pos}%` }}
        />
        <span className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-card bg-foreground shadow-[0_0_0_1px_color-mix(in_oklab,var(--foreground)_25%,transparent)]" style={{ left: `${pos}%` }} />
      </div>
      <div className="flex justify-between text-[10.5px] font-medium tabular-nums text-muted-foreground">
        {marks.map((m) => (
          <button key={m} type="button" onClick={() => onChange(m)} className={cn("hover:text-foreground", value === m && "text-foreground")}>
            {m}×
          </button>
        ))}
      </div>
    </div>
  )
}

/** The preview's checkbox row (its "Take profit / Stop loss" toggle), used
 *  for a real checkbox: the box is the input's own `checked` state. */
export function CheckRow({
  checked,
  onChange,
  label,
  hint,
  attrs,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint?: string
  attrs?: Record<string, string | undefined>
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-[12.5px] font-semibold text-foreground/85">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" {...attrs} />
      <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40", checked ? "border-primary bg-primary" : "border-foreground/25")}>
        {checked && <span className="size-1.5 rounded-[1px] bg-primary-foreground" />}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        {label}
        {hint && <span className="text-[11px] font-normal leading-snug text-muted-foreground">{hint}</span>}
      </span>
    </label>
  )
}

/** The preview's collapsible "Take profit / Stop loss" section. Starts open
 *  when it already holds a value, so a set price is never hidden. */
export function Collapsible({ label, defaultOpen, children }: { label: string; defaultOpen: boolean; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(defaultOpen)
  React.useEffect(() => {
    if (defaultOpen) setOpen(true)
  }, [defaultOpen])
  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex items-center justify-between text-[12.5px] font-semibold text-foreground/85">
        <span className="flex items-center gap-2">
          <span className={cn("flex size-4 items-center justify-center rounded-[4px] border transition-colors", open ? "border-primary bg-primary" : "border-foreground/25")}>
            {open && <span className="size-1.5 rounded-[1px] bg-primary-foreground" />}
          </span>
          {label}
        </span>
        <svg viewBox="0 0 24 24" className={cn("size-4 text-muted-foreground transition-transform duration-300", open && "rotate-180")} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && <div className="flex flex-col gap-2">{children}</div>}
    </div>
  )
}

/** The summary box. `strong` rows sit under a hairline, as the total. */
export function Summary({ rows }: { rows: { label: string; value: React.ReactNode; strong?: boolean; tone?: string }[] }) {
  return (
    <dl className="flex flex-col gap-2 rounded-xl border border-foreground/[0.06] bg-foreground/[0.015] px-3.5 py-3 text-[12.5px]">
      {rows.map((r) => (
        <div key={r.label} className={cn("flex justify-between gap-3", r.strong && "mt-0.5 border-t border-foreground/[0.06] pt-2.5")}>
          <dt className="text-muted-foreground">{r.label}</dt>
          <dd className={cn("font-semibold tabular-nums text-foreground", r.tone)}>{r.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** The preview's message line, in the three tones the ticket needs. */
export function Notice({ tone, children, role = "status" }: { tone: "good" | "bad" | "warn" | "quiet"; children: React.ReactNode; role?: "status" | "alert" }) {
  return (
    <p
      role={role}
      className={cn(
        "rounded-xl border px-3.5 py-2.5 text-[12.5px] font-medium leading-relaxed",
        tone === "good" && "border-credit/25 bg-credit/[0.07] text-credit",
        tone === "bad" && "border-debit/25 bg-debit/[0.07] text-debit",
        tone === "warn" && "border-warning/25 bg-warning/[0.07] text-warning",
        tone === "quiet" && "border-foreground/[0.06] bg-foreground/[0.02] text-muted-foreground",
      )}
    >
      {children}
    </p>
  )
}

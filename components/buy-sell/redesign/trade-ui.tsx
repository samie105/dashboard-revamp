"use client"

/**
 * The Buy and Sell pages' building blocks.
 *
 * A person coming here wants to do one thing: put in an amount and see what
 * they get. So the amount is the hero, choices are pills (not dropdowns in
 * boxes in boxes), anything technical stays out of sight, and each screen has
 * one obvious next step. Presentational only; the flows own every request.
 */

import * as React from "react"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { Icon } from "@/components/dashboard/redesign/ui"
import { QuoteClock } from "@/components/ui/quote-clock"
import { groupDigits, stripGrouping } from "@/lib/crypto-backend/amount-format"

/* ── The amount ───────────────────────────────────────────────────────── */

export function AmountHero({
  label,
  value,
  onChange,
  chip,
  helper,
  problem,
  disabled,
  ariaLabel,
  readOnly,
  tools,
}: {
  label: string
  value: string
  onChange?: (value: string) => void
  /** The currency or asset, at the end of the row. */
  chip: React.ReactNode
  helper?: React.ReactNode
  problem?: string | null
  disabled?: boolean
  ariaLabel: string
  readOnly?: boolean
  /** Quiet shortcuts under the amount (for example 25% / Max). */
  tools?: React.ReactNode
}) {
  const id = React.useId()
  return (
    <div
      className={cn(
        "rounded-3xl border p-5 transition-colors sm:p-6",
        problem ? "border-debit/45 bg-debit/[0.03]" : "border-foreground/[0.09] bg-foreground/[0.025] focus-within:border-primary/50",
      )}
    >
      <label htmlFor={id} className="text-[13px] font-medium text-muted-foreground">{label}</label>
      <div className="mt-3 flex items-center gap-3">
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          aria-label={ariaLabel}
          aria-invalid={Boolean(problem)}
          value={groupDigits(value)}
          readOnly={readOnly}
          disabled={disabled}
          placeholder="0"
          onChange={(event) => onChange?.(stripGrouping(event.target.value))}
          className="min-w-0 flex-1 bg-transparent font-display text-[40px] font-semibold leading-none tracking-[-0.035em] tabular-nums text-foreground outline-none placeholder:text-muted-foreground/25 disabled:opacity-60 sm:text-[52px]"
        />
        {chip}
      </div>
      {(problem || helper || tools) && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className={cn("text-[13px] leading-snug", problem ? "font-medium text-debit" : "text-muted-foreground")} role={problem ? "alert" : undefined}>
            {problem ?? helper}
          </p>
          {tools}
        </div>
      )}
    </div>
  )
}

/** A currency or coin shown at the end of an amount. Static: pass `onClick` only when there is a real choice. */
export function Chip({ art, label, onClick, ariaLabel }: { art?: React.ReactNode; label: string; onClick?: () => void; ariaLabel?: string }) {
  const body = (
    <>
      {art}
      <span className="text-[15px] font-semibold text-foreground">{label}</span>
    </>
  )
  const base = "flex h-11 shrink-0 items-center gap-2 rounded-full border border-foreground/[0.1] bg-foreground/[0.04] pl-1.5 pr-4"
  return onClick ? (
    <button type="button" aria-label={ariaLabel ?? label} onClick={onClick} className={cn(base, "transition-colors hover:border-foreground/[0.2]")}>{body}</button>
  ) : (
    <span className={base}>{body}</span>
  )
}

/* ── Choices ──────────────────────────────────────────────────────────── */

export function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string
  options: { key: T; label: string; art?: React.ReactNode }[]
  value: T
  onChange: (key: T) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2.5">
        {options.map((option) => {
          const on = option.key === value
          return (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={disabled}
              onClick={() => onChange(option.key)}
              className={cn(
                "flex h-12 items-center gap-2.5 rounded-full border pl-2 pr-5 text-[15px] font-semibold transition-colors disabled:opacity-60",
                option.art ? "" : "pl-5",
                on ? "border-primary/60 bg-primary/[0.1] text-foreground" : "border-foreground/[0.09] text-muted-foreground hover:border-foreground/[0.2] hover:text-foreground",
              )}
            >
              {option.art}
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * "Delivered to your wallet on Solana · Change". The network is chosen for the
 * user; this only exists so a person who cares can look, and it says nothing
 * technical.
 */
export function QuietChoice<T extends string>({
  prefix,
  current,
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  prefix: string
  current: string
  label: string
  options: { key: T; label: string }[]
  value: T
  onChange: (key: T) => void
  disabled?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const canChange = options.length > 1
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] leading-snug text-muted-foreground">
        {prefix} <span className="font-medium text-foreground">{current}</span>
        {canChange && !disabled && (
          <>
            {" · "}
            <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="font-semibold text-primary underline-offset-2 hover:underline">
              {open ? "Done" : "Change"}
            </button>
          </>
        )}
      </p>
      {open && canChange && (
        <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
          {options.map((option) => (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={option.key === value}
              onClick={() => onChange(option.key)}
              className={cn(
                "h-10 rounded-full border px-4 text-[14px] font-semibold transition-colors",
                option.key === value ? "border-primary/60 bg-primary/[0.1] text-foreground" : "border-foreground/[0.09] text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── The result ───────────────────────────────────────────────────────── */

export type SummaryRow = { label: string; value: string }

export function QuoteSummary({
  caption,
  headline,
  sub,
  rows,
  seconds,
  total,
  usable,
}: {
  caption: string
  headline: string
  sub?: string
  rows: SummaryRow[]
  seconds: number
  total: number
  usable: boolean
}) {
  return (
    <section aria-label="Your quote" className="rounded-3xl border border-foreground/[0.09] bg-foreground/[0.025] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-muted-foreground">{caption}</p>
          <p className="mt-1.5 truncate font-display text-[32px] font-semibold leading-tight tracking-[-0.03em] tabular-nums text-foreground sm:text-[36px]">{headline}</p>
          {sub && <p className="mt-1 text-[14px] text-muted-foreground">{sub}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-center gap-1.5" aria-label={usable ? `Quote expires in ${Math.floor(seconds / 60)} minutes ${seconds % 60} seconds` : "Quote expired"}>
          <QuoteClock seconds={usable ? seconds : 0} total={total} />
          {!usable && <span className="text-[11.5px] font-semibold text-debit">Expired</span>}
        </div>
      </div>
      {rows.length > 0 && (
        <dl className="mt-5 flex flex-col gap-3.5 border-t border-foreground/[0.07] pt-5">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-6 text-[14px]">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="text-right font-medium tabular-nums text-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}

/* ── Steps ────────────────────────────────────────────────────────────── */

/** A step's heading with a way back, so a multi-step flow never traps anyone. */
export function StepHeader({ title, onBack, caption }: { title: string; onBack?: () => void; caption?: string }) {
  return (
    <div className="flex items-start gap-3">
      {onBack && (
        <button type="button" onClick={onBack} aria-label="Go back" className="-ml-1.5 mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground">
          <Icon icon={ArrowLeft01Icon} className="size-5" strokeWidth={2} />
        </button>
      )}
      <div className="min-w-0">
        <h2 className="font-display text-[22px] font-semibold leading-tight tracking-[-0.02em] text-foreground">{title}</h2>
        {caption && <p className="mt-1 text-[14px] text-muted-foreground">{caption}</p>}
      </div>
    </div>
  )
}

/** One labelled field, with the label above and room to breathe. */
export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-medium text-foreground/90">{label}</span>
      {children}
      {hint && <span className="text-[12.5px] text-muted-foreground">{hint}</span>}
    </div>
  )
}

export const fieldInput =
  "h-14 w-full rounded-2xl border border-foreground/[0.09] bg-foreground/[0.025] px-4 text-[16px] font-medium text-foreground outline-none transition-colors placeholder:font-normal placeholder:text-muted-foreground/50 focus:border-primary/50 disabled:opacity-60"

/** A plain card of label/value rows, for the signing screen and similar. */
export function RowsCard({ rows }: { rows: SummaryRow[] }) {
  return (
    <dl className="flex flex-col gap-4 rounded-3xl border border-foreground/[0.09] bg-foreground/[0.025] p-5 sm:p-6">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-6 text-[14.5px]">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="text-right font-medium tabular-nums text-foreground">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

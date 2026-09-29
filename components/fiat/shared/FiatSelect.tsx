"use client"

import * as React from "react"

export type FiatSelectOption = {
  value: string
  label: string
  meta?: string
  flag?: string
}

/**
 * A compact, native select styled for money-movement flows. The native
 * control keeps keyboard and screen-reader behaviour reliable while the
 * selected flag, supporting metadata, and focus treatment make it feel like
 * the rest of the Worldstreet flow UI.
 */
export function FiatSelect({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string
  value: string
  options: FiatSelectOption[]
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const selected = options.find((option) => option.value === value)

  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.13em] text-subtle">{label}</span>
      <span className="relative block">
        {selected?.flag && (
          <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 z-[1] -translate-y-1/2 text-[22px] leading-none">
            {selected.flag}
          </span>
        )}
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled || options.length === 0}
          aria-label={label}
          className={`h-14 w-full appearance-none rounded-2xl border border-border/45 bg-background/35 px-4 pr-11 text-sm font-semibold text-foreground outline-none transition focus:border-primary/70 focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60 ${selected?.flag ? "pl-14" : ""}`}
        >
          {options.length === 0 ? (
            <option value="">Unavailable</option>
          ) : (
            options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.flag ? `${option.flag} ` : ""}{option.label}{option.meta ? ` · ${option.meta}` : ""}
              </option>
            ))
          )}
        </select>
        <svg aria-hidden className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
      {selected?.meta && <span className="mt-1.5 block text-[12px] text-muted-foreground">{selected.meta}</span>}
    </label>
  )
}

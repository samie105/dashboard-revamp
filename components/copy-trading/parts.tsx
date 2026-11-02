"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="text-[12px] text-muted-foreground">{hint}</span>}
    </label>
  )
}

export function KindToggles({ spot, perp, onChange, disabled }: { spot: boolean; perp: boolean; onChange: (p: { spot?: boolean; perp?: boolean }) => void; disabled?: boolean }) {
  const pill = (on: boolean) => cn("rounded-full px-4 py-2 text-[13px] font-semibold transition-colors disabled:opacity-40", on ? "bg-card text-foreground shadow-sm ring-1 ring-foreground/[0.08] dark:bg-accent" : "bg-surface-sunken text-muted-foreground")
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-medium text-muted-foreground">Copy these trades</span>
      <div className="flex gap-2">
        <button type="button" aria-pressed={spot} disabled={disabled} className={pill(spot)} onClick={() => onChange({ spot: !spot })}>Spot</button>
        <button type="button" aria-pressed={perp} disabled={disabled} className={pill(perp)} onClick={() => onChange({ perp: !perp })}>Futures</button>
      </div>
    </div>
  )
}

export function StatusChip({ tone, children }: { tone: "good" | "bad" | "warn" | "muted"; children: React.ReactNode }) {
  const cls = { good: "bg-credit-chip text-credit", bad: "bg-debit-chip text-debit", warn: "bg-warning-chip text-warning", muted: "bg-surface-sunken text-muted-foreground" }[tone]
  return <span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-semibold capitalize", cls)}>{children}</span>
}

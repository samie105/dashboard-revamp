"use client"

import type { ComponentProps } from "react"
import type { FlowCta } from "@/components/ui/flow"

export function FiatAction({ label, onClick, disabled, busy }: ComponentProps<typeof FlowCta>) {
  return <button type="button" onClick={onClick} disabled={disabled || busy} aria-busy={busy || undefined} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-45">
    {busy && <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
    {label}
  </button>
}

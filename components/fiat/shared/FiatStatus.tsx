"use client"

import type { ComponentProps } from "react"
import { FiatAction as FlowCta } from "@/components/fiat/shared/FiatAction"
import { StatusScreen } from "@/components/ui/flow"
import { CopyButton } from "./SensitiveValue"

export function FiatStatus({ state, headline, caption, stages, activeIndex = 0, reference, figure, autoUpdating = true, primary, secondary }: ComponentProps<typeof StatusScreen>) {
  return <section aria-live="polite" className="mx-auto w-full max-w-xl space-y-6 rounded-2xl border border-border/50 bg-card/60 p-4 sm:p-6">
    <div className="flex items-start gap-3">
      <span aria-hidden className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${state === "success" ? "bg-credit-chip text-credit" : state === "failure" ? "bg-debit-chip text-debit" : "bg-primary/10 text-primary"}`}>{state === "success" ? "✓" : state === "failure" ? "!" : <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />}</span>
      <div className="min-w-0"><h2 className="text-xl font-semibold tracking-tight">{headline}</h2>{figure && <p className="mt-2 text-2xl font-semibold tabular-nums">{figure}</p>}<div className="mt-2 text-sm leading-relaxed text-muted-foreground">{caption}</div></div>
    </div>
    {stages && <ol>{stages.map((stage, index) => <li key={stage.key} className="flex items-center gap-3 border-b border-border/30 py-3 last:border-0"><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${index < activeIndex ? "bg-credit-chip text-credit" : index === activeIndex ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{index < activeIndex ? "✓" : index + 1}</span><span className={`text-sm ${index > activeIndex ? "text-muted-foreground" : "font-medium"}`}>{stage.label}</span></li>)}</ol>}
    {autoUpdating && state === "processing" && <p className="text-xs text-muted-foreground">Status updates automatically. Payment is complete only when confirmed.</p>}
    {reference && <div className="rounded-xl bg-background/50 p-3"><p className="text-xs text-muted-foreground">Order reference</p><div className="mt-1 flex items-start gap-2"><code className="min-w-0 flex-1 break-all text-xs">{reference}</code><CopyButton value={reference} /></div></div>}
    {primary?.onClick && <FlowCta label={primary.label} onClick={primary.onClick} />}
    {primary?.href && <a href={primary.href} className="block rounded-xl bg-primary p-3 text-center font-semibold text-primary-foreground">{primary.label}</a>}
    {secondary && <button type="button" onClick={secondary.onClick} className="w-full rounded-xl border border-border px-4 py-3 text-sm font-semibold hover:bg-muted">{secondary.label}</button>}
  </section>
}

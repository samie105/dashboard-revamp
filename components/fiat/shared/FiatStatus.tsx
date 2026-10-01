"use client"

import type { ComponentProps } from "react"
import { StatusScreen } from "@/components/ui/flow"

export function FiatStatus({ layout = "landscape", ...props }: ComponentProps<typeof StatusScreen>) {
  return <section aria-live="polite" className="mx-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-border/50 bg-card/60">
    <StatusScreen {...props} layout={layout} />
  </section>
}

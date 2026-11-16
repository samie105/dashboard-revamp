"use client"

/**
 * The opening row: who you are, and the one thing the account still needs.
 *
 * The verification prompt lives INSIDE the greeting panel rather than as a
 * banner above the page — it is the next step in this person's story, not a
 * system alert, and giving it a banner would out-shout the balance below.
 */

import * as React from "react"
import { ArrowRight02Icon } from "@hugeicons/core-free-icons"
import { DEMO_USER } from "@/components/dashboard-unauth/demo-data"
import { Icon, Panel } from "@/components/redesign/ui"

function useGreeting() {
  const [greeting, setGreeting] = React.useState<string | null>(null)
  React.useEffect(() => {
    const h = new Date().getHours()
    setGreeting(h < 5 ? "Up late" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening")
  }, [])
  return greeting
}

export function Welcome() {
  const greeting = useGreeting()

  return (
    <Panel className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h1 className="flex items-center gap-2 truncate font-display text-[20px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
          <span className="font-medium text-muted-foreground transition-opacity" style={{ opacity: greeting ? 1 : 0 }}>
            {greeting ?? "Welcome"},
          </span>
          {DEMO_USER.full}
          <span className="rounded-sm border border-white/[0.12] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Demo data</span>
        </h1>
        <p className="text-[12.5px] text-muted-foreground">Welcome back! Here&apos;s an overview of your portfolio.</p>
      </div>

      <div className="flex items-center gap-3 rounded-md border border-white/[0.12] px-3 py-2">
        <div className="flex min-w-0 flex-col">
          <h2 className="text-[13px] font-semibold text-foreground">Complete identity verification</h2>
          <p className="text-[12px] leading-snug text-muted-foreground">Unlock higher limits and more features.</p>
        </div>
        <button type="button" className="dash-gold-btn inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-[12.5px] font-semibold">
          Verify now
          <Icon icon={ArrowRight02Icon} className="size-3.5" strokeWidth={2} />
        </button>
      </div>
    </Panel>
  )
}

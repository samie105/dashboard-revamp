"use client"

/**
 * The opening row: who you are, and the one thing the account still needs.
 *
 * The verification prompt lives INSIDE the greeting panel rather than as a
 * banner above the page — it is the next step in this person's story, not a
 * system alert, and giving it a banner would out-shout the balance below.
 *
 * Copied from the preview (components/dashboard-unauth/welcome.tsx). Real
 * name from the signed-in user; "Verify now" goes to the verification page the
 * sidebar already links to (the hub). The app has no verification status, so
 * the prompt can't hide itself for people who are already verified. The
 * "Demo data" tag is gone: these figures are real. "How this works" is kept
 * under the greeting because the welcome guide tells people to reopen it from
 * here.
 */

import * as React from "react"
import { ArrowRight02Icon, HelpCircleIcon } from "@hugeicons/core-free-icons"
import { useDisplayName } from "@/hooks/useDisplayName"
import { openWelcomeGuide } from "@/components/welcome-guide"
import { Icon, Panel } from "@/components/dashboard/redesign/ui"

/** The same destination as the sidebar's Verification link (components/app-sidebar.tsx). */
const VERIFICATION_URL = "https://www.worldstreetgold.com/verification"

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
  const name = useDisplayName()

  return (
    <Panel className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h1 className="truncate font-display text-[20px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
          <span className="font-medium text-muted-foreground transition-opacity" style={{ opacity: greeting ? 1 : 0 }}>
            {greeting ?? "Welcome"},{" "}
          </span>
          {name}
        </h1>
        <button
          type="button"
          onClick={openWelcomeGuide}
          data-vivid-target="open-welcome-guide"
          data-vivid-label="Open the guide to Worldstreet"
          className="inline-flex w-fit items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <Icon icon={HelpCircleIcon} className="size-3.5" />
          How this works
        </button>
      </div>

      <div className="flex items-center gap-3 rounded-md border border-foreground/[0.12] px-3 py-2">
        <div className="flex min-w-0 flex-col">
          <h2 className="text-[13px] font-semibold text-foreground">Complete identity verification</h2>
          <p className="text-[12px] leading-snug text-muted-foreground">Unlock higher limits and more features.</p>
        </div>
        <a href={VERIFICATION_URL} className="dash-gold-btn inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-[12.5px] font-semibold">
          Verify now
          <Icon icon={ArrowRight02Icon} className="size-3.5" strokeWidth={2} />
        </a>
      </div>
    </Panel>
  )
}

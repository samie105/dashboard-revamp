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
import Image from "next/image"
import { ArrowRight02Icon, HelpCircleIcon } from "@hugeicons/core-free-icons"
import { useAuth } from "@/components/auth-provider"
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
  const { user } = useAuth()
  const name = user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Trader" : "Trader"

  return (
    <Panel className="grid grid-cols-1 items-stretch gap-4 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:p-5 md:pl-7">
      {/* Contour lines behind the greeting — a faint terrain that gives the
          panel depth without becoming a picture. */}
      <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.5]" preserveAspectRatio="none" viewBox="0 0 800 200">
        <defs>
          <linearGradient id="welcome-contour" x1="0" x2="1">
            <stop offset="0" stopColor="var(--primary)" stopOpacity="0" />
            <stop offset="0.55" stopColor="var(--primary)" stopOpacity="0.14" />
            <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((k) => (
          <path
            key={k}
            d={`M0 ${150 + k * 9} C 160 ${120 + k * 12}, 260 ${190 - k * 4}, 420 ${130 + k * 10} S 680 ${90 + k * 14}, 800 ${120 + k * 8}`}
            fill="none"
            stroke="url(#welcome-contour)"
            strokeWidth="1"
          />
        ))}
      </svg>
      <div className="relative flex min-w-0 flex-col justify-center gap-1.5 px-1 py-2 md:py-1">
        <div className="flex items-center gap-2">
          <p className="min-h-[22px] text-[15px] font-medium text-muted-foreground transition-opacity duration-500" style={{ opacity: greeting ? 1 : 0 }}>
            {greeting ?? "Welcome"},
          </p>
        </div>
        <h1 className="flex items-center gap-2.5 font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.03em] text-foreground md:text-[32px]">
          {name}
          <span aria-hidden className="inline-block origin-[70%_80%] animate-[dash-wave_2.6s_ease-in-out_1s_2] text-[26px] md:text-[28px]">
            👋
          </span>
        </h1>
        <p className="text-[14px] leading-relaxed text-muted-foreground">
          Welcome back! Here&apos;s an overview of your portfolio.
        </p>
        <button
          type="button"
          onClick={openWelcomeGuide}
          data-vivid-target="open-welcome-guide"
          data-vivid-label="Open the guide to Worldstreet"
          className="mt-1 inline-flex w-fit items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <Icon icon={HelpCircleIcon} className="size-3.5" />
          How this works
        </button>
      </div>


      <div className="dash-inset relative flex items-center gap-4 overflow-hidden rounded-2xl p-3 pr-5 md:gap-5">
        <div aria-hidden className="absolute -left-10 top-1/2 size-48 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(250,204,21,0.22),transparent)]" />
        {/* Bokeh — three soft points of light, the "lit from within" cue. */}
        <span aria-hidden className="absolute left-[22%] top-[18%] size-1 rounded-full bg-primary/70 blur-[1px]" />
        <span aria-hidden className="absolute left-[8%] top-[76%] size-[3px] rounded-full bg-primary/60 blur-[1px]" />
        <span aria-hidden className="absolute left-[30%] top-[64%] size-[2px] rounded-full bg-primary/80" />

        <div className="relative flex size-[92px] shrink-0 items-center justify-center md:size-[104px]">
          <Image
            src="/illustrations/kyc-gold.png"
            alt=""
            width={208}
            height={208}
            className="size-full object-contain drop-shadow-[0_10px_24px_rgba(250,204,21,0.28)] transition-transform duration-500 hover:-rotate-3 hover:scale-105"
          />
        </div>

        <div className="relative flex min-w-0 flex-col items-start gap-1">
          <h2 className="font-display text-[15px] font-semibold tracking-[-0.01em] text-foreground">
            Complete identity verification
          </h2>
          <p className="text-[12.5px] leading-snug text-muted-foreground">Unlock higher limits and more features.</p>
          <a href={VERIFICATION_URL} className="dash-gold-btn group mt-2.5 inline-flex h-9 items-center gap-2 rounded-[10px] px-3.5 text-[13px] font-semibold">
            Verify now
            <Icon icon={ArrowRight02Icon} className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={2} />
          </a>
        </div>
      </div>
    </Panel>
  )
}

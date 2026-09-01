"use client"

import { Skel } from "@/components/ui/system"

/**
 * The shape of the wallet, for the page to hold while the setup flow runs on
 * top of it.
 *
 * Setup used to take the whole page: the flow was an inline card and the body
 * was withheld until it finished, so the ceremony happened against nothing.
 * Now it is a modal over the page, which means the page needs something
 * underneath — and there is no wallet yet, so the only honest thing to put
 * there is the outline of the one being made.
 *
 * It is read through a blurred backdrop and is `aria-hidden`, so it is built
 * for silhouette rather than detail: the hero card, the pocket of chain cards
 * fanned behind it, the action row, the balances table. Anything finer would
 * be work nobody can see.
 */
export function WalletSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <div className="flex flex-wrap items-stretch gap-6">
        {/* Hero card — same footprint as the real one so nothing shifts when
            the wallet replaces it. */}
        <div className="relative w-full max-w-[560px] flex-1 basis-[340px] overflow-hidden rounded-[20px] bg-[linear-gradient(135deg,#2E2A27_0%,#1C1917_48%,#100E0D_100%)] p-5 shadow-[0_28px_64px_-28px_rgb(0_0_0/0.65)]">
          <div className="flex items-center justify-between">
            <Skel className="h-4 w-28" />
            <Skel className="h-6 w-9 rounded" />
          </div>
          <Skel className="mt-8 h-2.5 w-24" />
          <Skel className="mt-3 h-11 w-56 max-w-[70%]" />
          <Skel className="mt-4 h-4 w-20 rounded-full" />
          <div className="mt-10 flex items-center justify-between">
            <Skel className="h-3 w-40" />
            <Skel className="h-3 w-16" />
          </div>
        </div>

        {/* The pocket — cards dealt back to front, each showing only the strip
            the one in front leaves visible. */}
        <div className="flex w-full shrink-0 flex-col pt-2 sm:w-[292px]">
          {[0, 1, 2, 3, 4].map((index) => (
            <div
              key={index}
              className="-mb-[52px] h-[92px] rounded-[13px] bg-[linear-gradient(118deg,#2A2522_0%,#1A1614_66%,#100E0C_100%)] px-3.5 pt-3 shadow-[0_-9px_20px_-6px_rgb(0_0_0/0.75)]"
              style={{ zIndex: index + 1, marginLeft: index * 2, marginRight: index * 2 }}
            >
              <div className="flex items-center justify-between">
                <Skel className="h-3.5 w-20" />
                <Skel className="h-3.5 w-16" />
              </div>
            </div>
          ))}
          <div className="h-[116px] rounded-[16px] bg-[linear-gradient(180deg,#241F1C_0%,#141110_100%)] shadow-[0_-16px_28px_-8px_rgb(0_0_0/0.85)]" />
        </div>
      </div>

      {/* Action row + the counters that sit opposite it. */}
      <div className="flex items-center justify-between gap-6">
        <div className="flex gap-3">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="flex flex-col items-center gap-2">
              <Skel className="h-12 w-12 rounded-full" />
              <Skel className="h-2.5 w-10" />
            </div>
          ))}
        </div>
        <div className="hidden gap-8 sm:flex">
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex flex-col items-end gap-2">
              <Skel className="h-2.5 w-14" />
              <Skel className="h-4 w-8" />
            </div>
          ))}
        </div>
      </div>

      {/* Balances. */}
      <div className="rounded-2xl bg-card/30 p-4">
        <Skel className="h-4 w-24" />
        <Skel className="mt-2 h-2.5 w-40" />
        <Skel className="mt-4 h-1.5 w-full rounded-full" />
        <div className="mt-5 flex flex-col gap-4">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="flex items-center gap-3" style={{ opacity: 1 - index * 0.18 }}>
              <Skel className="h-8 w-8 shrink-0 rounded-full" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skel className="h-3 w-24" />
                <Skel className="h-2.5 w-16" />
              </div>
              <Skel className="h-3.5 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

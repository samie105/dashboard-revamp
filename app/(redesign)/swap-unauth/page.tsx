import type { Metadata } from "next"

import { Rise } from "@/components/ui/system"
import { SwapWorkspace } from "@/components/swap-unauth/workspace"

export const metadata: Metadata = {
  title: "Swap preview",
  description: "Redesigned WorldStreet swap, rendered from dummy data.",
  robots: { index: false, follow: false },
}

/**
 * Swap. The frame comes from app/(redesign)/layout.tsx; the top bar's Trade
 * menu links here. Every rate, route and swap is invented (swap-data.ts) and
 * nothing can be submitted.
 */
export default function SwapUnauthPage() {
  return (
    <div className="mx-auto flex w-full max-w-[1720px] flex-col gap-4 p-4 md:gap-5 md:p-6">
      <Rise>
        <div className="flex flex-col gap-1.5 px-1">
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.03em] text-foreground md:text-[32px]">Swap</h1>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/80">
              Demo data
            </span>
          </div>
          <p className="text-[14px] text-muted-foreground">Trade any token for any other, on the same chain or across chains — the route is shown step by step.</p>
        </div>
      </Rise>
      <SwapWorkspace />
    </div>
  )
}

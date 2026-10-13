"use client"

/**
 * Swap: the preview's page (app/(redesign)/swap-unauth) on the real swap.
 * Same heading and workspace, no "Demo data" tag. The old screen
 * (components/swap/swap-client.tsx, with its Simple/Pro switch) is kept,
 * unused; both run the same useSwapTicket.
 */

import type { CoinData } from "@/lib/actions"
import { DashScope } from "@/components/dash"
import { Rise } from "@/components/ui/system"
import { SwapWorkspace } from "@/components/swap/redesign/workspace"

export function SwapPage({ coins, prices, error }: { coins: CoinData[]; prices: Record<string, number>; error?: string }) {
  return (
    <DashScope className="ws-icon-mono [&_button:not(:disabled)]:cursor-pointer [&_[role=option]]:cursor-pointer mx-auto flex w-full max-w-[1720px] flex-col gap-4 p-4 md:gap-5 md:p-6">
      <Rise>
        <div className="flex flex-col gap-1.5 px-1">
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.03em] text-foreground md:text-[32px]">Swap</h1>
          <p className="text-[14px] text-muted-foreground">Trade any token for any other, on the same chain or across chains — the route is shown step by step.</p>
        </div>
      </Rise>
      <SwapWorkspace coins={coins} prices={prices} error={error} />
    </DashScope>
  )
}

/** The page's loading state, in the workspace's own grid. */
export function SwapPageSkeleton() {
  return (
    <DashScope className="mx-auto flex w-full max-w-[1720px] flex-col gap-4 p-4 md:gap-5 md:p-6">
      <div className="flex flex-col gap-2 px-1">
        <span className="skel h-8 w-28 rounded-lg" />
        <span className="skel h-4 w-80 max-w-full rounded" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
        <span className="skel h-[620px] rounded-[20px]" />
        <div className="flex flex-col gap-4 md:gap-5">
          <span className="skel h-[330px] rounded-[20px]" />
          <span className="skel h-[260px] rounded-[20px]" />
        </div>
      </div>
    </DashScope>
  )
}

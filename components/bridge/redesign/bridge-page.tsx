"use client"

/**
 * Bridge: the preview's page (app/(redesign)/bridge-unauth) on the real
 * bridge. Same heading and workspace; the "Demo data" tag is gone because
 * nothing here is invented. The old page (components/bridge/
 * intertrain-usdc-bridge-client.tsx, with bridge-history.tsx) is kept, unused.
 */

import { DashScope } from "@/components/dash"
import { Rise } from "@/components/ui/system"
import { BridgeWorkspace } from "@/components/bridge/redesign/workspace"

export function BridgePage() {
  return (
    <DashScope className="ws-icon-mono [&_button:not(:disabled)]:cursor-pointer mx-auto flex w-full max-w-[1720px] flex-col gap-4 p-4 md:gap-5 md:p-6">
      <Rise>
        <div className="flex flex-col gap-1.5 px-1">
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.03em] text-foreground md:text-[32px]">Bridge</h1>
          <p className="text-[14px] text-muted-foreground">Move USDC from Arbitrum One into Intertrain as WSK — see the lane, sign on this device, and track every stage.</p>
        </div>
      </Rise>
      <BridgeWorkspace />
    </DashScope>
  )
}

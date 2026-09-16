import type { Metadata } from "next"

import { Rise } from "@/components/ui/system"
import { PreviewNotice, SectionRule } from "@/components/preview/page-chrome"
import { SwapWorkspace } from "@/components/swap-unauth/workspace"
import { SwapHistory } from "@/components/swap-unauth/history"

export const metadata: Metadata = {
  title: "Swap preview",
  description: "Redesigned WorldStreet swap, rendered from dummy data.",
  robots: { index: false, follow: false },
}

export default function SwapUnauthPage() {
  return (
    <div className="flex flex-col gap-6 overflow-x-hidden p-4 md:p-6 lg:p-8">
      <PreviewNotice>
        Every rate, route and swap below is invented and frozen. Nothing here reaches a router or a bridge —
        no swap you build can be submitted. The page is open without signing in so the layout can be
        reviewed on its own.
      </PreviewNotice>

      <Rise>
        <SwapWorkspace />
      </Rise>

      <Rise delay={80}>
        <div className="flex flex-col gap-3">
          <SectionRule label="History" note="Newest first" />
          <SwapHistory />
        </div>
      </Rise>
    </div>
  )
}

import type { Metadata } from "next"

import { Rise } from "@/components/ui/system"
import { PreviewNotice, SectionRule } from "@/components/preview/page-chrome"
import { BridgeWorkspace } from "@/components/bridge-unauth/workspace"
import { InFlight, BridgeHistory } from "@/components/bridge-unauth/in-flight"

export const metadata: Metadata = {
  title: "Bridge preview",
  description: "Redesigned WorldStreet bridge, rendered from dummy data.",
  robots: { index: false, follow: false },
}

export default function BridgeUnauthPage() {
  return (
    <div className="flex flex-col gap-6 overflow-x-hidden p-4 md:p-6 lg:p-8">
      <PreviewNotice>
        Every route, quote and transfer below is invented and frozen. Nothing here reaches a bridge
        contract — no transfer you build can be submitted. The page is open without signing in so the
        layout can be reviewed on its own.
      </PreviewNotice>

      <Rise>
        <BridgeWorkspace />
      </Rise>

      <Rise delay={80}>
        <div className="flex flex-col gap-3">
          <SectionRule label="Moving now" note="Updates as each stage clears" />
          <InFlight />
        </div>
      </Rise>

      <Rise delay={140}>
        <div className="flex flex-col gap-3">
          <SectionRule label="History" note="Newest first" />
          <BridgeHistory />
        </div>
      </Rise>
    </div>
  )
}

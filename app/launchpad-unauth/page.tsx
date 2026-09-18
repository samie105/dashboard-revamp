import type { Metadata } from "next"

import { Rise } from "@/components/ui/system"
import { PreviewNotice, SectionRule } from "@/components/preview/page-chrome"
import { DiscoveryHero } from "@/components/launchpad-unauth/discovery-hero"
import { LaunchGrid } from "@/components/launchpad-unauth/launch-grid"
import { ManifestCard } from "@/components/launchpad-unauth/parts"
import { ResumeBanner } from "@/components/launchpad-unauth/launch-lifecycle"

export const metadata: Metadata = {
  title: "Launchpad preview",
  description: "WorldStreet token launchpad, rendered from dummy data.",
  // A demo surface has no business in search results.
  robots: { index: false, follow: false },
}

export default function LaunchpadUnauthPage() {
  return (
    // overflow-x-hidden for the same reason the other previews carry it: the
    // scrollable filter rail must not widen the document on a phone.
    <div className="flex flex-col gap-6 overflow-x-hidden p-4 md:p-6 lg:p-8">
      <PreviewNotice>
        Every launch, price and curve below is invented. Nothing here touches a
        chain or a curve program, and no token you design can be deployed. The
        page is open without signing in so the layout can be reviewed on its
        own.
      </PreviewNotice>

      {/* Renders nothing unless a launch is still in flight — the page you
          come back to is where a launch you walked away from should find you. */}
      <ResumeBanner />

      <Rise>
        <DiscoveryHero />
      </Rise>

      <Rise delay={60}>
        <div className="flex flex-col gap-3">
          <SectionRule
            label="Launches"
            note="Ranked by progress toward graduation"
          />
          <LaunchGrid />
        </div>
      </Rise>

      <Rise delay={120}>
        <ManifestCard page="discovery" />
      </Rise>
    </div>
  )
}

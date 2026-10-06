import type { Metadata } from "next"

import { Rise } from "@/components/ui/system"
import { DiscoveryHero, HowItWorks, LaunchBrowser, Spotlight } from "@/components/launchpad-unauth/discovery"
import { PausedNotice, PreviewControls, ResumeBanner } from "@/components/launchpad-unauth/ui"

export const metadata: Metadata = {
  title: "Launchpad preview",
  description: "WorldStreet token launchpad, rendered from dummy data.",
  robots: { index: false, follow: false },
}

/**
 * Launchpad discovery. The frame comes from app/(redesign)/layout.tsx. Every
 * launch is invented; the curve arithmetic is real (launch-data.ts). The hero
 * carries a "Demo data" tag, and the reviewer tools sit in Preview controls.
 */
export default function LaunchpadUnauthPage() {
  return (
    <div className="mx-auto flex w-full max-w-[1720px] flex-col gap-4 p-4 md:gap-5 md:p-6">
      {/* Each renders nothing unless it applies: a launch still in flight, or
          an operations pause. */}
      <ResumeBanner />
      <PausedNotice />
      <Rise>
        <DiscoveryHero />
      </Rise>
      <Rise delay={60}>
        <Spotlight />
      </Rise>
      <Rise delay={120}>
        <LaunchBrowser />
      </Rise>
      <Rise delay={160}>
        <HowItWorks />
      </Rise>
      <PreviewControls page="discovery" />
    </div>
  )
}

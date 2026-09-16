import type { Metadata } from "next"

import { Rise } from "@/components/ui/system"
import { PreviewNotice, SectionRule } from "@/components/preview/page-chrome"
import { Hero } from "@/components/dashboard-unauth/hero"
import { Insights } from "@/components/dashboard-unauth/insights"
import { Markets } from "@/components/dashboard-unauth/markets"
import { Desk } from "@/components/dashboard-unauth/desk"

export const metadata: Metadata = {
  title: "Dashboard preview",
  description: "Redesigned WorldStreet dashboard, rendered from dummy data.",
  // A demo surface has no business in search results.
  robots: { index: false, follow: false },
}

export default function DashboardUnauthPage() {
  return (
    // overflow-x-hidden for the same reason the live dashboard carries it: the
    // full-bleed rails inside must not widen the document on a phone.
    <div className="flex flex-col gap-6 overflow-x-hidden p-4 md:p-6 lg:p-8">
      <PreviewNotice>
        Every balance, position and price below is dummy data. Nothing here reads a wallet, an account or
        the live market — the page is open without signing in so the layout can be reviewed on its own.
      </PreviewNotice>

      <Rise>
        <Hero />
      </Rise>

      <Rise delay={60}>
        <div className="flex flex-col gap-3">
          <SectionRule label="Insights" />
          <Insights />
        </div>
      </Rise>

      <Rise delay={120}>
        <div className="flex flex-col gap-3">
          <SectionRule label="Markets" note="Updated moments ago" />
          <Markets />
        </div>
      </Rise>

      <Rise delay={180}>
        <div className="flex flex-col gap-3">
          <SectionRule label="Desk" />
          <Desk />
        </div>
      </Rise>
    </div>
  )
}

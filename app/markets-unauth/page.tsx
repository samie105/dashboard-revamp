import type { Metadata } from "next"

import { Rise } from "@/components/ui/system"
import { PreviewNotice, SectionRule } from "@/components/preview/page-chrome"
import { Ticker, MarketStats } from "@/components/markets-unauth/ticker"
import { Movers } from "@/components/markets-unauth/movers"
import { MarketTable } from "@/components/markets-unauth/market-table"

export const metadata: Metadata = {
  title: "Markets preview",
  description: "Redesigned WorldStreet markets page, rendered from dummy data.",
  robots: { index: false, follow: false },
}

export default function MarketsUnauthPage() {
  return (
    <div className="flex flex-col gap-6 overflow-x-hidden p-4 md:p-6 lg:p-8">
      <PreviewNotice>
        Every price, chart and volume below is invented and frozen. Nothing here reads a live feed — the
        page is open without signing in so the layout can be reviewed on its own.
      </PreviewNotice>

      <Rise>
        <div className="flex flex-col gap-3">
          <Ticker />
          <MarketStats />
        </div>
      </Rise>

      <Rise delay={60}>
        <div className="flex flex-col gap-3">
          <SectionRule label="Top movers" note="Last 7 days" />
          <Movers />
        </div>
      </Rise>

      <Rise delay={120}>
        <div className="flex flex-col gap-3">
          <SectionRule label="Markets" note="Tap any row to trade" />
          <MarketTable />
        </div>
      </Rise>
    </div>
  )
}

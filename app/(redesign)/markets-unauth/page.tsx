import type { Metadata } from "next"

import { Rise } from "@/components/ui/system"
import { MarketStats, MarketsHeading, Tape } from "@/components/markets-unauth/overview"
import { Movers } from "@/components/markets-unauth/movers"
import { MarketTable } from "@/components/markets-unauth/market-table"

export const metadata: Metadata = {
  title: "Markets preview",
  description: "Redesigned WorldStreet markets page, rendered from dummy data.",
  robots: { index: false, follow: false },
}

/**
 * The frame (top bar, rail, fonts) comes from app/(redesign)/layout.tsx and
 * stays mounted when you arrive here from the dashboard. Every price, chart
 * and volume is invented (components/markets-unauth/market-data.ts); the
 * heading carries a "Demo data" tag.
 */
export default function MarketsUnauthPage() {
  return (
    <div className="mx-auto flex w-full max-w-[1720px] flex-col gap-4 p-4 md:gap-5 md:p-6">
      <Rise>
        <MarketsHeading />
      </Rise>
      <Rise delay={40}>
        <Tape />
      </Rise>
      <Rise delay={80}>
        <MarketStats />
      </Rise>
      <Rise delay={140}>
        <Movers />
      </Rise>
      <Rise delay={200}>
        <MarketTable />
      </Rise>
    </div>
  )
}

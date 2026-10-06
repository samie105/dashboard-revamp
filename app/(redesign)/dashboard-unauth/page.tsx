import type { Metadata } from "next"

import { Rise } from "@/components/ui/system"
import { Welcome } from "@/components/dashboard-unauth/welcome"
import { Portfolio } from "@/components/dashboard-unauth/portfolio"
import { Balances } from "@/components/dashboard-unauth/balances"
import { AssetsPanel } from "@/components/dashboard-unauth/assets-panel"
import {
  MarketMood,
  PromoCarousel,
  QuickActions,
  TopMovers,
} from "@/components/dashboard-unauth/side-column"

export const metadata: Metadata = {
  title: "Dashboard preview",
  description: "Redesigned WorldStreet dashboard, rendered from dummy data.",
  // A demo surface has no business in search results.
  robots: { index: false, follow: false },
}

/**
 * The frame (top bar, rail, fonts) comes from app/(redesign)/layout.tsx.
 * Every figure here is invented (components/dashboard-unauth/demo-data.ts);
 * the greeting carries a "Demo data" tag so nobody reads a stranger's
 * portfolio into it.
 */
export default function DashboardUnauthPage() {
  return (
    <div className="mx-auto grid w-full max-w-[1720px] grid-cols-1 gap-4 p-4 md:gap-5 md:p-6 2xl:grid-cols-[minmax(0,1fr)_392px]">
      <div className="flex min-w-0 flex-col gap-4 md:gap-5">
        <Rise>
          <Welcome />
        </Rise>
        <Rise delay={60}>
          <Portfolio />
        </Rise>
        {/* On a phone the actions sit right under the balance they act
                  on, not five screens down where the side column lands. */}
        <Rise delay={90} className="md:hidden">
          <QuickActions />
        </Rise>
        <Rise delay={120}>
          <Balances />
        </Rise>
        <Rise delay={180}>
          <AssetsPanel />
        </Rise>
      </div>

      <aside className="grid min-w-0 grid-cols-1 content-start gap-4 md:grid-cols-2 md:gap-5 2xl:grid-cols-1">
        <Rise delay={80} className="hidden md:block">
          <QuickActions />
        </Rise>
        <Rise delay={140}>
          <PromoCarousel />
        </Rise>
        {/* Dropped below the main column (under 1536px), the movers list
                  takes the right half on its own so the shorter cards stack
                  beside it instead of leaving a ragged gap. */}
        <Rise
          delay={200}
          className="md:col-start-2 md:row-span-3 md:row-start-1 2xl:col-start-auto 2xl:row-span-1 2xl:row-start-auto"
        >
          <TopMovers />
        </Rise>
        <Rise delay={260}>
          <MarketMood />
        </Rise>
      </aside>
    </div>
  )
}

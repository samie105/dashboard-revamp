"use client"

/**
 * The dashboard: the preview's page (app/(redesign)/dashboard-unauth/page.tsx)
 * with its grid, columns and Rise choreography unchanged, on real data.
 * Blocks the preview doesn't have (markets, watchlist, recent trades) follow
 * below, in the same visual language.
 */

import * as React from "react"

import { DashScope } from "@/components/dash"
import { Rise } from "@/components/ui/system"
import { DashboardDataProvider } from "@/components/dashboard/redesign/data"
import { Welcome } from "@/components/dashboard/redesign/welcome"
import { Portfolio } from "@/components/dashboard/redesign/portfolio"
import { Balances } from "@/components/dashboard/redesign/balances"
import { AssetsPanel } from "@/components/dashboard/redesign/assets-panel"
import { MarketMood, PromoCarousel, QuickActions, TopMovers } from "@/components/dashboard/redesign/side-column"
import { DashboardGrid } from "@/components/dashboard/bento-grid"
import type { CoinData } from "@/lib/actions"

/** md and up (768px): where the preview moves quick actions into the side column. */
function useMdUp() {
  const [mdUp, setMdUp] = React.useState(false)
  React.useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)")
    const sync = () => setMdUp(query.matches)
    sync()
    query.addEventListener("change", sync)
    return () => query.removeEventListener("change", sync)
  }, [])
  return mdUp
}

export function Dashboard({ coins, prices, error }: { coins: CoinData[]; prices: Record<string, number>; error?: string }) {
  /* The preview mounts QuickActions twice and hides one with CSS. Here it owns
     the Deposit/Send dialogs and Vivid targets, so only the visible slot
     renders: same places, same look, one copy. */
  const mdUp = useMdUp()
  return (
    <DashboardDataProvider coins={coins} prices={prices} error={error}>
      <DashScope className="ws-icon-mono mx-auto flex w-full max-w-[1720px] flex-col gap-4 md:gap-5">
        <div className="grid w-full grid-cols-1 gap-4 md:gap-5 2xl:grid-cols-[minmax(0,1fr)_392px]">
          <div className="flex min-w-0 flex-col gap-4 md:gap-5">
            <Rise>
              <Welcome />
            </Rise>
            <Rise delay={60}>
              <Portfolio />
            </Rise>
            {/* On a phone the actions sit right under the balance they act
                on, not five screens down where the side column lands. */}
            {!mdUp && (
              <Rise delay={90} className="md:hidden">
                <QuickActions />
              </Rise>
            )}
            <Rise delay={120}>
              <Balances />
            </Rise>
            <Rise delay={180}>
              <AssetsPanel />
            </Rise>
          </div>

          <aside className="grid min-w-0 grid-cols-1 content-start gap-4 md:grid-cols-2 md:gap-5 2xl:grid-cols-1">
            {mdUp && (
              <Rise delay={80} className="hidden md:block">
                <QuickActions />
              </Rise>
            )}
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

        <DashboardGrid />
      </DashScope>
    </DashboardDataProvider>
  )
}

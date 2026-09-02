import { Suspense } from "react"
import { WalletCard } from "@/components/dashboard/user-card"
import { DashboardGrid } from "@/components/dashboard/bento-grid"
import { WalletCardSkeleton, DashboardGridSkeleton } from "@/components/dashboard/skeletons"
import { DashboardOnboarding } from "@/components/dashboard/dashboard-onboarding"
// TEMPORARILY OFF — the house-token work is still in progress (2026-09-02).
// The banner's only action scrolls to #worldstreet-token-card and flashes it
// (mna-banner.tsx), so it cannot ship while that card is off: the CTA would
// look live and silently do nothing. Restore this import and the <MnaBanner />
// below together with the card in bento-grid.tsx.
// import { MnaBanner } from "@/components/dashboard/mna-banner"
import { Rise } from "@/components/ui/system"
import { PromoRow } from "@/components/ui/promo-row"
import { getPrices } from "@/lib/actions"

async function WalletCardLoader() {
  const pricesData = await getPrices()
  return (
    <WalletCard
      coins={pricesData.coins}
      prices={pricesData.prices}
      error={pricesData.error || (pricesData.coins.length === 0 ? "No market data available" : undefined)}
    />
  )
}

async function DashboardGridLoader() {
  // The dashboard no longer previews a public trade tape — Recent Trades
  // shows the user's OWN fills from the ledger — so nothing here needs it.
  const pricesData = await getPrices()
  return (
    <DashboardGrid
      coins={pricesData.coins}
      prices={pricesData.prices}
      error={pricesData.error || (pricesData.coins.length === 0 ? "No market data available" : undefined)}
    />
  )
}

export default function Page() {
  return (
    // overflow-x-hidden clips the hero's full-bleed negative margins; without
    // it the -mx-4 bleed widens the document by 32px on a phone.
    <div className="flex flex-col gap-6 overflow-x-hidden p-4 md:p-6 lg:p-8">
      {/* House-token strip — the one marketing surface above the balance
          hero (it renders nothing once dismissed).
          TEMPORARILY OFF: see the commented import above. */}
      {/* <MnaBanner /> */}

      <Rise>
        <Suspense fallback={<WalletCardSkeleton />}>
          <WalletCardLoader />
        </Suspense>
      </Rise>
      {/* Paired grid — activity+holdings, markets+watchlist, trades+swap.
          Marketing goes last. */}
      <Rise delay={60}>
        <Suspense fallback={<DashboardGridSkeleton />}>
          <DashboardGridLoader />
        </Suspense>
      </Rise>
      <Rise delay={120}>
        <PromoRow />
      </Rise>
      <DashboardOnboarding />
    </div>
  )
}

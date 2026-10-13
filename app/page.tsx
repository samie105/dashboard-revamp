import { Suspense } from "react"
import { Dashboard } from "@/components/dashboard/redesign/dashboard"
import { WalletCardSkeleton, DashboardGridSkeleton } from "@/components/dashboard/skeletons"
import { DashboardOnboarding } from "@/components/dashboard/dashboard-onboarding"
// TEMPORARILY OFF — the house-token work is still in progress (2026-09-02).
// The banner's only action scrolls to #worldstreet-token-card and flashes it
// (mna-banner.tsx), so it cannot ship while that card is off: the CTA would
// look live and silently do nothing. Restore this import and the <MnaBanner />
// below together with the card in bento-grid.tsx.
// import { MnaBanner } from "@/components/dashboard/mna-banner"
import { WelcomeGuide } from "@/components/welcome-guide"
// getTrades went with the public trade tape: Recent Trades reads the user's
// own fills from the ledger now, so the page has nothing to prefetch for it.
import { getPrices } from "@/lib/actions"

/* One loader for the redesigned page (it is one composition). getPrices is
   cached server-side, so this is the same upstream traffic the two loaders
   (hero + grid) made. */
async function DashboardLoader() {
  const pricesData = await getPrices()
  return (
    <Dashboard
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
    <div className="flex flex-col gap-6 overflow-x-hidden p-4 md:p-6">
      {/* House-token strip — the one marketing surface above the balance
          hero (it renders nothing once dismissed).
          TEMPORARILY OFF: see the commented import above. */}
      {/* <MnaBanner /> */}

      <Suspense
        fallback={
          <div className="flex flex-col gap-6">
            <WalletCardSkeleton />
            <DashboardGridSkeleton />
          </div>
        }
      >
        <DashboardLoader />
      </Suspense>
      {/* The app introducing itself, once, to whoever just arrived. It is
          mounted HERE, on the page people land on, rather than only on the
          wallet: an intro nobody reaches is an intro that does not exist,
          and this is where the promo rail it absorbed used to sit. It
          renders a portal, so its position in this tree is arbitrary. */}
      <WelcomeGuide />
      <DashboardOnboarding />
    </div>
  )
}

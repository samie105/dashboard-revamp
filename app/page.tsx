import { Suspense } from "react"
import { WalletCard } from "@/components/dashboard/user-card"
import { DashboardGrid } from "@/components/dashboard/bento-grid"
import { WalletCardSkeleton, DashboardGridSkeleton } from "@/components/dashboard/skeletons"
import { DashboardOnboarding } from "@/components/dashboard/dashboard-onboarding"
import { MnaBanner } from "@/components/dashboard/mna-banner"
import { MigrationNotice } from "@/components/crypto/MigrationNotice"
import { Rise } from "@/components/ui/system"
import { PromoRow } from "@/components/ui/promo-row"
import { getPrices, getTrades } from "@/lib/actions"

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
  const [pricesData, btcTrades] = await Promise.all([
    getPrices(),
    getTrades("BTCUSDT", 8),
  ])
  return (
    <DashboardGrid
      coins={pricesData.coins}
      prices={pricesData.prices}
      initialTrades={btcTrades.data}
      error={pricesData.error || (pricesData.coins.length === 0 ? "No market data available" : undefined)}
    />
  )
}

export default function Page() {
  return (
    // overflow-x-hidden clips the hero's full-bleed negative margins; without
    // it the -mx-4 bleed widens the document by 32px on a phone.
    <div className="flex flex-col gap-6 overflow-x-hidden p-4 md:p-6 lg:p-8">
      {/* Spec §2 — legacy-wallet migration nudge. First thing above the
          fold, ahead of marketing; renders nothing for modern-only users,
          unclassifiable lookups, or once dismissed/confirmed. */}
      <MigrationNotice variant="banner" />
      {/* House-token strip — the one marketing surface above the balance
          hero (it renders nothing once dismissed). */}
      <MnaBanner />

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

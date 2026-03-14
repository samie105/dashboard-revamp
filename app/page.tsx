import { Suspense } from "react"
import { WalletCard } from "@/components/dashboard/user-card"
import { DashboardGrid } from "@/components/dashboard/bento-grid"
import { WalletCardSkeleton, DashboardGridSkeleton } from "@/components/dashboard/skeletons"
import { DashboardOnboarding } from "@/components/dashboard/dashboard-onboarding"
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
  const [pricesData, btcTrades, ethTrades, solTrades] = await Promise.all([
    getPrices(),
    getTrades("BTCUSDT", 8),
    getTrades("ETHUSDT", 8),
    getTrades("SOLUSDT", 8),
  ])
  return (
    <DashboardGrid
      coins={pricesData.coins}
      prices={pricesData.prices}
      tradesByPair={{
        BTC: btcTrades.data,
        ETH: ethTrades.data,
        SOL: solTrades.data,
      }}
      error={pricesData.error || (pricesData.coins.length === 0 ? "No market data available" : undefined)}
    />
  )
}

export default function Page() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
      <Suspense fallback={<WalletCardSkeleton />}>
        <WalletCardLoader />
      </Suspense>
      <Suspense fallback={<DashboardGridSkeleton />}>
        <DashboardGridLoader />
      </Suspense>
      <DashboardOnboarding />
    </div>
  )
}

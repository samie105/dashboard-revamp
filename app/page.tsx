import { Suspense } from "react"
import { WalletCard } from "@/components/dashboard/user-card"
import { DashboardGrid } from "@/components/dashboard/bento-grid"
import { WalletCardSkeleton, DashboardGridSkeleton } from "@/components/dashboard/skeletons"
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
  const [pricesData, tradesData] = await Promise.all([
    getPrices(),
    getTrades("BTCUSDT", 10),
  ])
  return (
    <DashboardGrid
      coins={pricesData.coins}
      trades={tradesData.data}
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
    </div>
  )
}

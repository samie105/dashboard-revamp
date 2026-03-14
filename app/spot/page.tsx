import { Suspense } from "react"
import { getPrices, getTrades, getOrderBook } from "@/lib/actions"
import { SpotClient } from "@/components/spot/spot-client"
import { Skeleton } from "@/components/ui/skeleton"
import {
  SpotChartSkeleton,
  SpotOrderBookSkeleton,
  SpotOrderFormSkeleton,
} from "@/components/dashboard/skeletons"

async function SpotLoader() {
  const [pricesData, btcTrades, ethTrades, solTrades, btcOrderBook] =
    await Promise.all([
      getPrices(),
      getTrades("BTCUSDT"),
      getTrades("ETHUSDT"),
      getTrades("SOLUSDT"),
      getOrderBook("BTCUSDT", 20),
    ])

  return (
    <SpotClient
      coins={pricesData.coins}
      prices={pricesData.prices}
      globalStats={pricesData.globalStats}
      initialTrades={{
        BTCUSDT: btcTrades.success ? btcTrades.data : [],
        ETHUSDT: ethTrades.success ? ethTrades.data : [],
        SOLUSDT: solTrades.success ? solTrades.data : [],
      }}
      initialOrderBook={
        btcOrderBook.success
          ? { asks: btcOrderBook.asks, bids: btcOrderBook.bids }
          : undefined
      }
      error={pricesData.error || (pricesData.coins.length === 0 ? "No market data available" : undefined)}
    />
  )
}

function SpotPageSkeleton() {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Top bar skeleton */}
      <div className="flex items-center justify-between border-b border-border/10 px-3 py-2">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-md" />
          <Skeleton className="h-5 w-16 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-20 rounded-full" />
          <Skeleton className="h-7 w-7 rounded-full" />
          <Skeleton className="h-7 w-7 rounded-full" />
          <Skeleton className="h-7 w-7 rounded-full" />
        </div>
      </div>

      {/* Desktop: 3-column grid */}
      <div className="hidden lg:grid flex-1 overflow-hidden grid-cols-[220px_1fr_280px] gap-1 p-1">
        {/* Left — market select */}
        <Skeleton className="rounded-xl" />
        {/* Center — chart + buy/sell */}
        <div className="flex flex-col gap-1">
          <Skeleton className="flex-1 rounded-xl" />
          <div className="grid grid-cols-2 gap-1">
            <SpotOrderFormSkeleton />
            <SpotOrderFormSkeleton />
          </div>
          <Skeleton className="h-24 rounded-xl" />
        </div>
        {/* Right — orderbook */}
        <SpotOrderBookSkeleton />
      </div>

      {/* Mobile skeleton */}
      <div className="flex flex-col gap-2 p-2 lg:hidden">
        <Skeleton className="h-10 rounded-xl" />
        <SpotChartSkeleton />
        <div className="grid grid-cols-2 gap-2">
          <SpotOrderFormSkeleton />
          <SpotOrderFormSkeleton />
        </div>
      </div>
    </div>
  )
}

export default function SpotPage() {
  return (
    <div className="flex flex-col gap-0 p-1">
      <Suspense fallback={<SpotPageSkeleton />}>
        <SpotLoader />
      </Suspense>
    </div>
  )
}

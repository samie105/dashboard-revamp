import { Suspense } from "react"
import { getFuturesMarkets, getPrices, getOrderBook } from "@/lib/actions"
import { FuturesClient } from "@/components/futures/futures-client"

async function FuturesLoader() {
  const [marketsData, pricesData, btcOrderBook] = await Promise.all([
    getFuturesMarkets(),
    getPrices(),
    getOrderBook("BTCUSDT", 20),
  ])

  return (
    <FuturesClient
      markets={marketsData.markets}
      prices={pricesData.prices}
      initialOrderBook={
        btcOrderBook.success
          ? { asks: btcOrderBook.asks, bids: btcOrderBook.bids }
          : undefined
      }
      error={marketsData.error || (!marketsData.success ? "Failed to load futures markets" : undefined)}
    />
  )
}

function FuturesSkeleton() {
  return (
    <div className="flex h-screen flex-col overflow-hidden animate-pulse">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-border/10 px-3 py-2">
        <div className="h-4 w-4 rounded bg-accent/30" />
        <div className="h-5 w-24 rounded bg-accent/40" />
        <div className="h-4 w-14 rounded bg-accent/30" />
        <div className="h-6 w-28 rounded bg-accent/30 ml-2" />
        <div className="ml-auto hidden sm:flex items-center gap-4">
          <div className="h-3 w-16 rounded bg-accent/20" />
          <div className="h-3 w-16 rounded bg-accent/20" />
          <div className="h-3 w-16 rounded bg-accent/20" />
        </div>
      </div>
      {/* Desktop 3-col + bottom positions */}
      <div className="hidden lg:flex flex-1 flex-col p-1 gap-1 overflow-hidden">
        <div className="flex-1 min-h-0 flex gap-1">
          <div className="w-[15%] rounded-xl bg-accent/20" />
          <div className="flex-1 flex flex-col gap-1">
            <div className="flex-[7] rounded-xl bg-accent/20" />
            <div className="flex-[3] rounded-xl bg-accent/20" />
          </div>
          <div className="w-[25%] rounded-xl bg-accent/20" />
        </div>
        <div className="h-[120px] rounded-xl bg-accent/20 shrink-0" />
      </div>
      {/* Mobile */}
      <div className="flex flex-1 flex-col gap-2 px-2 pt-2 pb-4 lg:hidden">
        <div className="h-10 rounded-xl bg-accent/20" />
        <div className="h-[360px] rounded-xl bg-accent/20" />
        <div className="h-48 rounded-xl bg-accent/20" />
      </div>
    </div>
  )
}

export default function FuturesPage() {
  return (
    <Suspense fallback={<FuturesSkeleton />}>
      <FuturesLoader />
    </Suspense>
  )
}

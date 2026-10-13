import { Suspense } from "react"
import { getPrices } from "@/lib/actions"
import { SwapPage, SwapPageSkeleton } from "@/components/swap/redesign/swap-page"

async function SwapLoader() {
  const pricesData = await getPrices()
  return <SwapPage coins={pricesData.coins} prices={pricesData.prices} error={pricesData.error || (pricesData.coins.length === 0 ? "No market data available" : undefined)} />
}

export default function SwapRoute() {
  return (
    <Suspense fallback={<SwapPageSkeleton />}>
      <SwapLoader />
    </Suspense>
  )
}

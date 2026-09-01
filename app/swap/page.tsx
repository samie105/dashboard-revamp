import { Suspense } from "react"
import { ModernSwapClient } from "@/components/swap/modern-swap-client"
import { SwapCardSkeleton, SwapHistorySkeleton, SwapTimelineSkeleton } from "@/components/dashboard/skeletons"

async function SwapLoader() {
  return <ModernSwapClient />
}

function SwapPageSkeleton() {
  return (
    <>
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-col gap-1">
          <div className="h-6 w-16 animate-pulse rounded bg-muted" />
          <div className="h-3 w-48 animate-pulse rounded bg-muted" />
        </div>
      </div>
      {/* Grid skeleton */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px]">
        <SwapCardSkeleton />
        <div className="flex flex-col gap-4">
          <SwapHistorySkeleton />
          <SwapTimelineSkeleton />
        </div>
      </div>
    </>
  )
}

export default function SwapPage() {
  return (
    <div className="flex flex-col gap-4 p-4 md:p-5 lg:p-6">
      <Suspense fallback={<SwapPageSkeleton />}>
        <SwapLoader />
      </Suspense>
    </div>
  )
}

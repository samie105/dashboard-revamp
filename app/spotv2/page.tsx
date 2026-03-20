import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { SpotV2Client } from "@/components/spotv2/spotv2-client"
import { fetchSpotV2Pairs } from "@/lib/spotv2/pairs"

async function SpotV2Loader() {
  const pairs = await fetchSpotV2Pairs()
  return <SpotV2Client initialPairs={pairs} />
}

function SpotV2Skeleton() {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Top bar skeleton */}
      <div className="flex items-center justify-between border-b border-border/10 px-3 py-2">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-md" />
          <Skeleton className="h-5 w-16 rounded-md" />
        </div>
      </div>

      {/* Desktop: 3-column grid */}
      <div className="hidden flex-1 overflow-hidden lg:grid lg:grid-cols-[220px_1fr_280px] gap-1 p-1">
        {/* Left — pair sidebar */}
        <div className="flex flex-col gap-2 p-2">
          <Skeleton className="h-8 w-full rounded-md" />
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-md" />
          ))}
        </div>
        {/* Center — chart + panels */}
        <div className="flex flex-col gap-1">
          <Skeleton className="flex-3 rounded-xl" />
          <Skeleton className="flex-1 rounded-xl" />
          <Skeleton className="flex-1 rounded-xl" />
        </div>
        {/* Right — order book + form */}
        <div className="flex flex-col gap-1">
          <Skeleton className="flex-1 rounded-xl" />
          <Skeleton className="flex-1 rounded-xl" />
        </div>
      </div>

      {/* Mobile skeleton */}
      <div className="flex flex-col gap-2 p-2 lg:hidden">
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-[300px] rounded-xl" />
        <Skeleton className="h-[200px] rounded-xl" />
      </div>
    </div>
  )
}

export default function SpotV2Page() {
  return (
    <Suspense fallback={<SpotV2Skeleton />}>
      <SpotV2Loader />
    </Suspense>
  )
}

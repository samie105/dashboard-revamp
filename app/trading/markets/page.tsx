import { Suspense } from "react"
import { getPrices } from "@/lib/actions"
import { MarketsClient } from "@/components/trading/markets-client"

async function MarketsLoader() {
  const data = await getPrices()
  return (
    <MarketsClient
      coins={data.coins}
      globalStats={data.globalStats}
      error={data.error || (data.coins.length === 0 ? "No market data available" : undefined)}
    />
  )
}

function MarketsPageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="h-8 w-36 animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-64 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
      <div className="h-32 animate-pulse rounded-2xl bg-muted" />
      <div className="h-32 animate-pulse rounded-2xl bg-muted" />
      <div className="h-96 animate-pulse rounded-2xl bg-muted" />
    </div>
  )
}

export default function MarketsPage() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
      <Suspense fallback={<MarketsPageSkeleton />}>
        <MarketsLoader />
      </Suspense>
    </div>
  )
}

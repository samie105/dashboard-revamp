import { Suspense } from "react"
import { getForexRates } from "@/lib/actions"
import { ForexClient } from "@/components/trading/forex-client"

async function ForexLoader() {
  const data = await getForexRates()
  return (
    <ForexClient
      initialPairs={data.pairs}
      error={data.error || (data.pairs.length === 0 ? "No forex data available" : undefined)}
    />
  )
}

function ForexPageSkeleton() {
  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col gap-1 overflow-hidden">
      <div className="h-10 animate-pulse rounded-lg bg-muted" />
      <div className="grid flex-1 grid-cols-[220px_1fr_260px] gap-1 overflow-hidden">
        <div className="animate-pulse rounded-xl bg-muted" />
        <div className="flex flex-col gap-1">
          <div className="flex-1 animate-pulse rounded-xl bg-muted" />
          <div className="h-48 animate-pulse rounded-xl bg-muted" />
        </div>
        <div className="animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  )
}

export default function ForexPage() {
  return (
    <Suspense fallback={<ForexPageSkeleton />}>
      <ForexLoader />
    </Suspense>
  )
}

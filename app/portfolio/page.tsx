import { Suspense } from "react"
import { PortfolioClient } from "@/components/portfolio/portfolio-client"
import { getPrices } from "@/lib/actions"

async function PortfolioLoader() {
  const data = await getPrices()
  return (
    <PortfolioClient
      coins={data.coins}
      prices={data.prices}
      globalStats={data.globalStats}
    />
  )
}

function PortfolioSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-col gap-1">
          <div className="h-6 w-32 rounded-lg bg-muted" />
          <div className="h-3 w-56 rounded bg-muted" />
        </div>
        <div className="h-7 w-20 rounded-lg bg-muted" />
      </div>
      {/* Grid: main + sidebar */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border border-border/40 bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
            <div className="h-4 w-20 rounded bg-muted" />
            <div className="h-6 w-44 rounded-lg bg-muted" />
          </div>
          <div className="p-4 space-y-4">
            <div className="h-28 rounded-xl bg-muted" />
            <div className="h-48 rounded-xl bg-muted" />
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="h-28 rounded-2xl bg-muted" />
          <div className="h-80 rounded-2xl bg-muted" />
          <div className="h-44 rounded-2xl bg-muted" />
        </div>
      </div>
    </div>
  )
}

export default function PortfolioPage() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
      <Suspense fallback={<PortfolioSkeleton />}>
        <PortfolioLoader />
      </Suspense>
    </div>
  )
}

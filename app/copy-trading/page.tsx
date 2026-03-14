import { Suspense } from "react"
import { getPrices } from "@/lib/actions"
import { CopyTradingClient } from "@/components/copy-trading/copy-trading-client"

async function CopyTradingLoader() {
  const pricesData = await getPrices()
  return (
    <CopyTradingClient
      coins={pricesData.coins}
      error={pricesData.error || (pricesData.coins.length === 0 ? "No market data available" : undefined)}
    />
  )
}

function CopyTradingSkeleton() {
  return (
    <>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="h-6 w-32 animate-pulse rounded bg-muted" />
          <div className="h-3 w-56 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-8 w-64 animate-pulse rounded-xl bg-muted" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card px-4 py-3 shadow-sm">
            <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
            <div className="flex flex-col gap-1">
              <div className="h-2.5 w-14 animate-pulse rounded bg-muted" />
              <div className="h-4 w-10 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          {/* Tab skeleton */}
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-7 w-24 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
          {/* Card grid skeleton */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border/40 bg-card shadow-sm">
                <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                  <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
                  <div className="flex flex-col gap-1.5">
                    <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-32 animate-pulse rounded bg-muted" />
                  </div>
                </div>
                <div className="grid grid-cols-3 divide-x divide-border/30 border-t border-border/30">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} className="flex flex-col items-center gap-1 py-3">
                      <div className="h-2 w-8 animate-pulse rounded bg-muted" />
                      <div className="h-4 w-12 animate-pulse rounded bg-muted" />
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-border/30 px-4 py-3">
                  <div className="flex gap-1">
                    <div className="h-4 w-10 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-10 animate-pulse rounded bg-muted" />
                  </div>
                  <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Right sidebar skeleton */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border/40 bg-card shadow-sm p-4">
            <div className="h-4 w-40 animate-pulse rounded bg-muted mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="h-6 w-6 animate-pulse rounded-full bg-muted" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                    <div className="h-2.5 w-full animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default function CopyTradingPage() {
  return (
    <div className="flex flex-col gap-4 p-4 md:p-5 lg:p-6">
      <Suspense fallback={<CopyTradingSkeleton />}>
        <CopyTradingLoader />
      </Suspense>
    </div>
  )
}

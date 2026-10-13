import { Suspense } from "react"
import { getPrices } from "@/lib/actions"
import { MarketsPage as MarketsView } from "@/components/markets/redesign/markets-page"

async function MarketsLoader() {
  const data = await getPrices()
  return (
    <MarketsView
      coins={data.coins}
      globalStats={data.globalStats}
      error={data.error || (data.coins.length === 0 ? "No market data available" : undefined)}
    />
  )
}

/** Same footprint as the page: heading, tape, five stat cards, movers, table. */
function MarketsPageSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[1720px] flex-col gap-4 md:gap-5" aria-hidden>
      <div className="flex flex-col gap-2 px-1">
        <span className="skel h-8 w-40 rounded" />
        <span className="skel h-4 w-72 max-w-full rounded" />
      </div>
      <span className="skel h-[52px] rounded-[20px]" />
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-6 2xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className={`skel h-[132px] rounded-[20px] ${i === 0 ? "col-span-2 lg:col-span-3 2xl:col-span-1" : i === 1 ? "lg:col-span-3 2xl:col-span-1" : "lg:col-span-2 2xl:col-span-1"}`} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <span key={i} className="skel h-[420px] rounded-[20px]" />
        ))}
      </div>
      <span className="skel h-[520px] rounded-[20px]" />
    </div>
  )
}

export default function MarketsRoute() {
  return (
    <div className="flex flex-col gap-6 overflow-x-clip p-4 md:p-6">
      <Suspense fallback={<MarketsPageSkeleton />}>
        <MarketsLoader />
      </Suspense>
    </div>
  )
}

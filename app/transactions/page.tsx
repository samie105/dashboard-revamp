import { Suspense } from "react"
import { TransactionsPage as TransactionsView } from "@/components/transactions/redesign/transactions-page"

/** Same footprint as the page: heading, four summary cards, the history panel. */
function TransactionsSkeleton() {
  return (
    <div className="flex flex-col gap-6 overflow-x-clip p-4 md:p-6">
      <div className="mx-auto flex w-full max-w-[1720px] flex-col gap-4 md:gap-5" aria-hidden>
        <div className="flex flex-col gap-2 px-1">
          <span className="skel h-8 w-48 rounded" />
          <span className="skel h-4 w-80 max-w-full rounded" />
        </div>
        <div className="grid grid-cols-2 gap-3 md:gap-4 2xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <span key={i} className={`skel h-[132px] rounded-[20px] ${i === 0 ? "col-span-2 lg:col-span-1" : ""}`} />
          ))}
        </div>
        <span className="skel h-[420px] rounded-[20px]" />
      </div>
    </div>
  )
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<TransactionsSkeleton />}>
      <div className="flex flex-col gap-6 overflow-x-clip p-4 md:p-6">
        <TransactionsView />
      </div>
    </Suspense>
  )
}

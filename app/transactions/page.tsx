import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { TransactionsClient } from "@/components/transactions/transactions-client"

function TransactionsSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 pt-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-3.5 w-64" />
        </div>
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
      {/* Table skeleton */}
      <Skeleton className="h-105 rounded-2xl" />
    </div>
  )
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<TransactionsSkeleton />}>
      <TransactionsClient />
    </Suspense>
  )
}

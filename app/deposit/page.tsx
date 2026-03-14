import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { DepositClient } from "@/components/deposit/deposit-client"

function DepositSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 pt-6">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-4 w-64" />
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-2xl" />
      </div>
    </div>
  )
}

export default function DepositPage() {
  return (
    <Suspense fallback={<DepositSkeleton />}>
      <DepositClient />
    </Suspense>
  )
}

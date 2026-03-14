import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { WithdrawClient } from "@/components/withdraw/withdraw-client"

function WithdrawSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 pt-6">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-4 w-64" />
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-2xl" />
      </div>
    </div>
  )
}

export default function WithdrawPage() {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pb-6 pt-6 sm:px-6">
      <Suspense fallback={<WithdrawSkeleton />}>
        <WithdrawClient />
      </Suspense>
    </div>
  )
}

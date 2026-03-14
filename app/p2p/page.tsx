import { Suspense } from "react"
import { P2PClient } from "@/components/p2p/p2p-client"

function P2PSkeleton() {
  return (
    <>
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="h-6 w-28 animate-pulse rounded bg-muted" />
        <div className="h-3 w-72 animate-pulse rounded bg-muted" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <div className="h-8 w-28 animate-pulse rounded-xl bg-muted" />
        <div className="h-8 w-20 animate-pulse rounded-xl bg-muted" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="h-8 w-36 animate-pulse rounded-lg bg-muted" />
        <div className="flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-7 w-10 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        <div className="ml-auto h-8 w-48 animate-pulse rounded-xl bg-muted" />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
                <div className="flex flex-col gap-1.5 flex-1">
                  <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                  <div className="h-2.5 w-48 animate-pulse rounded bg-muted" />
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <div className="h-5 w-20 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-28 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-8 w-16 animate-pulse rounded-xl bg-muted" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border/40 bg-card shadow-sm">
            <div className="border-b border-border/30 px-4 py-3">
              <div className="h-4 w-28 animate-pulse rounded bg-muted" />
            </div>
            <div className="space-y-3 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="h-6 w-6 animate-pulse rounded-full bg-muted" />
                  <div className="flex flex-col gap-1 flex-1">
                    <div className="h-3 w-24 animate-pulse rounded bg-muted" />
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

export default function P2PPage() {
  return (
    <div className="flex flex-col gap-4 p-4 md:p-5 lg:p-6">
      <Suspense fallback={<P2PSkeleton />}>
        <P2PClient />
      </Suspense>
    </div>
  )
}

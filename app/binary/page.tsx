import { Suspense } from "react"
import { BinaryClient } from "@/components/trading/binary-client"

function BinaryPageSkeleton() {
  return (
    <div className="flex h-screen flex-col overflow-hidden animate-pulse">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-border/10 px-3 py-2">
        <div className="h-7 w-7 rounded-full bg-accent/30" />
        <div className="h-5 w-24 rounded bg-accent/40" />
        <div className="h-4 w-20 rounded-md bg-amber-500/10" />
        <div className="h-5 w-16 rounded bg-accent/30" />
        <div className="ml-auto hidden sm:flex items-center gap-4">
          <div className="h-3 w-16 rounded bg-accent/20" />
          <div className="h-3 w-16 rounded bg-accent/20" />
        </div>
      </div>
      {/* Desktop 3-col */}
      <div className="hidden lg:flex flex-1 flex-col p-1 gap-1 overflow-hidden">
        <div className="flex-1 min-h-0 grid grid-cols-[220px_1fr_280px] gap-1">
          <div className="rounded-xl bg-accent/20" />
          <div className="flex flex-col gap-1">
            <div className="flex-1 rounded-xl bg-accent/20" />
            <div className="h-[180px] rounded-xl bg-accent/20" />
          </div>
          <div className="rounded-xl bg-accent/20" />
        </div>
      </div>
      {/* Mobile */}
      <div className="flex flex-1 flex-col gap-2 px-2 pt-2 pb-4 lg:hidden">
        <div className="h-10 rounded-xl bg-accent/20" />
        <div className="flex-1 rounded-xl bg-accent/20" />
      </div>
    </div>
  )
}

export default function BinaryPage() {
  return (
    <Suspense fallback={<BinaryPageSkeleton />}>
      <BinaryClient />
    </Suspense>
  )
}

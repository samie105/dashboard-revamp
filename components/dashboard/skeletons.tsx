import { Skeleton } from "@/components/ui/skeleton"

/* ── Wallet Card Skeleton — mirrors the on-canvas hero composition ──
   A loading state is a promise about the shape of what's coming, so every
   width here is fluid or capped. The previous version was drawn against a
   desktop that no longer existed — an avatar and a 224px block in the
   greeting row, five 112px pills, a three-column stat card — and on a 360px
   phone those measured 508px, 592px and 336px against 328px of space. They
   didn't wrap, they ran off the side, and the page's first impression was a
   grid of blocks sliding under the right edge.

   What it mirrors now: a one-line greeting, the balance hero, the two account
   cards (stacked on a phone, side by side from `sm`), three action pills, and
   the chain strip. */
export function WalletCardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {/* Greeting — one line: "Good morning, Dev · Wednesday, Sep 2". */}
      <Skeleton className="h-4 w-64 max-w-full" />

      {/* Hero — eyebrow, the figure, and what it covers. */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-36 max-w-[60%]" />
        <Skeleton className="h-11 w-[min(17rem,78%)]" />
        <Skeleton className="h-3 w-56 max-w-full" />
      </div>

      {/* Account cards. */}
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-2xl bg-card p-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-32 max-w-[70%]" />
            <Skeleton className="h-8 w-full" />
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-2.5 w-24 max-w-[50%]" />
              <Skeleton className="h-2.5 w-10 shrink-0" />
            </div>
          </div>
        ))}
      </div>

      {/* Action rail — two labelled pills and the overflow circle. They share
          the row rather than each claiming a fixed 112px. */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-12 min-w-0 flex-1 rounded-full sm:max-w-40" />
        <Skeleton className="h-12 min-w-0 flex-1 rounded-full sm:max-w-40" />
        <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
      </div>

      {/* Chain strip — clipped, not overflowing: it scrolls when it's real. */}
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-28 shrink-0" />
        ))}
      </div>
    </div>
  )
}

/* ── Markets Table Skeleton ── */
export function MarketsTableSkeleton() {
  return (
    // overflow-hidden: the filter chips are a scrolling row when they're real,
    // so here they stop at the card's edge instead of running past the page's.
    <div className="flex flex-col overflow-hidden rounded-2xl bg-card">
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-24 shrink-0" />
          <Skeleton className="h-8 w-36 max-w-[45%] rounded-lg" />
        </div>
        <div className="flex items-center gap-1 overflow-hidden">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-16 shrink-0 rounded-lg" />
          ))}
        </div>
      </div>
      <div className="border-t border-border/30 px-4 py-2">
        <div className="grid grid-cols-4 gap-4 py-1">
          <Skeleton className="h-3 w-20 max-w-full" />
          <Skeleton className="ml-auto h-3 w-12" />
          <Skeleton className="ml-auto h-3 w-16 max-w-full" />
          <Skeleton className="ml-auto h-3 w-10" />
        </div>
      </div>
      {/* The name column takes the slack; the figures keep their size, and the
          third one waits for a wider screen. Fixed widths across all five
          measured 396px against a 328px phone. */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-t border-border/10 px-4 py-3">
          <Skeleton className="h-5 w-5 shrink-0 rounded-full" />
          <Skeleton className="h-4 min-w-0 flex-1 sm:max-w-24" />
          <Skeleton className="h-4 w-16 shrink-0 sm:w-20" />
          <Skeleton className="hidden h-4 w-16 shrink-0 sm:block" />
          <Skeleton className="h-7 w-14 shrink-0 rounded-lg" />
        </div>
      ))}
    </div>
  )
}

/* ── Recent Trades Skeleton ── */
export function RecentTradesSkeleton() {
  return (
    <div className="flex flex-col rounded-2xl bg-card">
      <div className="flex items-center justify-between p-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-14" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-t border-border/20 px-4 py-2.5">
          <Skeleton className="h-4 w-4 rounded" />
          <div className="flex flex-1 flex-col gap-1">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-2.5 w-28" />
          </div>
          <div className="flex flex-col items-end gap-1">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-2.5 w-14" />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Watchlist Skeleton ── */
export function WatchlistSkeleton() {
  return (
    <div className="flex flex-col rounded-2xl bg-card">
      <div className="flex items-center justify-between p-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-3 w-14" />
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-t border-border/20 px-4 py-2.5">
          <Skeleton className="h-5 w-5 rounded-full" />
          <div className="flex flex-1 flex-col gap-1">
            <Skeleton className="h-3.5 w-12" />
            <Skeleton className="h-2.5 w-20" />
          </div>
          <div className="flex flex-col items-end gap-1">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-2.5 w-12" />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Dashboard Grid Skeleton (composite) ── */
export function DashboardGridSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="flex flex-col gap-4 lg:col-span-3">
        <MarketsTableSkeleton />
        <RecentTradesSkeleton />
      </div>
      <div className="flex flex-col gap-4 lg:col-span-2">
        <WatchlistSkeleton />
      </div>
    </div>
  )
}

/* ── Trading Page Skeletons ── */
export function TradingStatsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-2xl border border-border/50 bg-card p-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-3 w-14" />
        </div>
      ))}
    </div>
  )
}

export function TradingGridSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-2xl border border-border/50 bg-card lg:col-span-1">
        <div className="border-b border-border/50 p-4">
          <Skeleton className="h-4 w-28 mb-3" />
          <div className="flex gap-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-20 rounded-lg" />
            ))}
          </div>
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-t border-border/20 px-4 py-2.5">
            <Skeleton className="h-4 w-8" />
            <div className="flex flex-1 flex-col gap-1">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-2.5 w-28" />
            </div>
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-border/50 bg-card lg:col-span-2">
        <div className="border-b border-border/50 p-4 flex items-center justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-9 w-48 rounded-lg" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-t border-border/10 px-4 py-3">
            <Skeleton className="h-5 w-5 rounded-full" />
            <div className="flex flex-col gap-1">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-2.5 w-14" />
            </div>
            <Skeleton className="ml-auto h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="hidden md:block h-4 w-16" />
            <Skeleton className="h-7 w-14 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Spot Trading Skeletons ── */
export function SpotHeaderSkeleton() {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-card p-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-5 w-12 rounded" />
      </div>
      <div className="flex items-center gap-6">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="flex flex-col gap-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="hidden md:flex flex-col gap-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    </div>
  )
}

export function SpotChartSkeleton() {
  return (
    <div className="flex h-full flex-col rounded-2xl bg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border/30 px-4 py-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-10 rounded" />
        ))}
      </div>
      <div className="relative flex-1 min-h-75 p-4">
        <Skeleton className="h-full w-full rounded-lg" />
      </div>
    </div>
  )
}

export function SpotOrderBookSkeleton() {
  return (
    <div className="flex h-full flex-col rounded-2xl bg-card">
      <div className="flex items-center justify-between border-b border-border/30 p-4">
        <Skeleton className="h-4 w-24" />
        <div className="flex gap-1">
          <Skeleton className="h-6 w-6 rounded" />
          <Skeleton className="h-6 w-6 rounded" />
          <Skeleton className="h-6 w-6 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 px-4 py-2">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-12 ml-auto" />
        <Skeleton className="h-3 w-12 ml-auto" />
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="grid grid-cols-3 gap-2 px-4 py-1">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-3.5 w-14 ml-auto" />
          <Skeleton className="h-3.5 w-16 ml-auto" />
        </div>
      ))}
      <div className="flex items-center justify-center border-y border-border/30 py-2">
        <Skeleton className="h-5 w-24" />
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="grid grid-cols-3 gap-2 px-4 py-1">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-3.5 w-14 ml-auto" />
          <Skeleton className="h-3.5 w-16 ml-auto" />
        </div>
      ))}
    </div>
  )
}

export function SpotOrderFormSkeleton() {
  return (
    <div className="flex h-full flex-col rounded-2xl bg-card">
      <div className="flex border-b border-border/30">
        <Skeleton className="h-10 flex-1 rounded-none" />
        <Skeleton className="h-10 flex-1 rounded-none" />
      </div>
      <div className="p-4 space-y-4">
        <div className="flex gap-1 rounded-lg bg-accent/30 p-1">
          <Skeleton className="h-8 flex-1 rounded-md" />
          <Skeleton className="h-8 flex-1 rounded-md" />
          <Skeleton className="h-8 flex-1 rounded-md" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-7 flex-1 rounded" />
          ))}
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
    </div>
  )
}

/* ── Swap Page Skeletons ── */
export function SwapCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/40 bg-card">
      <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-7 w-7 rounded-lg" />
      </div>
      <div className="p-4">
        <div className="rounded-xl border border-border/30 bg-accent/20 p-3.5">
          <div className="flex items-center justify-between mb-2.5">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 flex-1" />
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
          <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-border/20">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3.5 w-18" />
          </div>
        </div>
        <div className="flex justify-center -my-2.5 relative z-10">
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
        <div className="rounded-xl border border-border/30 bg-accent/20 p-3.5">
          <div className="flex items-center justify-between mb-2.5">
            <Skeleton className="h-3 w-18" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 flex-1" />
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
          <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-border/20">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3.5 w-18" />
          </div>
        </div>
        <Skeleton className="mt-3 h-11 w-full rounded-xl" />
      </div>
    </div>
  )
}

export function SwapHistorySkeleton() {
  return (
    <div className="rounded-2xl border border-border/40 bg-card">
      <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
        <Skeleton className="h-3.5 w-24" />
      </div>
      <div className="flex flex-col items-center justify-center gap-2 px-4 py-8">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-2.5 w-40" />
      </div>
    </div>
  )
}

export function SwapTimelineSkeleton() {
  return (
    <div className="rounded-2xl border border-border/40 bg-card">
      <div className="flex items-center gap-2 border-b border-border/30 px-4 py-3">
        <Skeleton className="h-3.5 w-24" />
      </div>
      <div className="px-4 py-4 pl-9 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2.5 w-36" />
          </div>
        ))}
      </div>
    </div>
  )
}

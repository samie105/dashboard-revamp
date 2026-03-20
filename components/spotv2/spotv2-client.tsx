"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import type { SpotV2ClientProps, SpotV2Pair } from "./spotv2-types"
import { PairSidebar } from "./pair-sidebar"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

// ── Placeholder panels (to be implemented in later phases) ───────────────

function ChartPlaceholder({ pair }: { pair: SpotV2Pair | undefined }) {
  return (
    <div className="flex h-full items-center justify-center rounded-lg border border-border/10 bg-muted/20">
      <div className="text-center">
        <p className="text-sm font-medium text-muted-foreground/70">Chart</p>
        <p className="text-xs text-muted-foreground/40">
          {pair ? `${pair.displaySymbol} — DEXScreener` : "Select a pair"}
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground/30">Phase 2</p>
      </div>
    </div>
  )
}

function OrderBookPlaceholder({ pair }: { pair: SpotV2Pair | undefined }) {
  return (
    <div className="flex h-full items-center justify-center rounded-lg border border-border/10 bg-muted/20">
      <div className="text-center">
        <p className="text-sm font-medium text-muted-foreground/70">Order Book</p>
        <p className="text-xs text-muted-foreground/40">
          {pair ? `${pair.displaySymbol}` : ""}
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground/30">Binance WS — Phase 2</p>
      </div>
    </div>
  )
}

function RecentTradesPlaceholder({ pair }: { pair: SpotV2Pair | undefined }) {
  return (
    <div className="flex h-full items-center justify-center rounded-lg border border-border/10 bg-muted/20">
      <div className="text-center">
        <p className="text-sm font-medium text-muted-foreground/70">Recent Trades</p>
        <p className="text-xs text-muted-foreground/40">
          {pair ? `${pair.displaySymbol}` : ""}
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground/30">Binance WS — Phase 2</p>
      </div>
    </div>
  )
}

function OrderFormPlaceholder({ pair }: { pair: SpotV2Pair | undefined }) {
  return (
    <div className="flex h-full items-center justify-center rounded-lg border border-border/10 bg-muted/20">
      <div className="text-center">
        <p className="text-sm font-medium text-muted-foreground/70">Buy / Sell</p>
        <p className="text-xs text-muted-foreground/40">
          {pair ? `Market order — ${pair.displaySymbol}` : "Select a pair"}
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground/30">Phase 3</p>
      </div>
    </div>
  )
}

function BottomPanelPlaceholder() {
  return (
    <div className="flex h-full items-center justify-center rounded-lg border border-border/10 bg-muted/20">
      <div className="text-center">
        <p className="text-sm font-medium text-muted-foreground/70">
          Positions | Trade History | PnL
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground/30">Phase 5</p>
      </div>
    </div>
  )
}

// ── Top Bar ──────────────────────────────────────────────────────────────

function SpotV2TopBar({
  pair,
  onOpenMarkets,
}: {
  pair: SpotV2Pair | undefined
  onOpenMarkets: () => void
}) {
  if (!pair) return null

  return (
    <div className="flex items-center justify-between border-b border-border/10 px-3 py-2">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMarkets}
          className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-muted/50"
        >
          {pair.image && (
            <img src={pair.image} alt={pair.name} className="h-5 w-5 rounded-full" />
          )}
          <span className="text-sm font-bold">{pair.displaySymbol}</span>
          <svg className="h-3 w-3 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <span className="text-sm font-semibold tabular-nums">
          ${pair.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
        </span>

        <span
          className={cn(
            "text-xs font-medium tabular-nums",
            pair.change24h >= 0 ? "text-emerald-400" : "text-red-400",
          )}
        >
          {pair.change24h >= 0 ? "+" : ""}{pair.change24h.toFixed(2)}%
        </span>

        <span className="hidden text-xs text-muted-foreground/60 sm:inline">
          MCap: ${(pair.marketCap / 1e9).toFixed(1)}B
        </span>
        <span className="hidden text-xs text-muted-foreground/60 md:inline">
          Vol: ${(pair.volume24h / 1e6).toFixed(1)}M
        </span>
      </div>
    </div>
  )
}

// ── Main Client ──────────────────────────────────────────────────────────

export function SpotV2Client({ initialPairs }: SpotV2ClientProps) {
  const [pairs, setPairs] = React.useState<SpotV2Pair[]>(initialPairs)
  const [selectedSymbol, setSelectedSymbol] = React.useState(
    () => initialPairs[0]?.symbol ?? "BTC",
  )
  const [mobileMarketsOpen, setMobileMarketsOpen] = React.useState(false)

  const selectedPair = React.useMemo(
    () => pairs.find((p: SpotV2Pair) => p.symbol === selectedSymbol),
    [pairs, selectedSymbol],
  )

  // Refresh prices every 60 seconds
  React.useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/spotv2/pairs")
        const data = await res.json()
        if (data.success && Array.isArray(data.pairs)) {
          setPairs(data.pairs)
        }
      } catch {
        // Silently use stale data
      }
    }, 60_000)

    return () => clearInterval(interval)
  }, [])

  const handleSelectPair = React.useCallback((symbol: string) => {
    setSelectedSymbol(symbol)
    setMobileMarketsOpen(false)
  }, [])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Top Bar */}
      <SpotV2TopBar
        pair={selectedPair}
        onOpenMarkets={() => setMobileMarketsOpen(true)}
      />

      {/* ── Desktop: 3-column CEX layout ──────────────────────────────── */}
      <div className="hidden flex-1 overflow-hidden lg:grid lg:grid-cols-[220px_1fr_280px] lg:gap-px">
        {/* Left: Pair sidebar */}
        <PairSidebar
          pairs={pairs}
          selectedPair={selectedSymbol}
          onSelect={handleSelectPair}
        />

        {/* Center column */}
        <div className="flex flex-col gap-px overflow-hidden">
          {/* Chart — 60% height */}
          <div className="flex-3 min-h-0">
            <ChartPlaceholder pair={selectedPair} />
          </div>
          {/* Recent trades — 20% height */}
          <div className="flex-1 min-h-0">
            <RecentTradesPlaceholder pair={selectedPair} />
          </div>
          {/* Bottom panel — 20% height */}
          <div className="flex-1 min-h-0">
            <BottomPanelPlaceholder />
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-px overflow-hidden border-l border-border/10">
          {/* Order book — top half */}
          <div className="flex-1 min-h-0">
            <OrderBookPlaceholder pair={selectedPair} />
          </div>
          {/* Buy/Sell form — bottom half */}
          <div className="flex-1 min-h-0">
            <OrderFormPlaceholder pair={selectedPair} />
          </div>
        </div>
      </div>

      {/* ── Mobile: stacked layout ────────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-1 lg:hidden">
        {/* Chart */}
        <div className="h-[300px] shrink-0">
          <ChartPlaceholder pair={selectedPair} />
        </div>

        {/* Order form */}
        <div className="h-[200px] shrink-0">
          <OrderFormPlaceholder pair={selectedPair} />
        </div>

        {/* Order book + recent trades side by side */}
        <div className="grid h-[200px] grid-cols-2 gap-1 shrink-0">
          <OrderBookPlaceholder pair={selectedPair} />
          <RecentTradesPlaceholder pair={selectedPair} />
        </div>

        {/* Bottom panel */}
        <div className="h-[150px] shrink-0">
          <BottomPanelPlaceholder />
        </div>
      </div>

      {/* ── Mobile markets sheet ──────────────────────────────────────── */}
      <Sheet open={mobileMarketsOpen} onOpenChange={setMobileMarketsOpen}>
        <SheetContent side="left" className="w-[280px] p-0">
          <SheetHeader className="px-3 pt-3">
            <SheetTitle className="text-sm">Markets</SheetTitle>
          </SheetHeader>
          <div className="h-[calc(100dvh-48px)]">
            <PairSidebar
              pairs={pairs}
              selectedPair={selectedSymbol}
              onSelect={handleSelectPair}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

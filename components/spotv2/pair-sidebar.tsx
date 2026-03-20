"use client"

import * as React from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { getChainLabel, getChainColorClass } from "@/lib/spotv2/pairs"
import type { SpotV2Pair } from "./spotv2-types"

interface PairSidebarProps {
  pairs: SpotV2Pair[]
  selectedPair: string
  onSelect: (symbol: string) => void
}

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (price >= 1) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })
  if (price >= 0.01) return price.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 6 })
  return price.toLocaleString("en-US", { minimumFractionDigits: 6, maximumFractionDigits: 8 })
}

export function PairSidebar({ pairs, selectedPair, onSelect }: PairSidebarProps) {
  const [search, setSearch] = React.useState("")

  const filtered = React.useMemo(() => {
    if (!search.trim()) return pairs
    const q = search.toLowerCase()
    return pairs.filter(
      (p) =>
        p.symbol.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.displaySymbol.toLowerCase().includes(q),
    )
  }, [pairs, search])

  return (
    <div className="flex h-full flex-col border-r border-border/10 bg-background">
      {/* Search */}
      <div className="p-2">
        <input
          type="text"
          placeholder="Search pairs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-border/20 bg-muted/50 px-3 py-1.5 text-sm placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
        />
      </div>

      {/* Header */}
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-1 px-3 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
        <span>Pair</span>
        <span className="text-right">Price</span>
        <span className="w-14 text-right">24h</span>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground/50">
            No pairs found
          </div>
        )}
        {filtered.map((pair) => (
          <button
            key={pair.id}
            onClick={() => onSelect(pair.symbol)}
            className={cn(
              "grid w-full grid-cols-[1fr_auto_auto] items-center gap-1 px-3 py-1.5 text-left transition-colors hover:bg-muted/50",
              selectedPair === pair.symbol && "bg-muted/70",
            )}
          >
            {/* Token info */}
            <div className="flex items-center gap-2 min-w-0">
              <Image
                src={pair.image}
                alt={pair.name}
                width={20}
                height={20}
                className="rounded-full shrink-0"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold truncate">{pair.displaySymbol}</span>
                  <span
                    className={cn(
                      "shrink-0 rounded px-1 py-px text-[9px] font-medium leading-tight",
                      getChainColorClass(pair.chain),
                    )}
                  >
                    {getChainLabel(pair.chain)}
                  </span>
                </div>
              </div>
            </div>

            {/* Price */}
            <span className="text-right text-xs font-medium tabular-nums">
              ${formatPrice(pair.price)}
            </span>

            {/* 24h Change */}
            <span
              className={cn(
                "w-14 text-right text-xs font-medium tabular-nums",
                pair.change24h >= 0 ? "text-emerald-400" : "text-red-400",
              )}
            >
              {pair.change24h >= 0 ? "+" : ""}
              {pair.change24h.toFixed(2)}%
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

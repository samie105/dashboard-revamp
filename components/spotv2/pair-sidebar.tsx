"use client"

import * as React from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
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
  const searchRef = React.useRef<HTMLInputElement>(null)

  const filtered = React.useMemo(() => {
    let items = pairs
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(
        (p) =>
          p.symbol.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q),
      )
    }
    return [...items].sort((a, b) => b.volume24h - a.volume24h)
  }, [pairs, search])

  return (
    <div className="flex h-full flex-col bg-card overflow-hidden">
      {/* Search */}
      <div className="p-2.5 border-b border-border/20">
        <div className="relative">
          <svg className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={searchRef}
            type="text"
            inputMode="search"
            autoComplete="off"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pairs…"
            className="w-full rounded-lg bg-accent/40 py-1.5 pl-8 pr-2 text-xs outline-none placeholder:text-muted-foreground/60 focus:bg-accent"
          />
        </div>
      </div>

      {/* Column header */}
      <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
        <span>Pair</span>
        <span className="w-20 text-right">Price</span>
        <span className="w-16 text-right">24h</span>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto slim-scroll">
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-xs text-muted-foreground">
            Nothing found
          </p>
        ) : (
          filtered.map((pair) => {
            const pos = pair.change24h >= 0
            const active = pair.symbol === selectedPair
            return (
              <button
                key={pair.id}
                onClick={() => onSelect(pair.symbol)}
                className={cn(
                  "grid w-full grid-cols-[1fr_auto_auto] items-center gap-2 px-3 py-2 text-left transition-colors",
                  active ? "bg-primary/5" : "hover:bg-accent/30",
                )}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Image
                    src={pair.image}
                    alt={pair.name}
                    width={20}
                    height={20}
                    className="rounded-full shrink-0"
                  />
                  <span className="truncate text-sm font-semibold">
                    {pair.symbol}
                    <span className="text-xs text-muted-foreground font-normal">/USDC</span>
                  </span>
                </div>
                <span className="w-20 text-right text-xs font-medium tabular-nums">
                  ${formatPrice(pair.price)}
                </span>
                <span
                  className={cn(
                    "w-16 text-right text-xs font-bold tabular-nums",
                    pos ? "text-emerald-500" : "text-red-500",
                  )}
                >
                  {pos ? "+" : ""}
                  {pair.change24h.toFixed(2)}%
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

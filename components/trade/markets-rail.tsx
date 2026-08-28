"use client"

/**
 * MarketsRail — the workspace's left pane: the FULL market list, always on
 * screen, so switching pairs is one click instead of a dropdown expedition
 * (the Binance left-rail idiom). Search filters as you type; the active pair
 * stays highlighted.
 *
 * Pure display: the list and selection arrive via props, the page owns the
 * URL and data.
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import { Eyebrow } from "@/components/ui/system"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import type { HlSpotMarket, HlFuturesMarket } from "@/lib/crypto-api"

type AnyMarket = HlSpotMarket | HlFuturesMarket

function fmtPx(p: number) {
  return p.toLocaleString(undefined, { maximumFractionDigits: p < 1 ? 6 : 2 })
}

/**
 * The quote asset is the market's own (spec §8) — the registry names it per
 * row, so the rail must not label every spot pair USDC. Rows that predate the
 * registry (the legacy Hyperliquid feed) are USDC-quoted, hence the fallback.
 */
function quoteLabel(m: AnyMarket) {
  return "quote" in m && m.quote ? String(m.quote).toUpperCase() : "USDC"
}

export function MarketsRail({
  list,
  market,
  symbol,
  onSelect,
  className,
}: {
  list: readonly AnyMarket[]
  market: "spot" | "futures"
  symbol: string
  onSelect: (symbol: string) => void
  className?: string
}) {
  const [search, setSearch] = React.useState("")

  const filtered = React.useMemo(() => {
    if (!search) return list
    const q = search.toLowerCase()
    return list.filter((m) => m.symbol.toLowerCase().includes(q))
  }, [list, search])

  return (
    <aside
      aria-label="Markets"
      data-vivid-target="markets-rail"
      data-vivid-label="The market list rail — every tradable pair"
      className={cn("flex min-h-0 flex-col", className)}
    >
      <div className="shrink-0 px-3 pb-2 pt-3">
        <Eyebrow className="text-[10px]">Markets{list.length > 0 && ` · ${list.length}`}</Eyebrow>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          aria-label="Search markets"
          data-vivid-target="markets-search"
          data-vivid-label="Filter the market list"
          className="mt-2 w-full rounded-xl bg-surface-sunken px-3 py-2 text-sm outline-none transition-shadow placeholder:text-subtle focus-visible:ring-2 focus-visible:ring-primary/40"
        />
      </div>

      <div className="slim-scroll min-h-0 flex-1 overflow-y-auto pb-2" role="listbox" aria-label="Market list">
        {list.length === 0 ? (
          // Markets still loading — hold the layout with quiet rows. An empty
          // registry looks identical here; the ticket carries the honest
          // "markets are unavailable" message, this rail only holds space.
          Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="mx-3 my-1.5 h-9 animate-pulse rounded-lg bg-surface-sunken/70" />
          ))
        ) : filtered.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-muted-foreground">No markets match.</p>
        ) : (
          filtered.map((m) => {
            const active = m.symbol === symbol
            return (
              <button
                key={"id" in m && m.id ? m.id : m.symbol}
                role="option"
                aria-selected={active}
                aria-label={`Switch to the ${m.symbol} market`}
                data-vivid-target={`pick-pair-${m.symbol}`}
                data-vivid-label={`Switch to the ${m.symbol} market`}
                onClick={() => onSelect(m.symbol)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40",
                  active ? "bg-accent" : "hover:bg-accent/50",
                )}
              >
                <span className="flex min-w-0 items-center gap-2 truncate text-sm font-semibold">
                  <CoinAvatar symbol={"coinName" in m ? m.coinName : m.symbol} src={"icon" in m ? m.icon : undefined} size="md" />
                  {m.symbol}
                  <span className="ml-1 text-[10px] font-medium text-subtle">
                    {market === "futures" ? "PERP" : quoteLabel(m)}
                  </span>
                  {"maxLeverage" in m && (
                    <span className="ml-1.5 rounded bg-primary/[0.12] px-1 py-0.5 text-[9px] font-bold text-primary">
                      {m.maxLeverage}×
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">${fmtPx(m.price)}</span>
              </button>
            )
          })
        )}
      </div>
    </aside>
  )
}

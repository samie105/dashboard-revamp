"use client"

/**
 * MarketsRail — the workspace's left pane: the FULL market list, always on
 * screen, so switching pairs is one click instead of a dropdown expedition
 * (the Binance left-rail idiom).
 *
 * The rail is now only the landmark and the column chrome. Everything that
 * makes the list usable — ranked search, the chain filter, pinning, recents —
 * is `MarketPicker`, shared with the header dropdown so the two cannot drift
 * apart again. `market` is no longer a prop: whether a row is a perp is a fact
 * about the row (`maxLeverage`), not about which tab you are on.
 */

import { cn } from "@/lib/utils"
import { MarketPicker } from "@/components/trade/market-picker"
import type { AnyMarket } from "@/lib/spot-market-search"

export function MarketsRail({
  list,
  selected,
  onSelect,
  className,
}: {
  list: readonly AnyMarket[]
  /** The selected row's identity — `marketRowKey`, never a bare symbol. */
  selected: string
  onSelect: (rowKey: string) => void
  className?: string
}) {
  return (
    <aside
      aria-label="Markets"
      data-vivid-target="markets-rail"
      data-vivid-label="The market list rail — every tradable pair"
      className={cn("flex min-h-0 flex-col", className)}
    >
      <MarketPicker
        list={list}
        selected={selected}
        onSelect={onSelect}
        variant="rail"
        className="min-h-0 flex-1"
      />
    </aside>
  )
}

"use client"

/**
 * The Pro market rail.
 *
 * The live one lists 8,082 pairs with a price and nothing else, sorted by
 * nothing you can choose, with SOL appearing twice at two different prices.
 * You cannot scan it for movers because the 24h change is not on the row.
 *
 * So: change and volume on every row, a sort you pick, favourites, and a list
 * deduplicated at source.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, Cancel01Icon, StarIcon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { Segmented } from "@/components/ui/system"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { PAIRS, formatCompact, formatPrice, type Market } from "@/components/trade-unauth/trade-data"

type Sort = "volume" | "change" | "name"

export function MarketList({
  activeId,
  onSelect,
  markets,
}: {
  activeId: string
  onSelect: (id: string) => void
  /** Defaults to spot pairs; the futures venue passes its perpetuals. */
  markets?: Market[]
}) {
  const universe = markets ?? PAIRS
  const [query, setQuery] = React.useState("")
  const [sort, setSort] = React.useState<Sort>("volume")
  const [favorites, setFavorites] = React.useState<string[]>(["SOL-USDT", "BTC-USDT"])
  const [favOnly, setFavOnly] = React.useState(false)

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = universe.filter((p) => {
      if (favOnly && !favorites.includes(p.id)) return false
      if (!q) return true
      return p.base.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.quote.toLowerCase().includes(q)
    })
    if (sort === "volume") return [...list].sort((a, b) => b.volumeUsd - a.volumeUsd)
    if (sort === "change") return [...list].sort((a, b) => b.changePct - a.changePct)
    return [...list].sort((a, b) => a.base.localeCompare(b.base))
  }, [universe, query, sort, favOnly, favorites])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-col gap-2 p-3">
        <label className="relative flex items-center">
          <HugeiconsIcon
            icon={Search01Icon}
            className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-muted-foreground"
          />
          <span className="sr-only">Search markets</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Symbol or name"
            className="h-9 w-full min-w-0 rounded-full bg-surface-sunken pl-8 pr-8 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="ws-icon-mono absolute right-3 text-muted-foreground hover:text-foreground"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="h-3.5 w-3.5" />
            </button>
          )}
        </label>

        <div className="flex items-center gap-2">
          <Segmented
            size="sm"
            options={[
              { key: "volume", label: "Volume" },
              { key: "change", label: "24h" },
              { key: "name", label: "A–Z" },
            ]}
            value={sort}
            onChange={(k) => setSort(k as Sort)}
          />
          <button
            type="button"
            onClick={() => setFavOnly((v) => !v)}
            aria-pressed={favOnly}
            title="Show favourites only"
            className={cn(
              "ws-icon-mono ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors",
              favOnly ? "bg-primary/[0.16] text-primary" : "text-muted-foreground/60 hover:text-foreground",
            )}
          >
            <HugeiconsIcon icon={StarIcon} className={cn("h-3.5 w-3.5", favOnly && "fill-primary")} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto] px-3 pb-1 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        <span>Market</span>
        <span>Price / 24h</span>
      </div>

      <div className="slim-scroll flex min-h-0 flex-1 flex-col overflow-y-auto">
        {rows.length === 0 ? (
          <span className="px-3 py-6 text-center text-[12.5px] text-muted-foreground">
            No market matches.
          </span>
        ) : (
          rows.map((p) => <Row key={p.id} p={p} active={p.id === activeId} fav={favorites.includes(p.id)} onSelect={onSelect} onFav={() => setFavorites((f) => (f.includes(p.id) ? f.filter((x) => x !== p.id) : [...f, p.id]))} />)
        )}
      </div>
    </div>
  )
}

function Row({
  p,
  active,
  fav,
  onSelect,
  onFav,
}: {
  p: Market
  active: boolean
  fav: boolean
  onSelect: (id: string) => void
  onFav: () => void
}) {
  const up = p.changePct >= 0
  // Perps carry maxLeverage; spot pairs do not. Reading it off the row keeps
  // one list component serving both venues.
  const maxLeverage = (p as Market & { maxLeverage?: number }).maxLeverage
  return (
    <div
      className={cn(
        "relative flex items-center gap-2 pl-3 pr-2 transition-colors",
        active
          // Same grammar as the nav rail's current row: gold fading right.
          ? "bg-[linear-gradient(90deg,color-mix(in_oklab,var(--primary)_16%,transparent)_0%,transparent_80%)]"
          : "hover:bg-accent/40",
      )}
    >
      {active && (
        <span aria-hidden className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
      )}
      <button
        type="button"
        onClick={onFav}
        aria-label={fav ? `Unstar ${p.base}` : `Star ${p.base}`}
        className={cn(
          "ws-icon-mono flex h-5 w-5 shrink-0 items-center justify-center transition-colors",
          fav ? "text-primary" : "text-muted-foreground/30 hover:text-muted-foreground",
        )}
      >
        <HugeiconsIcon icon={StarIcon} className={cn("h-3 w-3", fav && "fill-primary")} />
      </button>
      <button
        type="button"
        onClick={() => onSelect(p.id)}
        className="flex min-w-0 flex-1 items-center gap-2.5 py-2 text-left"
      >
        <CoinAvatar symbol={p.base} size="md" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-baseline gap-1 leading-tight">
            <span className={cn("truncate text-[12.5px]", active ? "font-semibold" : "font-medium")}>
              {p.base}
            </span>
            {maxLeverage ? (
              <span className="rounded bg-foreground/[0.08] px-1 text-[9.5px] font-bold tabular-nums text-muted-foreground">
                {maxLeverage}×
              </span>
            ) : (
              <span className="text-[10.5px] text-muted-foreground">/{p.quote}</span>
            )}
          </span>
          <span className="truncate text-[10.5px] leading-tight text-muted-foreground">
            {maxLeverage ? "Perpetual · " : ""}Vol {formatCompact(p.volumeUsd)}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <span className="text-[12.5px] font-medium tabular-nums">{formatPrice(p.price)}</span>
          <span className={cn("text-[11px] font-semibold tabular-nums", up ? "text-credit" : "text-debit")}>
            {up ? "+" : ""}
            {p.changePct.toFixed(2)}%
          </span>
        </span>
      </button>
    </div>
  )
}

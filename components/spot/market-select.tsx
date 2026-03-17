"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, StarIcon } from "@hugeicons/core-free-icons"
import type { CoinData } from "@/lib/actions"
import { getSpotMarkets } from "@/lib/actions"
import { PairAvatar } from "./coin-avatar"

export function MarketSelect({
  coins,
  selected,
  onSelect,
  watchlist,
  onToggleWatch,
}: {
  coins: CoinData[]
  selected: string
  onSelect: (s: string) => void
  watchlist: Set<string>
  onToggleWatch: (s: string) => void
}) {
  const [search, setSearch] = React.useState("")
  const [tab, setTab] = React.useState<"all" | "watchlist">("all")
  const [liveCoins, setLiveCoins] = React.useState<CoinData[]>(coins)

  // Keep live coins in sync with fresh props
  React.useEffect(() => {
    if (coins.length) setLiveCoins(coins)
  }, [coins])

  // Poll spot markets every 10s for real-time updates
  React.useEffect(() => {
    let cancelled = false
    async function poll() {
      try {
        const res = await getSpotMarkets()
        if (cancelled) return
        if (res.markets?.length) setLiveCoins(res.markets)
      } catch { /* ignore */ }
    }
    const id = window.setInterval(poll, 10_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  const list = React.useMemo(() => {
    let items = liveCoins
    if (tab === "watchlist")
      items = items.filter((c) => watchlist.has(c.symbol))
    if (search) {
      const q = search.toLowerCase()
      items = items.filter(
        (c) =>
          c.symbol.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q),
      )
    }
    return items.sort((a, b) => b.volume24h - a.volume24h)
  }, [liveCoins, search, tab, watchlist])

  return (
    <div className="flex h-full flex-col bg-card overflow-hidden">
      {/* Search */}
      <div className="p-2.5 border-b border-border/20">
        <div className="relative">
          <HugeiconsIcon
            icon={Search01Icon}
            className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pairs…"
            className="w-full rounded-lg bg-accent/40 py-1.5 pl-8 pr-2 text-xs outline-none placeholder:text-muted-foreground/60 focus:bg-accent"
          />
        </div>
        <div className="mt-2 flex gap-1">
          {(["all", "watchlist"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-2.5 py-1 text-[10px] font-medium capitalize transition-colors ${
                tab === t
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "watchlist" ? "★ Watchlist" : "All"}
            </button>
          ))}
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
        {list.length === 0 ? (
          <p className="py-10 text-center text-xs text-muted-foreground">
            Nothing found
          </p>
        ) : (
          list.map((coin) => {
            const pos = coin.change24h >= 0
            const active = coin.symbol === selected
            const quote = coin.quoteAsset || "USDC"
            return (
              <button
                key={coin.symbol}
                onClick={() => onSelect(coin.symbol)}
                className={`grid w-full grid-cols-[1fr_auto_auto] items-center gap-2 px-3 py-2 text-left transition-colors ${
                  active ? "bg-primary/5" : "hover:bg-accent/30"
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleWatch(coin.symbol)
                    }}
                    className="shrink-0 text-muted-foreground/30 hover:text-amber-400"
                  >
                    <HugeiconsIcon
                      icon={StarIcon}
                      className={`h-3 w-3 ${watchlist.has(coin.symbol) ? "text-amber-400 fill-amber-400" : ""}`}
                    />
                  </button>
                  <PairAvatar baseImage={coin.image} baseSymbol={coin.symbol} baseSize={20} quoteSize={14} />
                  <span className="truncate text-sm font-semibold">
                    {coin.symbol}
                    <span className="text-xs text-muted-foreground font-normal">/{quote}</span>
                  </span>
                </div>
                <span className="w-20 text-right text-xs font-medium tabular-nums">
                  $
                  {coin.price < 1
                    ? coin.price.toFixed(4)
                    : coin.price.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                </span>
                <span
                  className={`w-16 text-right text-xs font-bold tabular-nums ${pos ? "text-emerald-500" : "text-red-500"}`}
                >
                  {pos ? "+" : ""}
                  {coin.change24h.toFixed(2)}%
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

"use client"

/**
 * Watchlist — the coins you follow but may not hold.
 *
 * Lifted out of the old `/portfolio` page when Assets and Portfolio were
 * merged into one screen. It is the one panel on that page that is NOT an
 * account: everything else answers "what do I own", this answers "what am I
 * watching". Keeping it a component of its own is what let the merge happen
 * without the merged client growing a second concern.
 *
 * The 7-day curves and the 24h change come from one batched request for the
 * whole list, so the line and the number can never disagree — the price feed's
 * own change field reported a flat 0.00% for every coin.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Cancel01Icon,
  Search01Icon,
  StarIcon,
} from "@hugeicons/core-free-icons"
import {
  CardHeader,
  CardShell,
  Skel,
  Sparkline,
} from "@/components/ui/system"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { numOr, pctSigned, price } from "@/lib/num"
import { useSparklines } from "@/hooks/useSparklines"
import type { CoinData } from "@/lib/actions"

export const INITIAL_WATCHLIST = ["BTC", "ETH", "SOL", "SUI", "TON", "TRX", "USDT"]

export function Watchlist({
  coins,
  watchlistSymbols,
  onWatchlistChange,
  className,
}: {
  coins: CoinData[]
  watchlistSymbols: string[]
  onWatchlistChange: (list: string[]) => void
  className?: string
}) {
  const [starred, setStarred] = React.useState<string[]>(["BTC", "ETH", "SOL"])
  const [showAdd, setShowAdd] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowAdd(false)
        setSearch("")
      }
    }
    if (showAdd) document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [showAdd])

  const list = React.useMemo(
    () =>
      watchlistSymbols
        .map((s) => coins.find((c) => c.symbol === s))
        .filter((c): c is CoinData => !!c),
    [coins, watchlistSymbols],
  )

  const spark = useSparklines(watchlistSymbols)

  const addable = React.useMemo(() => {
    const inSet = new Set(watchlistSymbols)
    let r = coins.filter((c) => !inSet.has(c.symbol))
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(
        (c) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q),
      )
    }
    return r
  }, [coins, watchlistSymbols, search])

  return (
    <CardShell className={className}>
      <CardHeader
        title="Watchlist"
        subtitle="Live prices"
        right={
          <div className="relative shrink-0" ref={ref}>
            <button
              onClick={() => setShowAdd((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <HugeiconsIcon icon={Add01Icon} className="h-3.5 w-3.5" /> Add
            </button>
            {showAdd && (
              <div className="absolute right-0 top-9 z-50 w-64 overflow-hidden rounded-xl border-0 bg-popover shadow-xl shadow-black/8 ring-1 ring-border/40">
                <div className="border-b border-white/10 p-2">
                  <div className="flex items-center gap-2 rounded-lg bg-accent/40 px-2.5 py-1.5">
                    <HugeiconsIcon
                      icon={Search01Icon}
                      className="h-3 w-3 shrink-0 text-muted-foreground"
                    />
                    <input
                      autoFocus
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search…"
                      className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/50"
                    />
                  </div>
                </div>
                <div className="slim-scroll max-h-52 overflow-y-auto">
                  <div className="p-1">
                    {addable.length === 0 ? (
                      <p className="py-4 text-center text-[13px] text-muted-foreground">
                        No coins found
                      </p>
                    ) : (
                      addable.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            onWatchlistChange([...watchlistSymbols, c.symbol])
                            setShowAdd(false)
                            setSearch("")
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-accent/30"
                        >
                          <CoinAvatar
                            src={c.image}
                            symbol={c.symbol}
                            size="sm"
                            className="h-4 w-4 text-[7px]"
                          />
                          <span className="text-[13px] font-semibold">{c.symbol}</span>
                          <span className="text-[12px] text-muted-foreground">{c.name}</span>
                          <HugeiconsIcon icon={Add01Icon} className="ml-auto h-3 w-3 text-primary" />
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        }
      />
      {/* A CAP, not a floor. This was `min-h-[22rem] flex-1`, which reserved
          352px whatever the list held — so a three-coin watchlist drew three
          rows and then 200px of empty card under them. The card is as tall as
          its rows now, and a long list scrolls inside the same 22rem instead
          of running down the page. */}
      <ScrollArea className="max-h-[22rem]">
        <div className="p-1.5">
          {list.map((coin) => {
            const s = spark(coin.symbol)
            const change = numOr(s?.change24h ?? coin.change24h, 0)
            const up = change >= 0
            const isStar = starred.includes(coin.symbol)
            return (
              <div
                key={coin.id}
                className="group flex items-center justify-between rounded-lg px-2.5 py-2 transition-colors hover:bg-accent/30"
              >
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setStarred((p) =>
                        p.includes(coin.symbol)
                          ? p.filter((s) => s !== coin.symbol)
                          : [...p, coin.symbol],
                      )
                    }
                    aria-label={isStar ? `Unpin ${coin.symbol}` : `Pin ${coin.symbol}`}
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <HugeiconsIcon
                      icon={StarIcon}
                      className={`h-3 w-3 ${isStar ? "text-amber-400" : "text-muted-foreground/40 hover:text-amber-400"} transition-colors`}
                    />
                  </button>
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-accent/30">
                    <CoinAvatar
                      src={coin.image}
                      symbol={coin.symbol}
                      size="sm"
                      className="h-4 w-4 text-[7px]"
                    />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold leading-tight">{coin.symbol}/USD</p>
                    <p className="text-[12px] text-muted-foreground">{coin.name}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  <span className="hidden h-6 w-16 shrink-0 items-center sm:flex">
                    {s === undefined ? (
                      <Skel className="h-4 w-full rounded-sm" />
                    ) : (
                      <Sparkline points={s?.prices} />
                    )}
                  </span>
                  <div className="w-[74px] shrink-0 text-right">
                    <p className="text-[13px] font-semibold tabular-nums">{price(coin.price)}</p>
                    <p
                      className={`text-[12px] font-medium tabular-nums ${up ? "text-credit" : "text-debit"}`}
                    >
                      {pctSigned(change)}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      onWatchlistChange(watchlistSymbols.filter((s) => s !== coin.symbol))
                    }
                    aria-label={`Remove ${coin.symbol} from the watchlist`}
                    className="rounded p-0.5 opacity-0 transition-all hover:bg-red-500/10 group-hover:opacity-100"
                  >
                    <HugeiconsIcon
                      icon={Cancel01Icon}
                      className="h-3 w-3 text-muted-foreground transition-colors hover:text-debit"
                    />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </CardShell>
  )
}

"use client"

/**
 * MarketPicker — the one way to find a market in the trading workspace.
 *
 * There used to be two: the left rail and the header dropdown, each with its
 * own search input and its own copy of a symbol-substring filter. They drifted
 * (the rail showed the network, the dropdown showed it differently), and
 * neither could answer "show me the Solana markets" — the only question that
 * makes the registry navigable, since the same symbol is listed once per chain.
 *
 * One component now, in two shapes: `rail` fills the workspace's left column,
 * `popover` is the compact dropdown under the pair name. Ranking, chain
 * filtering, pinning and recents live in `lib/spot-market-search` and
 * `hooks/useMarketPrefs`, so both shapes behave identically by construction
 * rather than by anyone remembering to update the other one.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, StarIcon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { Eyebrow } from "@/components/ui/system"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { marketRowKey } from "@/lib/crypto-api"
import {
  ALL_CHAINS,
  buildSpotIndex,
  chainLabel,
  chainOptionsFor,
  networkIdOf,
  quoteOf,
  searchSpotMarkets,
  type AnyMarket,
} from "@/lib/spot-market-search"
import { useMarketPrefs } from "@/hooks/useMarketPrefs"

/* The registry is 9,000+ rows. Mounting them all is a visible freeze on every
   keystroke and every chain chip, for a list nobody scrolls past the first
   screen of — so rows arrive a page at a time, extended by scrolling to the
   end or by asking. */
const PAGE_SIZE = 60

function fmtPx(p: number) {
  return p.toLocaleString(undefined, { maximumFractionDigits: p < 1 ? 6 : 2 })
}

/** A market row. The star is a sibling button, not nested inside the row's. */
function MarketRow({
  market,
  active,
  pinned,
  onSelect,
  onTogglePin,
}: {
  market: AnyMarket
  active: boolean
  pinned: boolean
  onSelect: (rowKey: string) => void
  onTogglePin: (rowKey: string) => void
}) {
  const rowKey = marketRowKey(market)
  const networkId = networkIdOf(market)
  const network = networkId ? chainLabel(networkId) : null
  const isFutures = "maxLeverage" in market
  const networkNote = network ? ` on ${network}` : ""
  return (
    <div
      className={cn(
        "group flex items-center gap-1 pr-2 transition-colors",
        active ? "bg-accent" : "hover:bg-accent/50",
      )}
    >
      <button
        role="option"
        aria-selected={active}
        aria-label={`Switch to the ${market.symbol} market${networkNote}`}
        data-vivid-target={`pick-pair-${rowKey}`}
        data-vivid-label={`Switch to the ${market.symbol} market${networkNote}`}
        onClick={() => onSelect(rowKey)}
        className="flex min-w-0 flex-1 items-center justify-between gap-2 py-2.5 pl-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
      >
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <CoinAvatar
            symbol={"coinName" in market ? market.coinName : market.symbol}
            src={"icon" in market ? market.icon : undefined}
            size="md"
          />
          <span className="truncate">{market.symbol}</span>
          <span className="shrink-0 text-[10px] font-medium text-subtle">
            {isFutures ? "PERP" : quoteOf(market)}
          </span>
          {isFutures && (
            <span className="shrink-0 rounded bg-primary/[0.12] px-1 py-0.5 text-[9px] font-bold text-primary">
              {market.maxLeverage}×
            </span>
          )}
          {network && (
            <span className="shrink-0 truncate rounded bg-surface-sunken px-1 py-0.5 text-[9px] font-medium text-subtle">
              {network}
            </span>
          )}
        </span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          ${fmtPx(market.price)}
        </span>
      </button>
      <button
        aria-label={pinned ? `Unpin ${market.symbol}` : `Pin ${market.symbol}`}
        aria-pressed={pinned}
        onClick={() => onTogglePin(rowKey)}
        className={cn(
          // p-2.5 below lg: pinning is what makes a 9,000-row registry
          // navigable, and it was a 22px target behind a hover that phones
          // cannot perform.
          "shrink-0 rounded p-2.5 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 lg:p-1",
          pinned
            ? "text-primary"
            : "text-subtle opacity-100 hover:text-foreground focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100",
        )}
      >
        <HugeiconsIcon
          icon={StarIcon}
          className="h-3.5 w-3.5"
          fill={pinned ? "currentColor" : "none"}
        />
      </button>
    </div>
  )
}

export function MarketPicker({
  list,
  selected,
  onSelect,
  variant = "rail",
  autoFocus = false,
  className,
}: {
  list: readonly AnyMarket[]
  /** The selected row's identity — `marketRowKey`, never a bare symbol. */
  selected: string
  onSelect: (rowKey: string) => void
  variant?: "rail" | "popover"
  autoFocus?: boolean
  className?: string
}) {
  const [search, setSearch] = React.useState("")
  const [chain, setChain] = React.useState<string>(ALL_CHAINS)
  const [limit, setLimit] = React.useState(PAGE_SIZE)
  const { favorites, recents, toggleFavorite } = useMarketPrefs()
  const listRef = React.useRef<HTMLDivElement>(null)

  const index = React.useMemo(() => buildSpotIndex(list), [list])
  const chains = React.useMemo(() => chainOptionsFor(list), [list])

  // A chain that disappears when the market tab flips (futures rows carry no
  // network) must not leave an invisible filter pinned to an empty list.
  React.useEffect(() => {
    if (chain !== ALL_CHAINS && !chains.some((c) => c.id === chain)) setChain(ALL_CHAINS)
  }, [chain, chains])

  const results = React.useMemo(
    () => searchSpotMarkets(index, { query: search, chain, favorites }),
    [index, search, chain, favorites],
  )

  // A new query or chain is a new list; showing page four of the old one is
  // both wrong and a scroll position nobody asked for.
  React.useEffect(() => {
    setLimit(PAGE_SIZE)
    listRef.current?.scrollTo({ top: 0 })
  }, [search, chain])

  const shown = React.useMemo(() => results.slice(0, limit), [results, limit])
  const more = results.length - shown.length

  /* Extend when the end of the list comes into view. The sentinel sits inside
     the scroller, so this is the scroll position doing the asking rather than
     a scroll handler firing on every pixel. */
  const sentinelRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const node = sentinelRef.current
    if (!node || more <= 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setLimit((current) => current + PAGE_SIZE)
        }
      },
      { root: listRef.current, rootMargin: "200px" },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [more])

  /* Recents are their own short section rather than more rows floated to the
     top: a pair you traded an hour ago is a different claim from a pair you
     pinned, and merging them makes both unreadable. They're suppressed while
     searching — a query is an explicit request, and answering it with history
     is how a search box loses trust. */
  const recentRows = React.useMemo(() => {
    if (search.trim() || chain !== ALL_CHAINS) return []
    const byKey = new Map(list.map((m) => [marketRowKey(m), m]))
    const out: AnyMarket[] = []
    for (const key of recents) {
      const m = byKey.get(key)
      if (m && !favorites.has(key)) out.push(m)
      if (out.length === 4) break
    }
    return out
  }, [recents, list, search, chain, favorites])

  const pinnedCount = React.useMemo(
    () => results.filter((m) => favorites.has(marketRowKey(m))).length,
    [results, favorites],
  )

  const rowProps = (m: AnyMarket) => ({
    market: m,
    active: marketRowKey(m) === selected,
    pinned: favorites.has(marketRowKey(m)),
    onSelect,
    onTogglePin: toggleFavorite,
  })

  const isRail = variant === "rail"
  const querying = search.trim().length > 0

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="shrink-0 px-3 pb-2 pt-3">
        {isRail && (
          <Eyebrow className="text-[10px]">
            Markets{list.length > 0 && ` · ${results.length.toLocaleString()} of ${list.length.toLocaleString()}`}
          </Eyebrow>
        )}
        <div className={cn("relative", isRail && "mt-2")}>
          <HugeiconsIcon
            icon={Search01Icon}
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Symbol, pair, chain or address…"
            aria-label="Search markets"
            autoFocus={autoFocus}
            data-vivid-target="markets-search"
            data-vivid-label="Filter the market list"
            className="w-full rounded-xl bg-surface-sunken py-2 pl-8 pr-3 text-sm outline-none transition-shadow placeholder:text-subtle focus-visible:ring-2 focus-visible:ring-primary/40"
          />
        </div>

        {/* Chain chips. Absent for futures, where every row is one venue and a
            row of chips claiming otherwise would be noise. */}
        {chains.length > 1 && (
          <div className="slim-scroll -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
            {[{ id: ALL_CHAINS, label: "All", count: list.length }, ...chains].map((c) => (
              <button
                key={c.id}
                onClick={() => setChain(c.id)}
                aria-pressed={chain === c.id}
                data-vivid-target={`filter-chain-${c.id}`}
                data-vivid-label={`Show only ${c.label} markets`}
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  chain === c.id
                    ? "bg-primary/[0.14] text-primary"
                    : "bg-surface-sunken text-muted-foreground hover:text-foreground",
                )}
              >
                {c.label}
                <span className="ml-1 tabular-nums opacity-60">{c.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        ref={listRef}
        className={cn(
          "slim-scroll min-h-0 overflow-y-auto pb-2",
          isRail ? "flex-1" : "max-h-72",
        )}
        role="listbox"
        aria-label="Market list"
      >
        {list.length === 0 ? (
          // Markets still loading — hold the layout with quiet rows. An empty
          // registry looks identical here; the ticket carries the honest
          // "markets are unavailable" message, this list only holds space.
          Array.from({ length: isRail ? 12 : 6 }).map((_, i) => (
            <div key={i} className="mx-3 my-1.5 h-9 animate-pulse rounded-lg bg-surface-sunken/70" />
          ))
        ) : results.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <p className="text-xs text-muted-foreground">No markets match.</p>
            {chain !== ALL_CHAINS && (
              <button
                onClick={() => setChain(ALL_CHAINS)}
                className="mt-2 text-xs font-semibold text-primary hover:underline"
              >
                Search every chain
              </button>
            )}
          </div>
        ) : (
          <>
            {recentRows.length > 0 && (
              <>
                <SectionLabel>Recent</SectionLabel>
                {recentRows.map((m) => (
                  <MarketRow key={`recent-${marketRowKey(m)}`} {...rowProps(m)} />
                ))}
              </>
            )}
            {!querying && pinnedCount > 0 && <SectionLabel>Pinned</SectionLabel>}
            {shown.map((m, i) => (
              <React.Fragment key={marketRowKey(m)}>
                {/* The heading appears once, where the pinned run ends. */}
                {!querying && pinnedCount > 0 && i === pinnedCount && (
                  <SectionLabel>All markets</SectionLabel>
                )}
                <MarketRow {...rowProps(m)} />
              </React.Fragment>
            ))}

            {/* The end of the page. Scrolling here extends the list; the
                button is the same action for anyone who cannot, or whose
                browser withholds IntersectionObserver. */}
            {more > 0 && (
              <div ref={sentinelRef} className="px-3 py-3">
                <button
                  type="button"
                  onClick={() => setLimit((current) => current + PAGE_SIZE)}
                  data-vivid-target="markets-load-more"
                  data-vivid-label="Load more markets"
                  className="w-full rounded-lg bg-surface-sunken py-2 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  Load {Math.min(more, PAGE_SIZE)} more · {more.toLocaleString()} left
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pb-1 pt-2.5">
      <Eyebrow className="text-[9px]">{children}</Eyebrow>
    </div>
  )
}

"use client"

/**
 * All markets: the preview's table panel (components/markets-unauth/market-table.tsx)
 * on the page's real lists.
 *
 * Kept from the preview: the header with search, the underline tabs, sortable
 * column heads, favourite stars, the 7-day curve, the Trade action and the
 * phone list with its sort pills. Swapped for the real page's behaviour:
 *  · the tabs are the page's own (Total, Main, Spot, Futures) plus the
 *    preview's Favorites; they still drive the whole page, as before;
 *  · the chain filter stays (spot), as a dropdown beside search;
 *  · Trade is the preview's one button, routed through the registry: straight
 *    to the market, a chain chooser when there are several, "Not listed" when
 *    there are none;
 *  · futures show their own columns (funding, open interest);
 *  · only the rendering is paged, 50 rows at a time.
 * The preview's 24h high / low columns are left out: no feed carries them.
 */

import * as React from "react"
import Link from "next/link"
import { ArrowDown01Icon, Cancel01Icon, Search01Icon, StarIcon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { ChangeChip, Icon, Panel, PanelTitle, PillTabs, Spark, UnderlineTabs, ViewSelect } from "@/components/dashboard/redesign/ui"
import { tradeHref, type RegistryRow } from "@/hooks/useSpotRegistry"
import { chainLabel, ALL_CHAINS } from "@/lib/spot-market-search"
import { formatFunding, formatLarge, formatPrice, type MarketTab, type SortKey } from "@/lib/markets-view"
import type { CoinData, FuturesMarket } from "@/lib/actions"

export type TableTab = MarketTab | "Favorites"
export const TABLE_TABS: TableTab[] = ["Total", "Main", "Spot", "Futures", "Favorites"]

type SparkLookup = (symbol: string) => { prices: number[]; change24h: number } | null | undefined

/* ── Pieces ───────────────────────────────────────────────────────────── */

function FavoriteButton({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      aria-label={on ? `Remove ${label} from favourites` : `Add ${label} to favourites`}
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-lg transition-all duration-200 hover:bg-foreground/[0.05] active:scale-90",
        on ? "text-primary" : "text-muted-foreground/40 hover:text-muted-foreground",
      )}
    >
      <Icon icon={StarIcon} className={cn("size-4 transition-transform duration-300", on && "scale-110 fill-primary")} />
    </button>
  )
}

const TRADE_BTN =
  "inline-flex h-8 items-center rounded-[10px] border border-primary/50 px-4 text-[12.5px] font-semibold text-primary transition-all duration-200 hover:border-primary hover:bg-primary hover:text-primary-foreground hover:shadow-[0_6px_18px_-6px_color-mix(in_oklab,var(--primary)_60%,transparent)]"

/**
 * The preview's single Trade button, routed through the registry with the
 * previous page's rules: one market goes straight there; an asset on several
 * chains opens a chooser (WETH on Arbitrum and on Ethereum are different
 * markets, and guessing is how an order lands on the wrong chain); an asset
 * on none says "Not listed"; while the registry loads, the button waits.
 */
function TradeAction({ symbol, rows }: { symbol: string; rows: RegistryRow[] | undefined }) {
  const [open, setOpen] = React.useState(false)
  const wrap = React.useRef<HTMLSpanElement>(null)
  React.useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("pointerdown", onDown)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("pointerdown", onDown)
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  if (!rows) return <span className="skel inline-block h-8 w-[74px] rounded-[10px]" aria-hidden />
  if (rows.length === 0) {
    return (
      <span className="inline-flex h-8 cursor-default items-center whitespace-nowrap rounded-[10px] border border-foreground/[0.08] px-3 text-[12px] font-semibold text-muted-foreground/60" title={`${symbol} isn't listed for trading`}>
        Not listed
      </span>
    )
  }
  if (rows.length === 1) {
    const row = rows[0]
    return (
      <Link href={tradeHref(row)} title={`Trade ${row.symbol}/${row.quote} on ${chainLabel(row.networkId)}`} className={TRADE_BTN}>
        Trade
      </Link>
    )
  }
  return (
    <span ref={wrap} className="relative inline-flex">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} className={TRADE_BTN}>
        Trade
      </button>
      {open && (
        <span role="menu" className="absolute right-0 top-[calc(100%+6px)] z-20 flex min-w-[168px] flex-col rounded-xl border border-foreground/[0.08] bg-popover/95 p-1 text-left shadow-[0_18px_40px_-12px_rgb(0_0_0/0.5)] backdrop-blur-xl">
          <span className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">Trade {symbol} on</span>
          {rows.map((row) => (
            <Link
              key={row.id}
              role="menuitem"
              href={tradeHref(row)}
              className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-[13px] font-semibold text-foreground transition-colors hover:bg-foreground/[0.05] hover:text-primary"
            >
              {chainLabel(row.networkId)}
              <span className="text-[11.5px] font-medium text-muted-foreground">{row.symbol}/{row.quote}</span>
            </Link>
          ))}
        </span>
      )}
    </span>
  )
}

/** Where a phone row goes: straight to the market when there is exactly one,
 *  else the trade screen by symbol (as the movers and tape link). */
function rowHref(symbol: string, rows: RegistryRow[] | undefined) {
  return rows?.length === 1 ? tradeHref(rows[0]) : `/trade?symbol=${encodeURIComponent(symbol)}`
}

function SortHead({ label, k, sortBy, sortAsc, onSort, className }: { label: string; k: SortKey; sortBy: SortKey; sortAsc: boolean; onSort: (k: SortKey) => void; className?: string }) {
  const on = sortBy === k
  return (
    <th className={cn("py-3 pr-5 text-right font-medium", className)} aria-sort={on ? (sortAsc ? "ascending" : "descending") : undefined}>
      <button type="button" onClick={() => onSort(k)} className={cn("inline-flex items-center gap-1 transition-colors hover:text-foreground", on && "text-foreground")}>
        {label}
        <Icon icon={ArrowDown01Icon} className={cn("size-3.5 transition-all duration-300", on ? "opacity-100" : "opacity-0", on && sortAsc && "rotate-180")} strokeWidth={2} />
      </button>
    </th>
  )
}

function SparkCell({ points }: { points: number[] | null | undefined }) {
  if (points === undefined) return <span className="skel block h-[30px] w-24 rounded-sm" />
  if (!points) return <span className="block w-24" />
  return <Spark points={points} width={96} height={30} />
}

function SkeletonRows({ rows = 8 }: { rows?: number }) {
  return (
    <div className="flex flex-col pt-2" role="status" aria-label="Loading markets">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-t border-foreground/[0.045] px-5 py-3.5 first:border-t-0" aria-hidden>
          <span className="skel size-8 shrink-0 rounded-full" />
          <span className="flex flex-1 flex-col gap-1.5">
            <span className="skel h-3.5 w-24 rounded" />
            <span className="skel h-3 w-16 rounded" />
          </span>
          <span className="skel hidden h-[30px] w-24 rounded-sm md:block" />
          <span className="flex flex-col items-end gap-1.5">
            <span className="skel h-3.5 w-20 rounded" />
            <span className="skel h-4 w-14 rounded-md" />
          </span>
        </div>
      ))}
    </div>
  )
}

const MOBILE_SORTS: { key: SortKey; label: string }[] = [
  { key: "marketCap", label: "Market cap" },
  { key: "volume24h", label: "Volume" },
  { key: "change24h", label: "Change" },
]

/* ── Panel ────────────────────────────────────────────────────────────── */

export function MarketTable(props: {
  tab: TableTab
  onTab: (t: TableTab) => void
  search: string
  onSearch: (q: string) => void
  sortBy: SortKey
  sortAsc: boolean
  onSort: (k: SortKey) => void
  onMobileSort: (k: SortKey) => void
  chains: { id: string; label: string; count: number }[]
  chain: string
  onChain: (id: string) => void
  favorites: Set<string>
  onFavorite: (id: string) => void
  /** Spot / Total / Main / Favorites rows, already filtered and sorted. */
  coins: CoinData[]
  futures: FuturesMarket[]
  total: number
  loading: boolean
  page: { start: number; end: number; safePage: number; pageCount: number }
  onPage: (p: number) => void
  spark: SparkLookup
  changeOf: (c: CoinData) => number
  tradable: (symbol: string) => RegistryRow[] | undefined
}) {
  const { tab, coins, futures, page, spark, changeOf, tradable, favorites } = props
  const isFutures = tab === "Futures"
  const pagedCoins = coins.slice(page.start, page.end)
  const pagedFutures = futures.slice(page.start, page.end)
  const shown = isFutures ? futures.length : coins.length

  const tabs = TABLE_TABS.map((t) => ({
    key: t,
    label:
      t === "Favorites" ? (
        <span className="inline-flex items-center gap-1.5">
          Favorites
          <span className="rounded-md bg-foreground/[0.07] px-1.5 text-[11px] tabular-nums text-muted-foreground">{favorites.size}</span>
        </span>
      ) : (
        t
      ),
  }))

  const title = isFutures ? "Futures markets" : tab === "Spot" ? "Spot markets" : tab === "Main" ? "Main markets" : tab === "Favorites" ? "Favorites" : "All markets"
  const noun = isFutures ? "contracts" : tab === "Spot" ? "markets" : "assets"

  return (
    <Panel className="pb-2">
      <div className="flex flex-col gap-4 px-4 pt-5 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-2.5">
            <PanelTitle className="text-[17px]">{title}</PanelTitle>
            <span className="text-[13px] tabular-nums text-muted-foreground">
              {props.loading ? "Loading…" : `${shown} of ${props.total} ${noun}`}
            </span>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
          {/* The chain filter (spot only: a perp is one venue), as a quiet
              dropdown beside search so the preview's header stays as drawn. */}
          {!isFutures && props.chains.length > 1 && (
            <ViewSelect
              align="right"
              options={[{ key: ALL_CHAINS, label: "All chains" }, ...props.chains.map((c) => ({ key: c.id, label: c.label, count: c.count }))]}
              value={props.chain}
              onChange={props.onChain}
              className="shrink-0"
            />
          )}
          <label className="group flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-foreground/[0.07] bg-foreground/[0.025] px-3.5 transition-colors focus-within:border-primary/40 sm:w-[260px] sm:flex-none">
            <Icon icon={Search01Icon} className="size-4 text-muted-foreground group-focus-within:text-primary" />
            <span className="sr-only">Search markets</span>
            <input
              value={props.search}
              onChange={(e) => props.onSearch(e.target.value)}
              placeholder="Search by name or symbol"
              className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-muted-foreground/70"
            />
            {props.search && (
              <button type="button" onClick={() => props.onSearch("")} aria-label="Clear search" className="text-muted-foreground hover:text-foreground">
                <Icon icon={Cancel01Icon} className="size-4" />
              </button>
            )}
          </label>
          </div>
        </div>

        <div className="border-b border-foreground/[0.06]">
          <UnderlineTabs id="market-tab" options={tabs} value={tab} onChange={props.onTab} className="scrollbar-none -mx-1 overflow-x-auto" />
        </div>

        {/* Phone-only sort: the column heads that do this on desktop aren't there. */}
        {!isFutures && (
          <div className="flex items-center justify-between gap-2 md:hidden">
            <span className="text-[12px] font-medium text-muted-foreground">Sort by</span>
            <PillTabs
              id="market-sort-mobile"
              size="sm"
              options={MOBILE_SORTS}
              value={MOBILE_SORTS.some((s) => s.key === props.sortBy) ? props.sortBy : "marketCap"}
              onChange={props.onMobileSort}
            />
          </div>
        )}
      </div>

      {props.loading ? (
        <SkeletonRows />
      ) : shown === 0 ? (
        <div className="flex flex-col items-center gap-1 px-6 py-16 text-center">
          <p className="text-[14px] font-semibold text-foreground">
            {tab === "Favorites" && favorites.size === 0 ? "No favourites yet" : props.search ? `No ${noun} match “${props.search}”` : `No ${noun} to show`}
          </p>
          <p className="text-[13px] text-muted-foreground">
            {tab === "Favorites" && favorites.size === 0 ? "Tap the star on any market to pin it here." : "Try a ticker like SOL, or another tab or chain."}
          </p>
        </div>
      ) : isFutures ? (
        <FuturesRows rows={pagedFutures} start={page.start} sortBy={props.sortBy} sortAsc={props.sortAsc} onSort={props.onSort} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden pt-2 md:block">
            <table className="w-full border-separate border-spacing-0 text-left">
              <thead>
                <tr className="text-[12px] font-medium text-muted-foreground">
                  <th className="w-[52px] py-3 pl-5" />
                  <th className="w-[44px] py-3 font-medium">#</th>
                  <th className="py-3 font-medium">Market</th>
                  <SortHead label="Price" k="price" {...props} />
                  <SortHead label="24h Change" k="change24h" {...props} />
                  <SortHead label="24h Volume" k="volume24h" {...props} className="hidden lg:table-cell" />
                  <SortHead label="Market Cap" k="marketCap" {...props} className="hidden xl:table-cell" />
                  <th className="py-3 pr-5 text-right font-medium">Last 7 days</th>
                  <th className="py-3 pr-6 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {pagedCoins.map((c, i) => {
                  const sp = spark(c.symbol)
                  return (
                    <tr key={c.id} className="group text-[13.5px] tabular-nums">
                      <td className="ds-cell h-[64px] pl-5">
                        <FavoriteButton label={c.symbol} on={favorites.has(c.id)} onToggle={() => props.onFavorite(c.id)} />
                      </td>
                      <td className="ds-cell text-muted-foreground">{page.start + i + 1}</td>
                      <td className="ds-cell">
                        <span className="flex items-center gap-3">
                          <CoinAvatar symbol={c.symbol} src={c.image} size="lg" className="size-8 ring-1 ring-foreground/10" />
                          <span className="flex min-w-0 flex-col leading-tight">
                            <span className="font-semibold text-foreground">{c.symbol}</span>
                            <span className="truncate text-[12px] text-muted-foreground">{c.name}</span>
                          </span>
                        </span>
                      </td>
                      <td className="ds-cell pr-5 text-right font-semibold text-foreground">${formatPrice(c.price)}</td>
                      <td className="ds-cell pr-5 text-right">
                        <ChangeChip value={changeOf(c)} size="sm" />
                      </td>
                      <td className="ds-cell hidden pr-5 text-right text-foreground/90 lg:table-cell">{formatLarge(c.volume24h)}</td>
                      <td className="ds-cell hidden pr-5 text-right text-foreground/70 xl:table-cell">{formatLarge(c.marketCap)}</td>
                      <td className="ds-cell pr-5">
                        <span className="flex justify-end">
                          <SparkCell points={sp === undefined ? undefined : sp?.prices ?? null} />
                        </span>
                      </td>
                      <td className="ds-cell pr-6 text-right">
                        <TradeAction symbol={c.symbol} rows={tradable(c.symbol)} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Phone list */}
          <ul className="flex flex-col pt-2 md:hidden">
            {pagedCoins.map((c) => (
              <li key={c.id} className="flex items-center gap-2 border-t border-foreground/[0.05] py-1 pl-2 pr-4 first:border-t-0">
                <FavoriteButton label={c.symbol} on={favorites.has(c.id)} onToggle={() => props.onFavorite(c.id)} />
                <Link href={rowHref(c.symbol, tradable(c.symbol))} className="flex min-w-0 flex-1 items-center gap-3 py-2.5">
                  <CoinAvatar symbol={c.symbol} src={c.image} size="lg" className="size-9 ring-1 ring-foreground/10" />
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="truncate text-[14px] font-semibold text-foreground">{c.symbol}</span>
                    <span className="truncate text-[12px] text-muted-foreground">{c.volume24h > 0 ? `Vol ${formatLarge(c.volume24h)}` : c.name}</span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <span className="text-[14px] font-semibold tabular-nums text-foreground">${formatPrice(c.price)}</span>
                    <ChangeChip value={changeOf(c)} size="sm" className="h-5 min-w-[58px] text-[11px]" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {page.pageCount > 1 && !props.loading && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-foreground/[0.06] px-4 pt-3 md:px-6">
          <span className="text-[12.5px] tabular-nums text-muted-foreground">
            {page.start + 1}–{page.end} of {shown}
          </span>
          <span className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => props.onPage(Math.max(0, page.safePage - 1))}
              disabled={page.safePage === 0}
              className="h-8 rounded-[10px] border border-foreground/[0.08] px-3 text-[12.5px] font-semibold text-foreground/85 transition-colors hover:border-primary/35 hover:text-primary disabled:pointer-events-none disabled:opacity-35"
            >
              Previous
            </button>
            <span className="px-1 text-[12.5px] tabular-nums text-muted-foreground">
              {page.safePage + 1} / {page.pageCount}
            </span>
            <button
              type="button"
              onClick={() => props.onPage(Math.min(page.pageCount - 1, page.safePage + 1))}
              disabled={page.safePage >= page.pageCount - 1}
              className="h-8 rounded-[10px] border border-foreground/[0.08] px-3 text-[12.5px] font-semibold text-foreground/85 transition-colors hover:border-primary/35 hover:text-primary disabled:pointer-events-none disabled:opacity-35"
            >
              Next
            </button>
          </span>
        </div>
      )}
    </Panel>
  )
}

/* ── Futures ──────────────────────────────────────────────────────────── */

function futuresHref(symbol: string) {
  return `/trade?market=futures&symbol=${encodeURIComponent(symbol)}`
}

function FuturesRows({ rows, start, sortBy, sortAsc, onSort }: { rows: FuturesMarket[]; start: number; sortBy: SortKey; sortAsc: boolean; onSort: (k: SortKey) => void }) {
  const head = { sortBy, sortAsc, onSort }
  return (
    <>
      <div className="hidden pt-2 md:block">
        <table className="w-full border-separate border-spacing-0 text-left">
          <thead>
            <tr className="text-[12px] font-medium text-muted-foreground">
              <th className="w-[44px] py-3 pl-6 font-medium">#</th>
              <th className="py-3 font-medium">Contract</th>
              <SortHead label="Mark price" k="price" {...head} />
              <SortHead label="24h Change" k="change24h" {...head} />
              <th className="py-3 pr-5 text-right font-medium">Funding</th>
              <SortHead label="24h Volume" k="volume24h" {...head} className="hidden lg:table-cell" />
              <SortHead label="Open interest" k="marketCap" {...head} className="hidden xl:table-cell" />
              <th className="py-3 pr-6 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m, i) => (
              <tr key={m.symbol} className="text-[13.5px] tabular-nums">
                <td className="ds-cell h-[64px] pl-6 text-muted-foreground">{start + i + 1}</td>
                <td className="ds-cell">
                  <span className="flex items-center gap-3">
                    <CoinAvatar symbol={m.baseAsset} src={m.image} size="lg" className="size-8 ring-1 ring-foreground/10" />
                    <span className="flex min-w-0 flex-col leading-tight">
                      <span className="font-semibold text-foreground">{m.symbol}</span>
                      <span className="truncate text-[12px] text-muted-foreground">Perp · {m.maxLeverage}× max</span>
                    </span>
                  </span>
                </td>
                <td className="ds-cell pr-5 text-right font-semibold text-foreground">${formatPrice(m.markPrice)}</td>
                <td className="ds-cell pr-5 text-right">
                  <ChangeChip value={m.change24h} size="sm" />
                </td>
                <td className={cn("ds-cell pr-5 text-right font-medium", m.fundingRate >= 0 ? "text-credit" : "text-debit")}>{formatFunding(m.fundingRate)}</td>
                <td className="ds-cell hidden pr-5 text-right text-foreground/90 lg:table-cell">{formatLarge(m.volume24h)}</td>
                <td className="ds-cell hidden pr-5 text-right text-foreground/70 xl:table-cell">{formatLarge(m.openInterest)}</td>
                <td className="ds-cell pr-6 text-right">
                  <Link
                    href={futuresHref(m.symbol)}
                    className="inline-flex h-8 items-center rounded-[10px] border border-primary/50 px-4 text-[12.5px] font-semibold text-primary transition-all duration-200 hover:border-primary hover:bg-primary hover:text-primary-foreground"
                  >
                    Trade
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col pt-2 md:hidden">
        {rows.map((m) => (
          <li key={m.symbol} className="border-t border-foreground/[0.05] first:border-t-0">
            <Link href={futuresHref(m.symbol)} className="flex items-center gap-3 px-4 py-3">
              <CoinAvatar symbol={m.baseAsset} src={m.image} size="lg" className="size-9 ring-1 ring-foreground/10" />
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-[14px] font-semibold text-foreground">{m.symbol}</span>
                <span className="truncate text-[12px] text-muted-foreground">Funding {formatFunding(m.fundingRate)}</span>
              </span>
              <span className="flex flex-col items-end gap-1">
                <span className="text-[14px] font-semibold tabular-nums text-foreground">${formatPrice(m.markPrice)}</span>
                <ChangeChip value={m.change24h} size="sm" className="h-5 min-w-[58px] text-[11px]" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}

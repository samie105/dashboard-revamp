"use client"

/**
 * All markets — the full list, in the dashboard's table language.
 *
 *  · Every row has one Trade action; the chains it routes through are its
 *    tooltip, not a run of links.
 *  · The 7d curve reads the same series that produced the 24h figure, so a
 *    green row never carries a red chart.
 *  · Columns sort; money columns sort high-to-low first, rank low-to-high.
 *  · Favourites feed their own tab.
 *  · On a phone the table becomes a list with a sort control, because nine
 *    columns at 375px is a spreadsheet, not a screen.
 */

import * as React from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { ArrowDown01Icon, Cancel01Icon, Search01Icon, StarIcon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import {
  MARKETS,
  QUOTE_TABS,
  formatCompact,
  formatPrice,
  tradeHref,
  type Market,
  type Quote,
  type SortKey,
} from "@/components/markets-unauth/market-data"
import { ChangeChip, Icon, Panel, PanelTitle, PillTabs, Spark, UnderlineTabs } from "@/components/redesign/ui"

type Tab = Quote | "all" | "favorites"

type Column = { key: SortKey; label: string; className?: string }

/* Responsive columns: high/low and market cap appear only where they fit. */
const COLUMNS: Column[] = [
  { key: "price", label: "Price" },
  { key: "changePct", label: "24h Change" },
  { key: "high", label: "24h High", className: "hidden 2xl:table-cell" },
  { key: "low", label: "24h Low", className: "hidden 2xl:table-cell" },
  { key: "volumeUsd", label: "24h Volume", className: "hidden lg:table-cell" },
  { key: "marketCapUsd", label: "Market Cap", className: "hidden xl:table-cell" },
]

const MOBILE_SORTS: { key: SortKey; label: string }[] = [
  { key: "marketCapUsd", label: "Market cap" },
  { key: "volumeUsd", label: "Volume" },
  { key: "changePct", label: "Change" },
]

/** USDT pairs read in dollars; BTC/ETH pairs in their quote. */
function Price({ m, className }: { m: Market; className?: string }) {
  return (
    <span className={cn("tabular-nums", className)}>
      {m.quote === "USDT" && "$"}
      {formatPrice(m.price)}
      {m.quote !== "USDT" && <span className="ml-1 text-[11px] font-medium text-muted-foreground">{m.quote}</span>}
    </span>
  )
}

function FavoriteButton({ m, on, onToggle }: { m: Market; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      aria-label={on ? `Remove ${m.base}/${m.quote} from favourites` : `Add ${m.base}/${m.quote} to favourites`}
      className={cn(
        "flex size-7 items-center justify-center rounded-lg transition-all duration-200 hover:bg-white/[0.05] active:scale-90",
        on ? "text-primary" : "text-muted-foreground/40 hover:text-muted-foreground",
      )}
    >
      <Icon icon={StarIcon} className={cn("size-4 transition-transform duration-300", on && "scale-110 fill-primary")} />
    </button>
  )
}

export function MarketTable() {
  const [tab, setTab] = React.useState<Tab>("all")
  const [query, setQuery] = React.useState("")
  const [sort, setSort] = React.useState<SortKey>("marketCapUsd")
  const [desc, setDesc] = React.useState(true)
  const [favorites, setFavorites] = React.useState<string[]>(["BTC-USDT", "SOL-USDT", "TON-USDT"])

  const toggleFavorite = (id: string) => setFavorites((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]))

  const sortBy = (key: SortKey) => {
    if (key === sort) setDesc((d) => !d)
    else {
      setSort(key)
      setDesc(key !== "rank")
    }
  }

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = MARKETS.filter((m) => {
      if (tab === "favorites" && !favorites.includes(m.id)) return false
      if (tab !== "all" && tab !== "favorites" && m.quote !== tab) return false
      return !q || m.base.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
    })
    if (sort === "rank") return desc ? [...filtered].reverse() : filtered
    return [...filtered].sort((a, b) => (desc ? b[sort] - a[sort] : a[sort] - b[sort]))
  }, [tab, query, sort, desc, favorites])

  const tabs = QUOTE_TABS.map((t) => ({
    key: t.key as Tab,
    label:
      t.key === "favorites" ? (
        <span className="inline-flex items-center gap-1.5">
          Favorites
          <span className="rounded-md bg-white/[0.07] px-1.5 text-[11px] tabular-nums text-muted-foreground">{favorites.length}</span>
        </span>
      ) : (
        t.label
      ),
  }))

  return (
    <Panel className="pb-2">
      <div className="flex flex-col gap-4 px-4 pt-5 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-2.5">
            <PanelTitle className="text-[17px]">All markets</PanelTitle>
            <span className="text-[13px] tabular-nums text-muted-foreground">
              {rows.length} of {MARKETS.length} pairs
            </span>
          </div>
          <label className="group flex h-10 w-full items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 transition-colors focus-within:border-primary/40 sm:w-[260px]">
            <Icon icon={Search01Icon} className="size-4 text-muted-foreground group-focus-within:text-primary" />
            <span className="sr-only">Search markets</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or symbol"
              className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-muted-foreground/70"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="text-muted-foreground hover:text-foreground">
                <Icon icon={Cancel01Icon} className="size-4" />
              </button>
            )}
          </label>
        </div>

        <div className="flex items-end justify-between gap-3 border-b border-white/[0.06]">
          <UnderlineTabs id="market-quote" options={tabs} value={tab} onChange={setTab} className="scrollbar-none -mx-1 overflow-x-auto" />
        </div>

        {/* Phone-only sort: the table headers that do this on desktop aren't there. */}
        <div className="flex items-center justify-between gap-2 md:hidden">
          <span className="text-[12px] font-medium text-muted-foreground">Sort by</span>
          <PillTabs
            id="market-sort-mobile"
            size="sm"
            options={MOBILE_SORTS.map((s) => ({ key: s.key, label: s.label }))}
            value={MOBILE_SORTS.some((s) => s.key === sort) ? sort : "marketCapUsd"}
            onChange={(k) => {
              setSort(k)
              setDesc(true)
            }}
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-1 px-6 py-16 text-center">
          <p className="text-[14px] font-semibold text-foreground">{tab === "favorites" ? "No favourites yet" : `No markets match “${query}”`}</p>
          <p className="text-[13px] text-muted-foreground">
            {tab === "favorites" ? "Tap the star on any market to pin it here." : "Try a ticker like SOL, or switch the quote tab."}
          </p>
        </div>
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
                  {COLUMNS.map((c) => (
                    <th key={c.key} className={cn("py-3 pr-5 text-right font-medium", c.className)}>
                      <button
                        type="button"
                        onClick={() => sortBy(c.key)}
                        className={cn("inline-flex items-center gap-1 transition-colors hover:text-foreground", sort === c.key && "text-foreground")}
                      >
                        {c.label}
                        <Icon
                          icon={ArrowDown01Icon}
                          className={cn(
                            "size-3.5 transition-all duration-300",
                            sort === c.key ? "opacity-100" : "opacity-0",
                            sort === c.key && !desc && "rotate-180",
                          )}
                          strokeWidth={2}
                        />
                      </button>
                    </th>
                  ))}
                  <th className="py-3 pr-5 text-right font-medium">Last 7 days</th>
                  <th className="w-[112px] py-3 pr-6 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {rows.map((m, i) => (
                    <motion.tr
                      key={m.id}
                      layout="position"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                      className="group text-[13.5px] tabular-nums"
                    >
                      <td className="dash-cell h-[64px] pl-5">
                        <FavoriteButton m={m} on={favorites.includes(m.id)} onToggle={() => toggleFavorite(m.id)} />
                      </td>
                      <td className="dash-cell text-muted-foreground">{i + 1}</td>
                      <td className="dash-cell">
                        <Link href={tradeHref(m)} className="flex items-center gap-3">
                          <CoinAvatar symbol={m.base} size="lg" className="size-8 ring-1 ring-white/10" />
                          <span className="flex min-w-0 flex-col leading-tight">
                            <span className="font-semibold text-foreground">
                              {m.base}
                              <span className="font-medium text-muted-foreground">/{m.quote}</span>
                            </span>
                            <span className="truncate text-[12px] text-muted-foreground">{m.name}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="dash-cell pr-5 text-right font-semibold text-foreground">
                        <Price m={m} />
                      </td>
                      <td className="dash-cell pr-5 text-right">
                        <ChangeChip value={m.changePct} size="sm" />
                      </td>
                      <td className="dash-cell hidden pr-5 text-right text-foreground/70 2xl:table-cell">{formatPrice(m.high)}</td>
                      <td className="dash-cell hidden pr-5 text-right text-foreground/70 2xl:table-cell">{formatPrice(m.low)}</td>
                      <td className="dash-cell hidden pr-5 text-right text-foreground/90 lg:table-cell">${formatCompact(m.volumeUsd)}</td>
                      <td className="dash-cell hidden pr-5 text-right text-foreground/70 xl:table-cell">${formatCompact(m.marketCapUsd)}</td>
                      <td className="dash-cell pr-5">
                        <span className="flex justify-end">
                          <Spark points={m.series} width={96} height={30} />
                        </span>
                      </td>
                      <td className="dash-cell pr-6 text-right">
                        <Link
                          href={tradeHref(m)}
                          title={`Trade ${m.base}/${m.quote} on ${m.chains.join(", ")}`}
                          className="inline-flex h-8 items-center rounded-[10px] border border-primary/50 px-4 text-[12.5px] font-semibold text-primary transition-all duration-200 hover:border-primary hover:bg-primary hover:text-primary-foreground hover:shadow-[0_6px_18px_-6px_rgb(250_190_20/0.6)]"
                        >
                          Trade
                        </Link>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {/* Phone list */}
          <ul className="flex flex-col pt-2 md:hidden">
            {rows.map((m) => (
              <li key={m.id} className="flex items-center gap-2 border-t border-white/[0.05] py-1 pl-2 pr-4 first:border-t-0">
                <FavoriteButton m={m} on={favorites.includes(m.id)} onToggle={() => toggleFavorite(m.id)} />
                <Link href={tradeHref(m)} className="flex min-w-0 flex-1 items-center gap-3 py-2.5">
                  <CoinAvatar symbol={m.base} size="lg" className="size-9 ring-1 ring-white/10" />
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="truncate text-[14px] font-semibold text-foreground">
                      {m.base}
                      <span className="font-medium text-muted-foreground">/{m.quote}</span>
                    </span>
                    <span className="truncate text-[12px] text-muted-foreground">Vol ${formatCompact(m.volumeUsd)}</span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <Price m={m} className="text-[14px] font-semibold text-foreground" />
                    <ChangeChip value={m.changePct} size="sm" className="h-5 min-w-[58px] text-[11px]" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  )
}

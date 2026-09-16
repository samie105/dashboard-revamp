"use client"

/**
 * All markets.
 *
 * The live table's problems, in order of how much they cost:
 *
 *   · Market Cap and Volume are "—" on every row, and both are sortable
 *     columns, so two of the seven columns are furniture.
 *   · The 7D chart is red on every row regardless of direction. Here the
 *     curve takes tone="direction" and reads the series that produced the
 *     percentage beside it, so the two cannot disagree.
 *   · The Trade column reads "Not listed" on a third of the rows — a dead end
 *     where the page's primary action belongs — and on the rows that do have
 *     venues it prints a run of chain links with duplicates ("Solana ↗
 *     Ethereum ↗ Arbitrum ↗ Arbitrum ↗"). Every row here has one Trade button;
 *     the chains it routes through are a tooltip on that button.
 *   · No high/low, so the day's range is invisible.
 *   · The star column has no favourites filter to feed.
 */

import * as React from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { StarIcon, Search01Icon, Cancel01Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { CardShell, CardHeader, EmptyState, Segmented } from "@/components/ui/system"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { CARD_HUE } from "@/components/ui/surface"
import { MiniSpark } from "@/components/ui/charts"
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

type Tab = Quote | "all" | "favorites"

const COLUMNS: { key: SortKey; label: string; align: "left" | "right"; hideBelow?: "sm" | "lg" }[] = [
  { key: "rank", label: "#", align: "left" },
  { key: "price", label: "Price", align: "right" },
  { key: "changePct", label: "24h", align: "right" },
  { key: "high", label: "24h high", align: "right", hideBelow: "lg" },
  { key: "low", label: "24h low", align: "right", hideBelow: "lg" },
  { key: "volumeUsd", label: "Volume", align: "right", hideBelow: "sm" },
  { key: "marketCapUsd", label: "Market cap", align: "right", hideBelow: "lg" },
]

export function MarketTable() {
  const [tab, setTab] = React.useState<Tab>("all")
  const [query, setQuery] = React.useState("")
  const [sort, setSort] = React.useState<SortKey>("marketCapUsd")
  const [desc, setDesc] = React.useState(true)
  const [favorites, setFavorites] = React.useState<string[]>(["BTC-USDT", "SOL-USDT", "TON-USDT"])

  const toggleFavorite = (id: string) =>
    setFavorites((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]))

  const sortBy = (key: SortKey) => {
    if (key === sort) setDesc((d) => !d)
    else {
      setSort(key)
      // Rank ascends by default; every money column descends, because the
      // question is always "which is biggest".
      setDesc(key !== "rank")
    }
  }

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = MARKETS.filter((m) => {
      if (tab === "favorites" && !favorites.includes(m.id)) return false
      if (tab !== "all" && tab !== "favorites" && m.quote !== tab) return false
      if (!q) return true
      return m.base.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
    })
    if (sort === "rank") return desc ? [...filtered].reverse() : filtered
    return [...filtered].sort((a, b) => (desc ? b[sort] - a[sort] : a[sort] - b[sort]))
  }, [tab, query, sort, desc, favorites])

  return (
    <CardShell className={CARD_HUE}>
      <CardHeader title="All markets" subtitle={`${rows.length} of ${MARKETS.length} pairs`} />

      <div className="scrollbar-none overflow-x-auto border-t border-border/40 px-4 py-2.5">
        <Segmented
          size="sm"
          options={QUOTE_TABS.map((t) => ({
            key: t.key,
            label: t.key === "favorites" ? `${t.label} (${favorites.length})` : t.label,
          }))}
          value={tab}
          onChange={(k) => setTab(k as Tab)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-y border-border/40 px-4 py-2.5">
        <label className="relative flex w-full min-w-[12rem] items-center sm:w-auto sm:max-w-xs sm:flex-1">
          <HugeiconsIcon
            icon={Search01Icon}
            className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-muted-foreground"
          />
          <span className="sr-only">Search markets</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or symbol"
            className="h-9 w-full min-w-0 rounded-full bg-foreground/[0.05] pl-8 pr-8 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
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
        <span className="ml-auto hidden text-[12px] tabular-nums text-muted-foreground/70 sm:block">
          Sorted by {COLUMNS.find((c) => c.key === sort)?.label ?? sort} · {desc ? "high to low" : "low to high"}
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={tab === "favorites" ? "No favourites yet" : "No markets match"}
          description={
            tab === "favorites"
              ? "Star a market in the table to pin it here."
              : "Try a different symbol, or switch the quote-currency tab."
          }
        />
      ) : (
        <div className="slim-scroll min-w-0 flex-1 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left lg:min-w-[980px]">
            <thead>
              <tr className="border-b border-border/40 text-[11px] uppercase tracking-[0.07em] text-muted-foreground">
                <th className="w-8 px-2 py-2.5" />
                <th className="px-4 py-2.5 font-semibold">Market</th>
                {COLUMNS.filter((c) => c.key !== "rank").map((c) => (
                  <th
                    key={c.key}
                    className={cn(
                      "px-4 py-2.5 font-semibold",
                      c.align === "right" && "text-right",
                      c.hideBelow === "sm" && "hidden sm:table-cell",
                      c.hideBelow === "lg" && "hidden lg:table-cell",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => sortBy(c.key)}
                      className={cn(
                        "ws-icon-mono inline-flex items-center gap-1 uppercase tracking-[0.07em] transition-colors hover:text-foreground",
                        sort === c.key && "text-foreground",
                      )}
                    >
                      {c.label}
                      {sort === c.key && (
                        <HugeiconsIcon
                          icon={ArrowDown01Icon}
                          className={cn("h-3 w-3 transition-transform", !desc && "rotate-180")}
                        />
                      )}
                    </button>
                  </th>
                ))}
                <th className="px-4 py-2.5 text-right font-semibold">7d</th>
                <th className="px-4 py-2.5 text-right font-semibold">Trade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/25">
              {rows.map((m, i) => (
                <Row
                  key={m.id}
                  m={m}
                  index={i}
                  favorite={favorites.includes(m.id)}
                  onToggleFavorite={() => toggleFavorite(m.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CardShell>
  )
}

function Row({
  m,
  index,
  favorite,
  onToggleFavorite,
}: {
  m: Market
  index: number
  favorite: boolean
  onToggleFavorite: () => void
}) {
  const up = m.changePct >= 0
  return (
    <tr className="group transition-colors hover:bg-accent/40">
      <td className="px-2 py-3">
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-pressed={favorite}
          aria-label={favorite ? `Unstar ${m.base}` : `Star ${m.base}`}
          className={cn(
            // The star's COLOUR is its state, so it opts out of the two-tone rule.
            "ws-icon-mono mx-auto flex h-6 w-6 items-center justify-center rounded-full transition-colors",
            favorite ? "text-primary" : "text-muted-foreground/40 hover:text-muted-foreground",
          )}
        >
          <HugeiconsIcon icon={StarIcon} className={cn("h-3.5 w-3.5", favorite && "fill-primary")} />
        </button>
      </td>

      {/* The cell is a link too, not just the Trade button — a row you can
          read but not click is the thing the reference gets right. */}
      <td className="px-4 py-3">
        <Link href={tradeHref(m)} className="flex items-center gap-2.5">
          <span className="w-5 shrink-0 text-[11.5px] tabular-nums text-muted-foreground/50">
            {index + 1}
          </span>
          <CoinAvatar symbol={m.base} size="lg" />
          <span className="flex min-w-0 flex-col">
            <span className="flex items-baseline gap-1 leading-tight">
              <span className="text-[13.5px] font-semibold">{m.base}</span>
              <span className="text-[11px] text-muted-foreground">/{m.quote}</span>
            </span>
            <span className="truncate text-[11.5px] leading-tight text-muted-foreground">{m.name}</span>
          </span>
        </Link>
      </td>

      <td className="whitespace-nowrap px-4 py-3 text-right text-[13.5px] font-medium tabular-nums">
        {formatPrice(m.price)}
      </td>
      <td
        className={cn(
          "whitespace-nowrap px-4 py-3 text-right text-[13.5px] font-semibold tabular-nums",
          up ? "text-credit" : "text-debit",
        )}
      >
        {up ? "+" : ""}
        {m.changePct.toFixed(2)}%
      </td>
      <td className="hidden whitespace-nowrap px-4 py-3 text-right text-[13px] tabular-nums text-muted-foreground lg:table-cell">
        {formatPrice(m.high)}
      </td>
      <td className="hidden whitespace-nowrap px-4 py-3 text-right text-[13px] tabular-nums text-muted-foreground lg:table-cell">
        {formatPrice(m.low)}
      </td>
      <td className="hidden whitespace-nowrap px-4 py-3 text-right text-[13px] tabular-nums sm:table-cell">
        ${formatCompact(m.volumeUsd)}
      </td>
      <td className="hidden whitespace-nowrap px-4 py-3 text-right text-[13px] tabular-nums text-muted-foreground lg:table-cell">
        ${formatCompact(m.marketCapUsd)}
      </td>

      <td className="px-4 py-3">
        <span className="flex justify-end">
          <MiniSpark points={m.series} tone="direction" width={76} height={26} />
        </span>
      </td>

      <td className="px-4 py-3">
        <span className="flex justify-end">
          {/* One destination, always. The chains it routes through are a title,
              not eight links competing with each other. */}
          <Link
            href={tradeHref(m)}
            title={`Trade ${m.base}/${m.quote} on ${m.chains.join(", ")}`}
            className="inline-flex items-center rounded-full border border-primary/40 px-3.5 py-1.5 text-[12.5px] font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            Trade
          </Link>
        </span>
      </td>
    </tr>
  )
}

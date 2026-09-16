"use client"

/**
 * The balances table — the page's centre of gravity.
 *
 * What makes this read as a trading platform rather than a list of coins:
 *
 *  · THREE quantity columns, not one. Total is what you own; Available is what
 *    you can act on right now; In order is what an open order has already
 *    spoken for. Collapsing them into a single "Amount" is what makes a
 *    withdrawal fail at the confirm step for reasons nobody can see.
 *  · Per-row ACTIONS. The whole reason to look up a balance is to do something
 *    with it, and making the user navigate away to a different screen to do it
 *    is the difference between a wallet and a statement.
 *  · A working toolbar — search, account filter, hide-zero — because a real
 *    wallet has 200 rows and the table is unusable without one.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, Cancel01Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { CardShell, CardHeader, EmptyState, Segmented, WeightBar } from "@/components/ui/system"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { CARD_HUE } from "@/components/preview/surface"
import {
  BALANCE_ROWS,
  BALANCES_TOTAL,
  formatAmount,
  formatPrice,
  formatUSD,
  type AccountKey,
} from "@/components/wallet-unauth/wallet-data"

type Filter = "all" | AccountKey

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "spot", label: "Spot" },
  { key: "funding", label: "Funding" },
  { key: "futures", label: "Futures" },
  { key: "earn", label: "Earn" },
]

/** Row actions. Muted text, never gold: gold is the page's primary action
 *  (Deposit, top of page), and six gold links per row would outshout it. */
const ROW_ACTIONS = ["Deposit", "Withdraw", "Trade", "Convert"]

export function Balances() {
  const [query, setQuery] = React.useState("")
  const [filter, setFilter] = React.useState<Filter>("all")
  const [hideZero, setHideZero] = React.useState(true)

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return BALANCE_ROWS.filter((r) => {
      if (hideZero && r.total === 0) return false
      if (filter !== "all" && r.account !== filter) return false
      if (!q) return true
      return r.symbol.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)
    })
  }, [query, filter, hideZero])

  const shown = rows.reduce((s, r) => s + r.value, 0)
  const hiddenCount = BALANCE_ROWS.length - rows.length

  return (
    <CardShell className={CARD_HUE}>
      <CardHeader
        title="Balances"
        subtitle={`${rows.length} of ${BALANCE_ROWS.length} assets · ${formatUSD(shown)}`}
        right={
          <div className="flex items-center gap-2">
            <label className="relative hidden items-center sm:flex">
              <HugeiconsIcon
                icon={Search01Icon}
                className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground"
              />
              <span className="sr-only">Search assets</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                className="h-8 w-36 rounded-full bg-foreground/[0.05] pl-7.5 pr-7 text-[13px] outline-none ring-0 placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="ws-icon-mono absolute right-2 text-muted-foreground hover:text-foreground"
                >
                  <HugeiconsIcon icon={Cancel01Icon} className="h-3.5 w-3.5" />
                </button>
              )}
            </label>
            <Segmented size="sm" options={FILTERS} value={filter} onChange={setFilter} />
          </div>
        }
      />

      {/* Toolbar row — the search collapses into it on a phone, and the
          hide-zero switch lives here rather than in the header because it
          changes the TABLE, not the card. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border/40 px-4 py-2.5">
        <label className="relative flex items-center sm:hidden">
          <HugeiconsIcon
            icon={Search01Icon}
            className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground"
          />
          <span className="sr-only">Search assets</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search assets"
            className="h-8 w-44 rounded-full bg-foreground/[0.05] pl-7.5 pr-3 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
          />
        </label>
        <label className="flex cursor-pointer select-none items-center gap-2 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground">
          <input
            type="checkbox"
            checked={hideZero}
            onChange={(e) => setHideZero(e.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--primary)]"
          />
          Hide zero balances
        </label>
        <span className="text-[12px] tabular-nums text-muted-foreground/70">
          {hiddenCount > 0 ? `${hiddenCount} hidden` : "Showing all"}
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No assets match"
          description="Try a different symbol, or switch the account filter back to All."
        />
      ) : (
        <div className="slim-scroll min-w-0 flex-1 overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border/40 text-[11px] uppercase tracking-[0.07em] text-muted-foreground">
                <th className="px-4 py-2.5 font-semibold">Asset</th>
                <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                <th className="px-4 py-2.5 text-right font-semibold">Available</th>
                <th className="px-4 py-2.5 text-right font-semibold">In order</th>
                <th className="px-4 py-2.5 text-right font-semibold">Value</th>
                <th className="px-4 py-2.5 text-right font-semibold">24h</th>
                <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/25">
              {rows.map((r) => (
                <tr key={r.symbol} className="group transition-colors hover:bg-accent/40">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2.5">
                      <CoinAvatar symbol={r.symbol} size="lg" />
                      <span className="flex min-w-0 flex-col">
                        <span className="text-[13.5px] font-semibold leading-tight">{r.symbol}</span>
                        <span className="truncate text-[11.5px] leading-tight text-muted-foreground">
                          {/* Single-chain assets name their own network, and
                              "Bitcoin · Bitcoin" is noise. */}
                          {r.network === r.name ? r.name : `${r.name} · ${r.network}`}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="flex flex-col items-end">
                      <span className="text-[13.5px] font-medium tabular-nums">{formatAmount(r.total)}</span>
                      <span className="text-[11.5px] tabular-nums text-muted-foreground">
                        {formatPrice(r.price)}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-[13px] tabular-nums">{formatAmount(r.available)}</td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right text-[13px] tabular-nums",
                      // Reserved funds are the surprise this table exists to
                      // prevent, so a non-zero figure gets caution, not grey.
                      r.inOrder > 0 ? "text-warning" : "text-muted-foreground/50",
                    )}
                  >
                    {formatAmount(r.inOrder)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex flex-col items-end gap-1">
                      <span className="text-[13.5px] font-semibold tabular-nums">{formatUSD(r.value)}</span>
                      <span className="flex w-24 items-center gap-1.5">
                        <WeightBar
                          pct={r.share}
                          rank={BALANCE_ROWS.findIndex((x) => x.symbol === r.symbol)}
                          className="flex-1"
                        />
                        <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                          {r.share.toFixed(1)}%
                        </span>
                      </span>
                    </span>
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right text-[13px] font-semibold tabular-nums",
                      r.changePct >= 0 ? "text-credit" : "text-debit",
                    )}
                  >
                    {r.changePct >= 0 ? "+" : ""}
                    {r.changePct.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3">
                    {/* Revealed on hover on a pointer device, always present
                        for keyboard and touch — a control you can only reach
                        with a mouse is a control half your users do not have. */}
                    <span className="flex items-center justify-end gap-3 opacity-60 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      {ROW_ACTIONS.map((a) => (
                        <button
                          key={a}
                          type="button"
                          className="whitespace-nowrap text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
                        >
                          {a}
                        </button>
                      ))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border/40 text-[12.5px]">
                <td className="px-4 py-3 font-semibold uppercase tracking-[0.07em] text-muted-foreground" colSpan={4}>
                  Shown
                </td>
                <td className="px-4 py-3 text-right text-[14px] font-semibold tabular-nums">
                  {formatUSD(shown)}
                </td>
                <td className="px-4 py-3 text-right text-[12px] tabular-nums text-muted-foreground">
                  {((shown / BALANCES_TOTAL) * 100).toFixed(1)}%
                </td>
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </CardShell>
  )
}

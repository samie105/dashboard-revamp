"use client"

/**
 * Markets + Holdings — the wide pair.
 *
 * Left: the tape, as a real table (symbol · price · 24h · sparkline · volume)
 * rather than a list of chips, because a market row is read by COLUMN.
 * Right: what you actually own, ranked, with the allocation ladder carrying
 * each row's share — the same colours the hero's donut uses.
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import { CardShell, CardHeader, Segmented, WeightBar } from "@/components/ui/system"
import { MiniSpark } from "@/components/ui/charts"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { CARD_HUE } from "@/components/ui/surface"
import {
  GAINERS,
  HOLDINGS,
  HOLDINGS_TOTAL,
  LOSERS,
  WATCHLIST,
  formatAmount,
  formatPrice,
  formatUSD,
  type Market,
} from "@/components/dashboard-unauth/demo-data"

type Tab = "gainers" | "losers" | "watchlist"

const TABS: { key: Tab; label: string }[] = [
  { key: "gainers", label: "Gainers" },
  { key: "losers", label: "Losers" },
  { key: "watchlist", label: "Watchlist" },
]

const TAB_DATA: Record<Tab, Market[]> = {
  gainers: GAINERS,
  losers: LOSERS,
  watchlist: WATCHLIST,
}

function compactVolume(v: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v)
}

export function Markets() {
  const [tab, setTab] = React.useState<Tab>("gainers")
  const rows = TAB_DATA[tab]

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      {/* ── The tape ────────────────────────────────────────────────────── */}
      <CardShell className={CARD_HUE}>
        <CardHeader
          title="Markets"
          subtitle="24h moves across the book"
          right={
            <Segmented
              size="sm"
              options={TABS}
              value={tab}
              onChange={setTab}
            />
          }
        />
        <div className="slim-scroll min-w-0 flex-1 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left">
            <thead>
              <tr className="border-y border-border/40 text-[11px] uppercase tracking-[0.07em] text-muted-foreground">
                <th className="px-4 py-2 font-semibold">Asset</th>
                <th className="px-4 py-2 text-right font-semibold">Price</th>
                <th className="px-4 py-2 text-right font-semibold">24h</th>
                <th className="px-4 py-2 text-right font-semibold">Last 24h</th>
                <th className="px-4 py-2 text-right font-semibold">Volume</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/25">
              {rows.map((m) => (
                <tr key={m.symbol} className="group transition-colors hover:bg-accent/40">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2.5">
                      <CoinAvatar symbol={m.symbol} size="md" />
                      <span className="flex min-w-0 flex-col">
                        <span className="text-[13.5px] font-semibold leading-tight">{m.symbol}</span>
                        <span className="truncate text-[11.5px] leading-tight text-muted-foreground">{m.name}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-[13.5px] font-medium tabular-nums">
                    {formatPrice(m.price)}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right text-[13.5px] font-semibold tabular-nums",
                      m.changePct >= 0 ? "text-credit" : "text-debit",
                    )}
                  >
                    {m.changePct >= 0 ? "+" : ""}
                    {m.changePct.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex justify-end">
                      <MiniSpark points={m.points} width={72} height={24} />
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-[13px] tabular-nums text-muted-foreground">
                    ${compactVolume(m.volume)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardShell>

      {/* ── What you hold ───────────────────────────────────────────────── */}
      <CardShell className={CARD_HUE}>
        <CardHeader
          title="Your holdings"
          subtitle={`${HOLDINGS.length} assets · ${formatUSD(HOLDINGS_TOTAL)}`}
          link={{ label: "View all", href: "#" }}
        />
        <div className="flex flex-1 flex-col divide-y divide-border/25">
          {HOLDINGS.slice(0, 6).map((h, i) => {
            const share = (h.value / HOLDINGS_TOTAL) * 100
            return (
              <div key={h.symbol} className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-accent/40">
                <div className="flex items-center gap-3">
                  <CoinAvatar symbol={h.symbol} size="md" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13.5px] font-semibold leading-tight">{h.symbol}</span>
                    <span className="truncate text-[11.5px] leading-tight text-muted-foreground">{h.network}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end">
                    <span className="text-[13.5px] font-medium tabular-nums">{formatUSD(h.value)}</span>
                    <span className="text-[11.5px] tabular-nums text-muted-foreground">
                      {formatAmount(h.amount)} {h.symbol}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <WeightBar pct={share} rank={i} className="flex-1" />
                  <span className="w-11 shrink-0 text-right text-[11.5px] font-medium tabular-nums text-muted-foreground">
                    {share.toFixed(1)}%
                  </span>
                  <span
                    className={cn(
                      "w-14 shrink-0 text-right text-[11.5px] font-semibold tabular-nums",
                      h.changePct >= 0 ? "text-credit" : "text-debit",
                    )}
                  >
                    {h.changePct >= 0 ? "+" : ""}
                    {h.changePct.toFixed(2)}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </CardShell>
    </div>
  )
}

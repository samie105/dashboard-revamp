"use client"

/**
 * The desk — open risk on the left, what just happened on the right.
 *
 * Positions and orders share one pane behind a segmented control because they
 * are the same question at two stages ("what is live?"), and splitting them
 * put two half-empty tables side by side.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDownLeft01Icon,
  ArrowUpRight01Icon,
  CoinsSwapIcon,
  CreditCardIcon,
  Layers01Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { CardShell, CardHeader, EmptyState, Segmented } from "@/components/ui/system"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { CARD_HUE } from "@/components/ui/surface"
import {
  ACTIVITY,
  ORDERS,
  POSITIONS,
  POSITIONS_PNL,
  formatPrice,
  formatUSD,
  type Activity,
} from "@/components/dashboard-unauth/demo-data"

type Tab = "positions" | "orders"

/** Fixed minute offsets — no clock read, so this is identical on both sides
 *  of hydration. */
function ago(minutes: number): string {
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`
  const days = Math.round(minutes / 1440)
  return days === 1 ? "Yesterday" : `${days}d ago`
}

const ACTIVITY_ICON: Record<Activity["kind"], typeof ArrowDownLeft01Icon> = {
  receive: ArrowDownLeft01Icon,
  send: ArrowUpRight01Icon,
  swap: CoinsSwapIcon,
  buy: CreditCardIcon,
  stake: Layers01Icon,
}

export function Desk() {
  const [tab, setTab] = React.useState<Tab>("positions")

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      {/* ── Live risk ───────────────────────────────────────────────────── */}
      <CardShell className={CARD_HUE}>
        <CardHeader
          title="Open risk"
          subtitle={
            tab === "positions"
              ? `${POSITIONS.length} positions · ${POSITIONS_PNL >= 0 ? "+" : "−"}${formatUSD(Math.abs(POSITIONS_PNL))} unrealised`
              : `${ORDERS.length} orders resting`
          }
          right={
            <Segmented
              size="sm"
              options={[
                { key: "positions", label: "Positions" },
                { key: "orders", label: "Orders" },
              ]}
              value={tab}
              onChange={setTab}
            />
          }
        />

        <div className="slim-scroll min-w-0 flex-1 overflow-x-auto">
          {tab === "positions" ? (
            <table className="w-full min-w-[620px] border-collapse text-left">
              <thead>
                <tr className="border-y border-border/40 text-[11px] uppercase tracking-[0.07em] text-muted-foreground">
                  <th className="px-4 py-2 font-semibold">Market</th>
                  <th className="px-4 py-2 text-right font-semibold">Size</th>
                  <th className="px-4 py-2 text-right font-semibold">Entry</th>
                  <th className="px-4 py-2 text-right font-semibold">Mark</th>
                  <th className="px-4 py-2 text-right font-semibold">Liq.</th>
                  <th className="px-4 py-2 text-right font-semibold">PnL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/25">
                {POSITIONS.map((p) => (
                  <tr key={p.symbol} className="transition-colors hover:bg-accent/40">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2.5">
                        <CoinAvatar symbol={p.symbol} size="md" />
                        <span className="flex min-w-0 flex-col">
                          <span className="whitespace-nowrap text-[13.5px] font-semibold leading-tight">{p.symbol}-PERP</span>
                          <span className="flex items-center gap-1.5 leading-tight">
                            <span
                              className={cn(
                                "text-[11.5px] font-semibold uppercase",
                                p.side === "long" ? "text-credit" : "text-debit",
                              )}
                            >
                              {p.side}
                            </span>
                            <span className="rounded bg-foreground/[0.08] px-1 text-[10.5px] font-semibold tabular-nums text-muted-foreground">
                              {p.leverage}×
                            </span>
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-[13px] tabular-nums">{formatUSD(p.size, { maxFrac: 0 })}</td>
                    <td className="px-4 py-3 text-right text-[13px] tabular-nums text-muted-foreground">
                      {formatPrice(p.entry)}
                    </td>
                    <td className="px-4 py-3 text-right text-[13px] font-medium tabular-nums">{formatPrice(p.mark)}</td>
                    <td className="px-4 py-3 text-right text-[13px] tabular-nums text-warning">{formatPrice(p.liq)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="flex flex-col items-end">
                        <span
                          className={cn(
                            "text-[13.5px] font-semibold tabular-nums",
                            p.pnl >= 0 ? "text-credit" : "text-debit",
                          )}
                        >
                          {p.pnl >= 0 ? "+" : "−"}
                          {formatUSD(Math.abs(p.pnl))}
                        </span>
                        <span
                          className={cn(
                            "text-[11.5px] tabular-nums",
                            p.pnl >= 0 ? "text-credit/80" : "text-debit/80",
                          )}
                        >
                          {p.pnlPct >= 0 ? "+" : ""}
                          {p.pnlPct.toFixed(2)}%
                        </span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : ORDERS.length === 0 ? (
            <EmptyState title="Nothing resting" description="Limit and stop orders you place will wait here." />
          ) : (
            <table className="w-full min-w-[520px] border-collapse text-left">
              <thead>
                <tr className="border-y border-border/40 text-[11px] uppercase tracking-[0.07em] text-muted-foreground">
                  <th className="px-4 py-2 font-semibold">Market</th>
                  <th className="px-4 py-2 font-semibold">Type</th>
                  <th className="px-4 py-2 text-right font-semibold">Trigger</th>
                  <th className="px-4 py-2 text-right font-semibold">Amount</th>
                  <th className="px-4 py-2 text-right font-semibold">Filled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/25">
                {ORDERS.map((o) => (
                  <tr key={`${o.symbol}-${o.type}-${o.price}`} className="transition-colors hover:bg-accent/40">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2.5">
                        <CoinAvatar symbol={o.symbol} size="md" />
                        <span className="flex flex-col">
                          <span className="text-[13.5px] font-semibold leading-tight">{o.symbol}</span>
                          <span
                            className={cn(
                              "text-[11.5px] font-semibold uppercase leading-tight",
                              o.side === "buy" ? "text-credit" : "text-debit",
                            )}
                          >
                            {o.side}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-muted-foreground">{o.type}</td>
                    <td className="px-4 py-3 text-right text-[13px] font-medium tabular-nums">
                      {formatPrice(o.price)}
                    </td>
                    <td className="px-4 py-3 text-right text-[13px] tabular-nums">
                      {o.amount} {o.symbol}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center justify-end gap-2">
                        <span className="h-1.5 w-14 overflow-hidden rounded-full bg-foreground/[0.08]">
                          <span
                            className="block h-full rounded-full bg-primary/70"
                            style={{ width: `${o.filledPct}%` }}
                          />
                        </span>
                        <span className="w-8 text-right text-[11.5px] tabular-nums text-muted-foreground">
                          {o.filledPct}%
                        </span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </CardShell>

      {/* ── Activity ────────────────────────────────────────────────────── */}
      <CardShell className={CARD_HUE}>
        <CardHeader title="Activity" subtitle="Your latest movements" link={{ label: "View all", href: "#" }} />
        <div className="flex flex-1 flex-col divide-y divide-border/25">
          {ACTIVITY.map((a) => (
            <div key={a.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40">
              <span
                // The glyph's colour is the direction, so it opts out of the
                // global two-tone gold treatment.
                className={cn(
                  "ws-icon-mono flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                  a.direction === "credit" && "bg-credit-chip text-credit",
                  a.direction === "debit" && "bg-debit-chip text-debit",
                  a.direction === "neutral" && "bg-convert-chip text-primary",
                )}
              >
                <HugeiconsIcon icon={ACTIVITY_ICON[a.kind]} className="h-[17px] w-[17px]" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[13.5px] font-medium leading-tight">{a.title}</span>
                <span className="truncate text-[11.5px] leading-tight text-muted-foreground">
                  {a.detail} · {ago(a.minutesAgo)}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end">
                <span
                  className={cn(
                    "text-[13px] font-semibold tabular-nums",
                    a.direction === "credit" && "text-credit",
                    a.direction === "debit" && "text-debit",
                    a.direction === "neutral" && "text-foreground",
                  )}
                >
                  {a.amount}
                </span>
                <span className="text-[11.5px] tabular-nums text-muted-foreground">{a.usd}</span>
              </span>
            </div>
          ))}
        </div>
      </CardShell>
    </div>
  )
}

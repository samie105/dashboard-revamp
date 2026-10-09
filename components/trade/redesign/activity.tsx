"use client"

/**
 * The preview's activity panel (components/trade-unauth/activity.tsx) on real
 * data: one panel, a dropdown that picks the view, a table that fits from md
 * up, and a card per row on phones.
 *
 *  · Open orders — the account's resting orders, with the real Cancel
 *  · Positions   — the account's perp positions, with the real Close
 *  · Order history — the spot ledger (swaps), with its reconciled status;
 *    a row opens the same detail sheet as before
 *
 * The preview's Balances view is left out: this screen has no balances
 * source, and adding one would be a new request. Busy states ("Closing…",
 * "Cancelling…") and every handler are the trade screen's own, unchanged.
 */

import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { Cancel01Icon, ChartLineData02Icon, Clock01Icon, Invoice03Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { Figure, Icon, Panel, ViewSelect } from "@/components/dashboard/redesign/ui"
import { formatPrice } from "@/components/trade/redesign/candle-chart"
import { OrderDetailModal, bucketOf, resolveOrder, sizeText, statusOf, timeOf, usd, type ResolvedOrder } from "@/components/trade/orders-panel"
import { useSpotOrders } from "@/hooks/useSpotOrders"
import { useSpotRegistry } from "@/hooks/useSpotRegistry"
import type { HlAccount } from "@/lib/crypto-api"

export type ActivityView = "open" | "positions" | "history"

const th = "whitespace-nowrap px-3 pb-2.5 pt-1 text-left text-[11.5px] font-medium text-muted-foreground"
const td = "whitespace-nowrap border-t border-foreground/[0.045] px-3 py-3 text-[12.5px] tabular-nums"

function SideTag({ side }: { side: "buy" | "sell" | "long" | "short" }) {
  const good = side === "buy" || side === "long"
  return <span className={cn("rounded-md px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.04em]", good ? "bg-credit/[0.12] text-credit" : "bg-debit/[0.12] text-debit")}>{side}</span>
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-6 py-12 text-center text-[13px] text-muted-foreground">{children}</p>
}

function Loading() {
  return (
    <div className="flex flex-col gap-2 px-4 py-4" role="status" aria-label="Loading">
      {Array.from({ length: 3 }, (_, i) => (
        <span key={i} className="skel h-9 w-full rounded-lg" aria-hidden />
      ))}
    </div>
  )
}

/** A phone row: identity on top, figures in a two-column grid, action last. */
function MobileCard({ head, cells, action, onClick }: { head: React.ReactNode; cells: [string, React.ReactNode][]; action?: React.ReactNode; onClick?: () => void }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClick}
      className={cn("flex flex-col gap-3 border-t border-foreground/[0.05] px-4 py-3.5 first:border-t-0", onClick && "cursor-pointer active:bg-foreground/[0.03]")}
    >
      <div className="flex items-center justify-between gap-2">{head}</div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
        {cells.map(([k, v]) => (
          <div key={k} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-[10.5px] text-muted-foreground">{k}</dt>
            <dd className="truncate text-[12.5px] font-semibold tabular-nums text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
      {action}
    </motion.li>
  )
}

const pairCell = (base: string, label: string, icon?: string | null) => (
  <span className="flex items-center gap-2 font-semibold">
    <CoinAvatar symbol={base} src={icon ?? undefined} size="sm" />
    {label}
  </span>
)

const fillBar = (pct: number) => (
  <span className="flex items-center gap-2">
    <span className="relative h-1 w-12 overflow-hidden rounded-full bg-foreground/[0.08]">
      <span className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${pct}%` }} />
    </span>
    <span className="text-muted-foreground">{pct}%</span>
  </span>
)

const statusChip = (status: string) => {
  const s = statusOf(status)
  const b = bucketOf(status)
  return (
    <span className={cn("rounded-md px-1.5 py-0.5 text-[10.5px] font-bold uppercase", b === "filled" ? "bg-credit/[0.1] text-credit" : b === "failed" ? "bg-debit/[0.1] text-debit" : "bg-foreground/[0.06] text-muted-foreground")}>
      {s.label}
    </span>
  )
}

/** How far the mark has travelled from entry towards liquidation, 0–100. */
function riskOf(side: "long" | "short", entry: number, mark: number, liq: number | null) {
  if (!liq) return 0
  const span = Math.abs(entry - liq) || 1
  const against = side === "long" ? mark < entry : mark > entry
  return against ? Math.min(100, (Math.abs(mark - entry) / span) * 100) : 0
}

export function ActivityPanel({
  account,
  accountLoading,
  busyKey,
  onClosePosition,
  onCancelOrder,
  defaultView,
}: {
  account: HlAccount | null
  /** The account hasn't answered yet (open orders and positions). */
  accountLoading: boolean
  busyKey: string | null
  onClosePosition: (symbol: string) => void
  onCancelOrder: (oid: number, symbol: string, market: "spot" | "futures") => void
  defaultView: ActivityView
}) {
  const [view, setView] = React.useState<ActivityView>(defaultView)
  React.useEffect(() => setView(defaultView), [defaultView])
  const [detail, setDetail] = React.useState<ResolvedOrder | null>(null)

  const open = account?.openOrders ?? []
  const positions = account?.positions ?? []
  const { orders, loading: historyLoading } = useSpotOrders()
  const registry = useSpotRegistry()
  const history = React.useMemo(() => orders.map((o) => resolveOrder(o, registry)), [orders, registry])

  const cancelBtn = (oid: number, symbol: string, market: "spot" | "futures", full?: boolean) => {
    const busy = busyKey === `cancel:${oid}`
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onCancelOrder(oid, symbol, market)
        }}
        disabled={busy}
        className={cn(
          "inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-foreground/[0.08] px-2.5 text-[12px] font-semibold text-foreground/85 transition-colors hover:border-debit/40 hover:text-debit disabled:opacity-50",
          full && "w-full",
        )}
      >
        <Icon icon={Cancel01Icon} className="size-3.5" />
        {busy ? "Cancelling…" : "Cancel"}
      </button>
    )
  }
  const closeBtn = (symbol: string, full?: boolean) => {
    const busy = busyKey === `close:${symbol}`
    return (
      <button
        type="button"
        onClick={() => onClosePosition(symbol)}
        disabled={busy}
        className={cn(
          "inline-flex h-8 items-center justify-center rounded-lg border border-foreground/[0.08] px-3 text-[12px] font-semibold text-foreground/85 transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50",
          full && "w-full",
        )}
      >
        {busy ? "Closing…" : "Close position"}
      </button>
    )
  }

  const orderPrice = (o: HlAccount["openOrders"][number]) => formatPrice(o.isTrigger ? (o.triggerPrice ?? o.limitPrice) : o.limitPrice)
  const filledPct = (o: HlAccount["openOrders"][number]) => (o.origSize > 0 ? Math.round(((o.origSize - o.size) / o.origSize) * 100) : 0)
  const placed = (ms: number) => new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })

  return (
    <Panel className="flex flex-col overflow-visible">
      <div className="flex items-center justify-between gap-3 border-b border-foreground/[0.06] px-3 py-3 md:px-4">
        <ViewSelect
          options={[
            { key: "open", label: "Open orders", count: open.length, hint: "Limit and trigger orders waiting to fill", icon: Clock01Icon },
            { key: "positions", label: "Positions", count: positions.length, hint: "Open perpetual positions", icon: ChartLineData02Icon },
            { key: "history", label: "Order history", count: history.length, hint: "Your spot orders and what became of them", icon: Invoice03Icon },
          ]}
          value={view}
          onChange={setView}
        />
        <span className="hidden text-[12px] text-muted-foreground sm:block">
          {view === "open" && "Tap a row's Cancel to pull an order"}
          {view === "positions" && "Marked to the mark price"}
          {view === "history" && "Tap a row for its details"}
        </span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={view} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="pb-2">
          {/* ── Open orders ── */}
          {view === "open" &&
            (accountLoading && !account ? (
              <Loading />
            ) : open.length === 0 ? (
              <Empty>No open orders. Limit and trigger orders you place wait here until they fill.</Empty>
            ) : (
              <>
                <table className="hidden w-full md:table">
                  <thead>
                    <tr>
                      <th className={cn(th, "pl-4")}>Pair</th>
                      <th className={th}>Side</th>
                      <th className={th}>Type</th>
                      <th className={th}>Price</th>
                      <th className={th}>Amount</th>
                      <th className={cn(th, "hidden xl:table-cell")}>Filled</th>
                      <th className={cn(th, "hidden 2xl:table-cell")}>Placed</th>
                      <th className={th} />
                    </tr>
                  </thead>
                  <tbody>
                    {open.map((o) => (
                      <tr key={o.oid}>
                        <td className={cn(td, "pl-4")}>{pairCell(o.symbol, `${o.symbol}${o.market === "futures" ? "-PERP" : ""}`)}</td>
                        <td className={td}>
                          <SideTag side={o.side} />
                        </td>
                        <td className={cn(td, "capitalize text-muted-foreground")}>
                          {o.orderType}
                          {o.reduceOnly && <span className="ml-1 text-[10px]">RO</span>}
                        </td>
                        <td className={td}>
                          {orderPrice(o)}
                          {o.isTrigger && <span className="ml-1 text-[10px] text-muted-foreground">trigger</span>}
                        </td>
                        <td className={td}>
                          <Figure mask="••••">{`${o.size} ${o.symbol}`}</Figure>
                        </td>
                        <td className={cn(td, "hidden xl:table-cell")}>{fillBar(filledPct(o))}</td>
                        <td className={cn(td, "hidden text-muted-foreground 2xl:table-cell")}>{placed(o.timestamp)}</td>
                        <td className={cn(td, "pr-4 text-right")}>{cancelBtn(o.oid, o.symbol, o.market)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <ul className="md:hidden">
                  <AnimatePresence initial={false}>
                    {open.map((o) => (
                      <MobileCard
                        key={o.oid}
                        head={
                          <>
                            {pairCell(o.symbol, `${o.symbol}${o.market === "futures" ? "-PERP" : ""}`)}
                            <span className="flex items-center gap-2">
                              <span className="text-[11.5px] capitalize text-muted-foreground">{o.orderType}</span>
                              <SideTag side={o.side} />
                            </span>
                          </>
                        }
                        cells={[
                          ["Price", orderPrice(o)],
                          ["Amount", <Figure key="a" mask="••••">{`${o.size} ${o.symbol}`}</Figure>],
                          ["Filled", fillBar(filledPct(o))],
                          ["Placed", placed(o.timestamp)],
                        ]}
                        action={cancelBtn(o.oid, o.symbol, o.market, true)}
                      />
                    ))}
                  </AnimatePresence>
                </ul>
              </>
            ))}

          {/* ── Positions ── */}
          {view === "positions" &&
            (accountLoading && !account ? (
              <Loading />
            ) : positions.length === 0 ? (
              <Empty>No open positions. Perpetual positions you open show up here, marked to the mark price.</Empty>
            ) : (
              <>
                <table className="hidden w-full md:table">
                  <thead>
                    <tr>
                      <th className={cn(th, "pl-4")}>Contract</th>
                      <th className={th}>Size</th>
                      <th className={cn(th, "hidden xl:table-cell")}>Entry</th>
                      <th className={th}>Mark</th>
                      <th className={th}>Liq. price</th>
                      <th className={cn(th, "hidden 2xl:table-cell")}>Margin</th>
                      <th className={th}>PnL (ROE)</th>
                      <th className={th} />
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((p) => {
                      const gain = p.unrealizedPnl >= 0
                      const risk = riskOf(p.side, p.entryPrice, p.markPrice, p.liquidationPrice)
                      return (
                        <tr key={p.symbol}>
                          <td className={cn(td, "pl-4")}>
                            <span className="flex items-center gap-2">
                              <CoinAvatar symbol={p.symbol} size="sm" />
                              <span className="font-semibold">{p.symbol}-PERP</span>
                              <SideTag side={p.side} />
                              <span className="text-[11px] font-semibold text-primary">{p.leverage.value}×</span>
                            </span>
                          </td>
                          <td className={td}>
                            <Figure mask="••••">{`${p.absSize.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${p.symbol}`}</Figure>
                          </td>
                          <td className={cn(td, "hidden xl:table-cell")}>{formatPrice(p.entryPrice)}</td>
                          <td className={td}>{formatPrice(p.markPrice)}</td>
                          <td className={td}>
                            {p.liquidationPrice ? (
                              <span className="flex flex-col gap-1">
                                <span className="text-warning">{formatPrice(p.liquidationPrice)}</span>
                                <span className="relative h-1 w-14 overflow-hidden rounded-full bg-foreground/[0.08]" title={`${Math.round(risk)}% of the way to liquidation`}>
                                  <span className={cn("absolute inset-y-0 left-0 rounded-full", risk > 66 ? "bg-debit" : risk > 33 ? "bg-warning" : "bg-credit")} style={{ width: `${Math.max(4, risk)}%` }} />
                                </span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className={cn(td, "hidden 2xl:table-cell")}>
                            <Figure mask="••••">{usd(p.marginUsed)}</Figure>
                          </td>
                          <td className={td}>
                            <span className={cn("font-semibold", gain ? "text-credit" : "text-debit")}>
                              <Figure mask="••••">{`${gain ? "+" : "−"}$${Math.abs(p.unrealizedPnl).toFixed(2)}`}</Figure>
                              <span className="ml-1 text-[11.5px]">
                                ({gain ? "+" : "−"}
                                {Math.abs(p.returnOnEquity * 100).toFixed(2)}%)
                              </span>
                            </span>
                          </td>
                          <td className={cn(td, "pr-4 text-right")}>{closeBtn(p.symbol)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <ul className="md:hidden">
                  <AnimatePresence initial={false}>
                    {positions.map((p) => {
                      const gain = p.unrealizedPnl >= 0
                      return (
                        <MobileCard
                          key={p.symbol}
                          head={
                            <span className="flex items-center gap-2">
                              <CoinAvatar symbol={p.symbol} size="sm" />
                              <span className="font-semibold">{p.symbol}-PERP</span>
                              <SideTag side={p.side} />
                              <span className="text-[11px] font-semibold text-primary">
                                {p.leverage.value}× <span className="capitalize text-muted-foreground">{p.leverage.type}</span>
                              </span>
                            </span>
                          }
                          cells={[
                            [
                              "PnL (ROE)",
                              <span key="p" className={gain ? "text-credit" : "text-debit"}>
                                <Figure mask="••••">{`${gain ? "+" : "−"}$${Math.abs(p.unrealizedPnl).toFixed(2)}`}</Figure> ({gain ? "+" : "−"}
                                {Math.abs(p.returnOnEquity * 100).toFixed(1)}%)
                              </span>,
                            ],
                            ["Size", <Figure key="s" mask="••••">{`${p.absSize.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${p.symbol}`}</Figure>],
                            ["Entry → Mark", `${formatPrice(p.entryPrice)} → ${formatPrice(p.markPrice)}`],
                            ["Liquidation", <span key="l" className="text-warning">{p.liquidationPrice ? formatPrice(p.liquidationPrice) : "—"}</span>],
                            ["Margin", <Figure key="m" mask="••••">{usd(p.marginUsed)}</Figure>],
                          ]}
                          action={closeBtn(p.symbol, true)}
                        />
                      )
                    })}
                  </AnimatePresence>
                </ul>
              </>
            ))}

          {/* ── History (the spot ledger) ── */}
          {view === "history" &&
            (historyLoading && history.length === 0 ? (
              <Loading />
            ) : history.length === 0 ? (
              <Empty>No orders yet. Every order you place shows up here with what you received and whether it went through.</Empty>
            ) : (
              <>
                <table className="hidden w-full md:table">
                  <thead>
                    <tr>
                      <th className={cn(th, "pl-4")}>Pair</th>
                      <th className={th}>Side</th>
                      <th className={cn(th, "hidden xl:table-cell")}>Type</th>
                      <th className={th}>Received</th>
                      <th className={th}>Value</th>
                      <th className={th}>Status</th>
                      <th className={cn(th, "pr-4 text-right")}>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row) => (
                      <tr key={row.order.id} onClick={() => setDetail(row)} className="cursor-pointer transition-colors hover:bg-foreground/[0.02]">
                        <td className={cn(td, "pl-4")}>{pairCell(row.symbol, row.symbol, row.icon)}</td>
                        <td className={td}>{row.side ? <SideTag side={row.side} /> : <span className="text-muted-foreground">—</span>}</td>
                        <td className={cn(td, "hidden text-muted-foreground xl:table-cell")}>Swap</td>
                        <td className={td}>
                          <Figure mask="••••">{sizeText(row)}</Figure>
                        </td>
                        <td className={td}>
                          <Figure mask="••••">{row.valueUsd !== null ? usd(row.valueUsd) : "—"}</Figure>
                        </td>
                        <td className={td}>{statusChip(row.order.status)}</td>
                        <td className={cn(td, "pr-4 text-right text-muted-foreground")}>{timeOf(row.order.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <ul className="md:hidden">
                  {history.map((row) => (
                    <MobileCard
                      key={row.order.id}
                      onClick={() => setDetail(row)}
                      head={
                        <>
                          {pairCell(row.symbol, row.symbol, row.icon)}
                          <span className="flex items-center gap-2">
                            {row.side && <SideTag side={row.side} />}
                            {statusChip(row.order.status)}
                          </span>
                        </>
                      }
                      cells={[
                        ["Received", <Figure key="r" mask="••••">{sizeText(row)}</Figure>],
                        ["Value", <Figure key="v" mask="••••">{row.valueUsd !== null ? usd(row.valueUsd) : "—"}</Figure>],
                        ["Type", "Swap"],
                        ["Time", timeOf(row.order.createdAt)],
                      ]}
                    />
                  ))}
                </ul>
              </>
            ))}
        </motion.div>
      </AnimatePresence>
      <OrderDetailModal row={detail} onClose={() => setDetail(null)} />
    </Panel>
  )
}

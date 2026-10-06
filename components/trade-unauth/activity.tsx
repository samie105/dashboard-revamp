"use client"

/**
 * The terminal's bottom panel: open orders, positions, order history and
 * balances — one panel, one table, and a styled dropdown that picks the view.
 *
 * It used to be four tabs over a horizontally scrolling table. On a phone the
 * tab row overflowed and the whole table — column headers included — slid
 * sideways, which is the opposite of readable. Now:
 *   · the view is a ViewSelect (count on the button, a hint per option)
 *   · md and up: a real table whose columns FIT — secondary columns drop at
 *     narrower widths instead of forcing a scroll
 *   · phones: each row becomes a card with its figures in a tidy grid
 *
 * Orders and positions are live terminal state: the forms push into them,
 * Cancel and Close take them out, and positions mark against the perp's mark
 * price so PnL, ROE and the margin-health bar are computed, not typed.
 */

import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { Cancel01Icon, ChartLineData02Icon, Clock01Icon, Invoice03Icon, Wallet02Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { PAIRS, balanceOf, formatPrice, pairById, type Order } from "@/components/trade-unauth/trade-data"
import { perpById, positionState, type Position } from "@/components/trade-unauth/futures-data"
import { Figure, Icon, Panel, ViewSelect } from "@/components/redesign/ui"

type View = "open" | "positions" | "history" | "balances"

const th = "whitespace-nowrap px-3 pb-2.5 pt-1 text-left text-[11.5px] font-medium text-muted-foreground"
const td = "whitespace-nowrap border-t border-white/[0.045] px-3 py-3 text-[12.5px] tabular-nums"

function SideTag({ side }: { side: "buy" | "sell" | "long" | "short" }) {
  const good = side === "buy" || side === "long"
  return <span className={cn("rounded-md px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.04em]", good ? "bg-credit/[0.12] text-credit" : "bg-debit/[0.12] text-debit")}>{side}</span>
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-6 py-12 text-center text-[13px] text-muted-foreground">{children}</p>
}

/** A phone row: identity on top, figures in a two-column grid, action last. */
function MobileCard({ head, cells, action }: { head: React.ReactNode; cells: [string, React.ReactNode][]; action?: React.ReactNode }) {
  return (
    <motion.li layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3 border-t border-white/[0.05] px-4 py-3.5 first:border-t-0">
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

const pairCell = (base: string, label: string) => (
  <span className="flex items-center gap-2 font-semibold">
    <CoinAvatar symbol={base} size="sm" />
    {label}
  </span>
)

const fillBar = (pct: number) => (
  <span className="flex items-center gap-2">
    <span className="relative h-1 w-12 overflow-hidden rounded-full bg-white/[0.08]">
      <span className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${pct}%` }} />
    </span>
    <span className="text-muted-foreground">{pct}%</span>
  </span>
)

export function ActivityPanel({
  orders,
  positions,
  defaultTab,
  onCancel,
  onClose,
}: {
  orders: Order[]
  positions: Position[]
  defaultTab: View
  onCancel: (id: string) => void
  onClose: (id: string) => void
}) {
  const [view, setView] = React.useState<View>(defaultTab)
  React.useEffect(() => setView(defaultTab), [defaultTab])
  const open = orders.filter((o) => o.status === "open")
  const history = orders.filter((o) => o.status !== "open")
  const held = [...new Set(PAIRS.flatMap((p) => [p.base, p.quote]))].filter((s) => balanceOf(s) > 0)

  const cancelBtn = (id: string, full?: boolean) => (
    <button
      type="button"
      onClick={() => onCancel(id)}
      className={cn("inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-white/[0.08] px-2.5 text-[12px] font-semibold text-foreground/85 transition-colors hover:border-debit/40 hover:text-debit", full && "w-full")}
    >
      <Icon icon={Cancel01Icon} className="size-3.5" />
      Cancel
    </button>
  )
  const closeBtn = (id: string, full?: boolean) => (
    <button type="button" onClick={() => onClose(id)} className={cn("inline-flex h-8 items-center justify-center rounded-lg border border-white/[0.08] px-3 text-[12px] font-semibold text-foreground/85 transition-colors hover:border-primary/40 hover:text-primary", full && "w-full")}>
      Close position
    </button>
  )

  const reservedOf = (s: string) =>
    open.reduce((sum, o) => {
      const m = pairById(o.pairId)
      if (o.side === "buy" && m.quote === s) return sum + o.price * o.amount
      if (o.side === "sell" && m.base === s) return sum + o.amount
      return sum
    }, 0)

  return (
    <Panel className="flex flex-col overflow-visible">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-3 py-3 md:px-4">
        <ViewSelect
          options={[
            { key: "open", label: "Open orders", count: open.length, hint: "Limit and stop orders waiting to fill", icon: Clock01Icon },
            { key: "positions", label: "Positions", count: positions.length, hint: "Open perpetual positions", icon: ChartLineData02Icon },
            { key: "history", label: "Order history", count: history.length, hint: "Filled and cancelled orders", icon: Invoice03Icon },
            { key: "balances", label: "Balances", count: held.length, hint: "What you hold, and what orders reserve", icon: Wallet02Icon },
          ]}
          value={view}
          onChange={setView}
        />
        <span className="hidden text-[12px] text-muted-foreground sm:block">
          {view === "open" && "Tap a row's Cancel to pull an order"}
          {view === "positions" && "Marked to the mark price"}
          {view === "history" && "This session and before"}
          {view === "balances" && "Spot wallet"}
        </span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={view} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="pb-2">
          {/* ── Open orders ── */}
          {view === "open" &&
            (open.length === 0 ? (
              <Empty>No open orders. Limit and stop orders you place wait here until they fill.</Empty>
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
                    {open.map((o) => {
                      const m = pairById(o.pairId)
                      return (
                        <tr key={o.id}>
                          <td className={cn(td, "pl-4")}>{pairCell(m.base, `${m.base}/${m.quote}`)}</td>
                          <td className={td}>
                            <SideTag side={o.side} />
                          </td>
                          <td className={cn(td, "capitalize text-muted-foreground")}>{o.type}</td>
                          <td className={td}>{formatPrice(o.price)}</td>
                          <td className={td}>
                            <Figure mask="••••">{`${o.amount} ${m.base}`}</Figure>
                          </td>
                          <td className={cn(td, "hidden xl:table-cell")}>{fillBar(o.filledPct)}</td>
                          <td className={cn(td, "hidden text-muted-foreground 2xl:table-cell")}>
                            {o.date} {o.time}
                          </td>
                          <td className={cn(td, "pr-4 text-right")}>{cancelBtn(o.id)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <ul className="md:hidden">
                  <AnimatePresence initial={false}>
                    {open.map((o) => {
                      const m = pairById(o.pairId)
                      return (
                        <MobileCard
                          key={o.id}
                          head={
                            <>
                              {pairCell(m.base, `${m.base}/${m.quote}`)}
                              <span className="flex items-center gap-2">
                                <span className="text-[11.5px] capitalize text-muted-foreground">{o.type}</span>
                                <SideTag side={o.side} />
                              </span>
                            </>
                          }
                          cells={[
                            ["Price", formatPrice(o.price)],
                            ["Amount", <Figure key="a" mask="••••">{`${o.amount} ${m.base}`}</Figure>],
                            ["Filled", fillBar(o.filledPct)],
                            ["Placed", `${o.date} ${o.time}`],
                          ]}
                          action={cancelBtn(o.id, true)}
                        />
                      )
                    })}
                  </AnimatePresence>
                </ul>
              </>
            ))}

          {/* ── Positions ── */}
          {view === "positions" &&
            (positions.length === 0 ? (
              <Empty>No open positions. Switch to Futures to open one.</Empty>
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
                      const perp = perpById(p.perpId)
                      const st = positionState(p, perp.markPrice)
                      const gain = st.pnl >= 0
                      return (
                        <tr key={p.id}>
                          <td className={cn(td, "pl-4")}>
                            <span className="flex items-center gap-2">
                              <CoinAvatar symbol={perp.base} size="sm" />
                              <span className="font-semibold">{perp.base}-PERP</span>
                              <SideTag side={p.side} />
                              <span className="text-[11px] font-semibold text-primary">{p.leverage}×</span>
                            </span>
                          </td>
                          <td className={td}>
                            <Figure mask="••••">{`${p.size.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${perp.base}`}</Figure>
                          </td>
                          <td className={cn(td, "hidden xl:table-cell")}>{formatPrice(p.entry)}</td>
                          <td className={td}>{formatPrice(perp.markPrice)}</td>
                          <td className={td}>
                            <span className="flex flex-col gap-1">
                              <span className="text-warning">{formatPrice(p.liquidation)}</span>
                              <span className="relative h-1 w-14 overflow-hidden rounded-full bg-white/[0.08]" title={`${Math.round(st.risk)}% of the way to liquidation`}>
                                <span className={cn("absolute inset-y-0 left-0 rounded-full", st.risk > 66 ? "bg-debit" : st.risk > 33 ? "bg-warning" : "bg-credit")} style={{ width: `${Math.max(4, st.risk)}%` }} />
                              </span>
                            </span>
                          </td>
                          <td className={cn(td, "hidden 2xl:table-cell")}>
                            <Figure mask="••••">{`$${p.margin.toLocaleString("en-US", { maximumFractionDigits: 2 })}`}</Figure>
                          </td>
                          <td className={td}>
                            <span className={cn("font-semibold", gain ? "text-credit" : "text-debit")}>
                              <Figure mask="••••">{`${gain ? "+" : "−"}$${Math.abs(st.pnl).toFixed(2)}`}</Figure>
                              <span className="ml-1 text-[11.5px]">
                                ({gain ? "+" : "−"}
                                {Math.abs(st.roe).toFixed(2)}%)
                              </span>
                            </span>
                          </td>
                          <td className={cn(td, "pr-4 text-right")}>{closeBtn(p.id)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <ul className="md:hidden">
                  <AnimatePresence initial={false}>
                    {positions.map((p) => {
                      const perp = perpById(p.perpId)
                      const st = positionState(p, perp.markPrice)
                      const gain = st.pnl >= 0
                      return (
                        <MobileCard
                          key={p.id}
                          head={
                            <>
                              <span className="flex items-center gap-2">
                                <CoinAvatar symbol={perp.base} size="sm" />
                                <span className="font-semibold">{perp.base}-PERP</span>
                                <SideTag side={p.side} />
                                <span className="text-[11px] font-semibold text-primary">
                                  {p.leverage}× <span className="capitalize text-muted-foreground">{p.mode}</span>
                                </span>
                              </span>
                            </>
                          }
                          cells={[
                            [
                              "PnL (ROE)",
                              <span key="p" className={gain ? "text-credit" : "text-debit"}>
                                <Figure mask="••••">{`${gain ? "+" : "−"}$${Math.abs(st.pnl).toFixed(2)}`}</Figure> ({gain ? "+" : "−"}
                                {Math.abs(st.roe).toFixed(1)}%)
                              </span>,
                            ],
                            ["Size", <Figure key="s" mask="••••">{`${p.size.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${perp.base}`}</Figure>],
                            ["Entry → Mark", `${formatPrice(p.entry)} → ${formatPrice(perp.markPrice)}`],
                            ["Liquidation", <span key="l" className="text-warning">{formatPrice(p.liquidation)}</span>],
                            ["Margin", <Figure key="m" mask="••••">{`$${p.margin.toLocaleString("en-US", { maximumFractionDigits: 2 })}`}</Figure>],
                            ["TP / SL", `${p.takeProfit ? formatPrice(p.takeProfit) : "—"} / ${p.stopLoss ? formatPrice(p.stopLoss) : "—"}`],
                          ]}
                          action={closeBtn(p.id, true)}
                        />
                      )
                    })}
                  </AnimatePresence>
                </ul>
              </>
            ))}

          {/* ── History ── */}
          {view === "history" &&
            (history.length === 0 ? (
              <Empty>No past orders yet.</Empty>
            ) : (
              <>
                <table className="hidden w-full md:table">
                  <thead>
                    <tr>
                      <th className={cn(th, "pl-4")}>Pair</th>
                      <th className={th}>Side</th>
                      <th className={cn(th, "hidden xl:table-cell")}>Type</th>
                      <th className={th}>Price</th>
                      <th className={th}>Amount</th>
                      <th className={th}>Status</th>
                      <th className={cn(th, "pr-4 text-right")}>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((o) => {
                      const m = pairById(o.pairId)
                      return (
                        <tr key={o.id}>
                          <td className={cn(td, "pl-4")}>{pairCell(m.base, `${m.base}/${m.quote}`)}</td>
                          <td className={td}>
                            <SideTag side={o.side} />
                          </td>
                          <td className={cn(td, "hidden capitalize text-muted-foreground xl:table-cell")}>{o.type}</td>
                          <td className={td}>{formatPrice(o.price)}</td>
                          <td className={td}>
                            <Figure mask="••••">{`${o.amount} ${m.base}`}</Figure>
                          </td>
                          <td className={td}>
                            <span className={cn("rounded-md px-1.5 py-0.5 text-[10.5px] font-bold uppercase", o.status === "filled" ? "bg-credit/[0.1] text-credit" : "bg-white/[0.06] text-muted-foreground")}>{o.status}</span>
                          </td>
                          <td className={cn(td, "pr-4 text-right text-muted-foreground")}>
                            {o.date} {o.time}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <ul className="md:hidden">
                  {history.map((o) => {
                    const m = pairById(o.pairId)
                    return (
                      <MobileCard
                        key={o.id}
                        head={
                          <>
                            {pairCell(m.base, `${m.base}/${m.quote}`)}
                            <span className="flex items-center gap-2">
                              <SideTag side={o.side} />
                              <span className={cn("rounded-md px-1.5 py-0.5 text-[10.5px] font-bold uppercase", o.status === "filled" ? "bg-credit/[0.1] text-credit" : "bg-white/[0.06] text-muted-foreground")}>{o.status}</span>
                            </span>
                          </>
                        }
                        cells={[
                          ["Price", formatPrice(o.price)],
                          ["Amount", <Figure key="a" mask="••••">{`${o.amount} ${m.base}`}</Figure>],
                          ["Type", <span key="t" className="capitalize">{o.type}</span>],
                          ["Time", `${o.date} ${o.time}`],
                        ]}
                      />
                    )
                  })}
                </ul>
              </>
            ))}

          {/* ── Balances (a list fits everywhere — three short columns) ── */}
          {view === "balances" && (
            <ul className="flex flex-col">
              <li className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-6 px-4 pb-2 pt-1 text-[11.5px] font-medium text-muted-foreground">
                <span>Asset</span>
                <span className="w-28 text-right">Available</span>
                <span className="w-24 text-right">In orders</span>
              </li>
              {held.map((s) => {
                const reserved = reservedOf(s)
                return (
                  <li key={s} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-6 border-t border-white/[0.045] px-4 py-3 text-[12.5px] tabular-nums">
                    {pairCell(s, s)}
                    <span className="w-28 truncate text-right font-semibold text-foreground">
                      <Figure mask="••••">{balanceOf(s).toLocaleString("en-US", { maximumFractionDigits: 4 })}</Figure>
                    </span>
                    <span className="w-24 truncate text-right text-muted-foreground">
                      <Figure mask="••••">{reserved > 0 ? reserved.toLocaleString("en-US", { maximumFractionDigits: 4 }) : "—"}</Figure>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </motion.div>
      </AnimatePresence>
    </Panel>
  )
}

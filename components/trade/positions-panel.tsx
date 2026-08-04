"use client"

/**
 * PositionsPanel — the workspace's bottom drawer: Positions and Open orders as
 * tabs with live counts, rendered as dense tables (the exchange idiom) instead
 * of stacked cards. Shows the fields the API already returns that the old UI
 * dropped: mark price, ROE, liquidation price, margin.
 *
 * Pure display: account data, busy state and the close/cancel handlers arrive
 * via props so the order logic stays in one place.
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import type { HlAccount } from "@/lib/crypto-api"

type Tab = "positions" | "orders"

function fmt(n: number, dp = 2) {
  return n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })
}

function fmtPx(p: number) {
  return p.toLocaleString(undefined, { maximumFractionDigits: p < 1 ? 6 : 2 })
}

const TH = "px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-subtle whitespace-nowrap"
const TD = "px-3 py-2 text-[11.5px] tabular-nums whitespace-nowrap"

export function PositionsPanel({
  account,
  busyKey,
  onClosePosition,
  onCancelOrder,
  className,
}: {
  account: HlAccount | null
  busyKey: string | null
  onClosePosition: (symbol: string) => void
  onCancelOrder: (oid: number, symbol: string, market: "spot" | "futures") => void
  className?: string
}) {
  const [tab, setTab] = React.useState<Tab>("positions")
  const positions = account?.positions ?? []
  const orders = account?.openOrders ?? []

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      {/* Tab strip */}
      <div className="flex items-center gap-1 border-b border-border/30 px-2">
        {(
          [
            { key: "positions", label: "Positions", count: positions.length },
            { key: "orders", label: "Open orders", count: orders.length },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "relative px-3 py-2.5 text-xs font-semibold transition-colors",
              tab === t.key ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.count > 0 && (
              <span className="ml-1.5 rounded-full bg-primary/[0.12] px-1.5 py-0.5 text-[10px] font-bold text-primary">
                {t.count}
              </span>
            )}
            {tab === t.key && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" />}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {tab === "positions" ? (
          positions.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">
              No open positions — they appear here the moment an order fills.
            </p>
          ) : (
            <table className="w-full min-w-[760px]">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b border-border/20">
                  <th className={TH}>Contract</th>
                  <th className={TH}>Size</th>
                  <th className={TH}>Entry</th>
                  <th className={TH}>Mark</th>
                  <th className={TH}>Liq.</th>
                  <th className={TH}>Margin</th>
                  <th className={TH}>PnL (ROE)</th>
                  <th className={cn(TH, "text-right")} />
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => {
                  const up = p.unrealizedPnl >= 0
                  return (
                    <tr key={p.symbol} className="border-b border-border/10 hover:bg-accent/30">
                      <td className={TD}>
                        <span className="font-bold">{p.symbol}</span>{" "}
                        <span
                          className={cn(
                            "ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold",
                            p.side === "long" ? "bg-credit-chip text-credit" : "bg-debit-chip text-debit",
                          )}
                        >
                          {p.side === "long" ? "Long" : "Short"} {p.leverage.value}×
                        </span>
                      </td>
                      <td className={TD}>
                        {p.absSize} <span className="text-subtle">(${fmt(p.notionalUsd)})</span>
                      </td>
                      <td className={TD}>${fmtPx(p.entryPrice)}</td>
                      <td className={TD}>${fmtPx(p.markPrice)}</td>
                      <td className={cn(TD, "text-warning")}>
                        {p.liquidationPrice ? `$${fmtPx(p.liquidationPrice)}` : "—"}
                      </td>
                      <td className={TD}>${fmt(p.marginUsed)}</td>
                      <td className={cn(TD, "font-semibold", up ? "text-credit" : "text-debit")}>
                        {up ? "+" : ""}${fmt(p.unrealizedPnl)}{" "}
                        <span className="font-medium opacity-80">
                          ({up ? "+" : ""}
                          {fmt(p.returnOnEquity * 100, 1)}%)
                        </span>
                      </td>
                      <td className={cn(TD, "text-right")}>
                        <button
                          onClick={() => onClosePosition(p.symbol)}
                          disabled={busyKey === `close:${p.symbol}`}
                          className="rounded-lg bg-debit-chip px-2.5 py-1 text-[11px] font-semibold text-debit transition-colors hover:bg-debit/20 disabled:opacity-40"
                        >
                          {busyKey === `close:${p.symbol}` ? "Closing…" : "Close"}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )
        ) : orders.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">
            No open orders — resting limit and trigger orders appear here.
          </p>
        ) : (
          <table className="w-full min-w-[640px]">
            <thead className="sticky top-0 bg-background">
              <tr className="border-b border-border/20">
                <th className={TH}>Market</th>
                <th className={TH}>Side</th>
                <th className={TH}>Type</th>
                <th className={TH}>Price</th>
                <th className={TH}>Size</th>
                <th className={cn(TH, "text-right")} />
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.oid} className="border-b border-border/10 hover:bg-accent/30">
                  <td className={TD}>
                    <span className="font-bold">{o.symbol}</span>{" "}
                    <span className="text-[10px] uppercase text-subtle">{o.market}</span>
                  </td>
                  <td className={cn(TD, "font-semibold", o.side === "buy" ? "text-credit" : "text-debit")}>
                    {o.side === "buy" ? "Buy" : "Sell"}
                  </td>
                  <td className={TD}>
                    {o.orderType}
                    {o.reduceOnly && <span className="ml-1 text-[10px] text-subtle">RO</span>}
                  </td>
                  <td className={TD}>
                    ${fmtPx(o.isTrigger ? (o.triggerPrice ?? o.limitPrice) : o.limitPrice)}
                    {o.isTrigger && <span className="ml-1 text-[10px] text-subtle">trigger</span>}
                  </td>
                  <td className={TD}>
                    {o.size}
                    {o.origSize !== o.size && <span className="text-subtle"> / {o.origSize}</span>}
                  </td>
                  <td className={cn(TD, "text-right")}>
                    <button
                      onClick={() => onCancelOrder(o.oid, o.symbol, o.market)}
                      disabled={busyKey === `cancel:${o.oid}`}
                      className="rounded-lg bg-surface-sunken px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-accent disabled:opacity-40"
                    >
                      {busyKey === `cancel:${o.oid}` ? "Cancelling…" : "Cancel"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

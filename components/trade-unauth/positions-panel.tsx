"use client"

/**
 * Open positions.
 *
 * The live panel renders "No open positions — they appear here the moment an
 * order fills" and nothing else, which is a fine empty state and a poor
 * demonstration: the layout that matters is the one with risk in it.
 *
 * Every column here answers a question you have while a leveraged position is
 * open — what is it worth, what did it cost, how close is the mark to ending
 * it — and the liquidation column carries a proximity bar, because
 * "83,424.00" means nothing without knowing the mark is at 96,420.
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import { Segmented, EmptyState } from "@/components/ui/system"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import {
  FUTURES_EQUITY,
  POSITIONS,
  formatPrice,
  perpById,
  positionState,
  type Position,
} from "@/components/trade-unauth/futures-data"

function usd(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function PositionsPanel({ perpId }: { perpId: string }) {
  const [tab, setTab] = React.useState<"positions" | "orders">("positions")
  const [closed, setClosed] = React.useState<string[]>([])

  const rows = POSITIONS.filter((p) => !closed.includes(p.id))
  const totalPnl = rows.reduce((s, p) => s + positionState(p, perpById(p.perpId).markPrice).pnl, 0)

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-border/40 px-4 py-2.5">
        <Segmented
          size="sm"
          options={[
            { key: "positions", label: `Positions (${rows.length})` },
            { key: "orders", label: "Open orders" },
          ]}
          value={tab}
          onChange={(k) => setTab(k as "positions" | "orders")}
        />
        {/* Account health, where it is useful — beside the risk it describes. */}
        <span className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px]">
          <Stat label="Equity" value={usd(FUTURES_EQUITY.balance)} />
          <Stat label="Margin used" value={usd(FUTURES_EQUITY.used)} />
          <Stat
            label="Unrealised"
            value={`${totalPnl >= 0 ? "+" : "−"}${usd(Math.abs(totalPnl))}`}
            tone={totalPnl >= 0 ? "credit" : "debit"}
          />
        </span>
      </div>

      {tab === "orders" ? (
        <EmptyState
          title="No working orders"
          description="Limit and stop orders rest here until they trigger."
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No open positions"
          description="They appear here the moment an order fills."
        />
      ) : (
        <div className="slim-scroll min-w-0 overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border/40 text-[11px] uppercase tracking-[0.07em] text-muted-foreground">
                <th className="px-4 py-2.5 font-semibold">Contract</th>
                <th className="px-4 py-2.5 text-right font-semibold">Size</th>
                <th className="px-4 py-2.5 text-right font-semibold">Entry</th>
                <th className="px-4 py-2.5 text-right font-semibold">Mark</th>
                <th className="px-4 py-2.5 text-right font-semibold">Liquidation</th>
                <th className="px-4 py-2.5 text-right font-semibold">Margin</th>
                <th className="px-4 py-2.5 text-right font-semibold">Unrealised</th>
                <th className="px-4 py-2.5 text-right font-semibold">TP / SL</th>
                <th className="px-4 py-2.5 text-right font-semibold" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/25">
              {rows.map((p) => (
                <Row key={p.id} p={p} active={p.perpId === perpId} onClose={() => setClosed((c) => [...c, p.id])} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "credit" | "debit" }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-semibold tabular-nums",
          tone === "credit" && "text-credit",
          tone === "debit" && "text-debit",
        )}
      >
        {value}
      </span>
    </span>
  )
}

function Row({ p, active, onClose }: { p: Position; active: boolean; onClose: () => void }) {
  const perp = perpById(p.perpId)
  const s = positionState(p, perp.markPrice)
  const long = p.side === "long"

  return (
    <tr className={cn("transition-colors hover:bg-accent/40", active && "bg-primary/[0.04]")}>
      <td className="px-4 py-3">
        <span className="flex items-center gap-2.5">
          <CoinAvatar symbol={perp.base} size="md" />
          <span className="flex min-w-0 flex-col">
            <span className="whitespace-nowrap text-[13px] font-semibold leading-tight">
              {perp.base}-PERP
            </span>
            <span className="flex items-center gap-1.5 leading-tight">
              <span
                className={cn("text-[11.5px] font-semibold uppercase", long ? "text-credit" : "text-debit")}
              >
                {p.side}
              </span>
              <span className="rounded bg-foreground/[0.08] px-1 text-[10.5px] font-semibold tabular-nums text-muted-foreground">
                {p.leverage}×
              </span>
              <span className="rounded bg-foreground/[0.08] px-1 text-[10.5px] font-semibold capitalize text-muted-foreground">
                {p.mode}
              </span>
            </span>
          </span>
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right text-[13px] tabular-nums">
        {p.size} {perp.base}
        <span className="block text-[11px] text-muted-foreground">{usd(s.notional)}</span>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right text-[13px] tabular-nums text-muted-foreground">
        {formatPrice(p.entry)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right text-[13px] font-medium tabular-nums">
        {formatPrice(perp.markPrice)}
      </td>
      {/* Liquidation with a proximity bar: the price alone says nothing about
          how close you are to it. */}
      <td className="whitespace-nowrap px-4 py-3 text-right">
        <span className="flex flex-col items-end gap-1">
          <span className="text-[13px] font-medium tabular-nums text-warning">
            {formatPrice(p.liquidation)}
          </span>
          <span aria-hidden className="flex h-1 w-16 overflow-hidden rounded-full bg-foreground/[0.08]">
            <span
              className={cn("block h-full rounded-full", s.risk > 60 ? "bg-debit" : "bg-warning")}
              style={{ width: `${s.risk}%` }}
            />
          </span>
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right text-[13px] tabular-nums text-muted-foreground">
        {usd(p.margin)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right">
        <span className="flex flex-col items-end">
          <span
            className={cn("text-[13.5px] font-semibold tabular-nums", s.pnl >= 0 ? "text-credit" : "text-debit")}
          >
            {s.pnl >= 0 ? "+" : "−"}
            {usd(Math.abs(s.pnl))}
          </span>
          <span className={cn("text-[11px] tabular-nums", s.pnl >= 0 ? "text-credit/80" : "text-debit/80")}>
            {s.roe >= 0 ? "+" : ""}
            {s.roe.toFixed(2)}% ROE
          </span>
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right text-[12px] tabular-nums">
        <span className={cn(p.takeProfit ? "text-credit" : "text-muted-foreground/50")}>
          {p.takeProfit ? formatPrice(p.takeProfit) : "—"}
        </span>
        <span className="text-muted-foreground/40"> / </span>
        <span className={cn(p.stopLoss ? "text-debit" : "text-muted-foreground/50")}>
          {p.stopLoss ? formatPrice(p.stopLoss) : "—"}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={onClose}
          className="whitespace-nowrap rounded-full border border-border/60 px-3 py-1 text-[11.5px] font-semibold text-muted-foreground transition-colors hover:border-debit/50 hover:text-debit"
        >
          Close
        </button>
      </td>
    </tr>
  )
}

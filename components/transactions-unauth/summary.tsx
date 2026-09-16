"use client"

/**
 * The summary strip.
 *
 * Every figure here is DERIVED from the same rows the list below renders, and
 * that is the whole point. The live page computes its header independently and
 * the two disagree in public: it claims 16 deposits + 11 withdrawals + 14
 * moved over a list captioned "30 transactions", prints "$41.828268" where a
 * currency belongs, and renders both Money Out and Net as an em dash under
 * "Waiting for asset prices" — a loading state that never resolves.
 *
 * Failed transactions are excluded from the money figures. A withdrawal that
 * did not go through moved nothing, and counting it is how a ledger lies.
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import { CardShell } from "@/components/ui/system"
import { CARD_HUE } from "@/components/ui/surface"
import { NET_USD, SUMMARY, formatUSD } from "@/components/transactions-unauth/tx-data"

type Cell = {
  key: string
  label: string
  value: string
  hint: string
  tone?: "credit" | "debit" | "warning"
}

export function Summary() {
  const cells: Cell[] = [
    {
      key: "in",
      label: "Money in",
      value: formatUSD(SUMMARY.inUsd),
      hint: `${SUMMARY.inCount} deposits settled`,
      tone: "credit",
    },
    {
      key: "out",
      label: "Money out",
      value: formatUSD(SUMMARY.outUsd),
      hint: `${SUMMARY.outCount} withdrawals settled`,
      tone: "debit",
    },
    {
      key: "net",
      label: "Net",
      value: `${NET_USD >= 0 ? "+" : "−"}${formatUSD(Math.abs(NET_USD))}`,
      hint: "In minus out",
      tone: NET_USD >= 0 ? "credit" : "debit",
    },
    {
      key: "moved",
      label: "Traded",
      value: formatUSD(SUMMARY.tradedUsd),
      hint: `${SUMMARY.tradeCount} trades · ${SUMMARY.swapCount} swaps`,
    },
    {
      key: "fees",
      label: "Fees paid",
      value: formatUSD(SUMMARY.feesUsd),
      // Fees are the figure a transactions page exists to surface and the one
      // the live page does not show at all.
      hint: "Network fees only",
      tone: "warning",
    },
  ]

  return (
    <CardShell className={CARD_HUE}>
      <div className="grid grid-cols-2 gap-px bg-border/40 sm:grid-cols-3 xl:grid-cols-5">
        {cells.map((c) => (
          <div key={c.key} className="flex flex-col gap-1 bg-card/40 px-4 py-3.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
              {c.label}
            </span>
            <span
              className={cn(
                "font-display text-[22px] font-medium leading-tight tabular-nums",
                c.tone === "credit" && "text-credit",
                c.tone === "debit" && "text-debit",
                c.tone === "warning" && "text-warning",
              )}
            >
              {c.value}
            </span>
            <span className="truncate text-[11.5px] text-muted-foreground">{c.hint}</span>
          </div>
        ))}
      </div>
    </CardShell>
  )
}

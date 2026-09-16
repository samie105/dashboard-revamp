"use client"

/**
 * Recent movements — deposits, withdrawals and internal transfers.
 *
 * Not trades: this is the wallet, and what belongs here is money crossing the
 * boundary. The column that earns its place is STATUS, with confirmations
 * attached — "pending" on its own tells you nothing, "7/12 confirmations"
 * tells you whether to wait or to go and look at the explorer.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDownLeft01Icon,
  ArrowUpRight01Icon,
  ArrowDataTransferHorizontalIcon,
  LinkSquare02Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { CardShell, CardHeader, Segmented } from "@/components/ui/system"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { CARD_HUE } from "@/components/ui/surface"
import { MOVEMENTS, formatAmount, formatUSD, type Movement } from "@/components/wallet-unauth/wallet-data"

type Tab = "all" | "deposit" | "withdrawal" | "transfer"

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "deposit", label: "Deposits" },
  { key: "withdrawal", label: "Withdrawals" },
  { key: "transfer", label: "Transfers" },
]

const KIND_ICON = {
  deposit: ArrowDownLeft01Icon,
  withdrawal: ArrowUpRight01Icon,
  transfer: ArrowDataTransferHorizontalIcon,
} as const

/** Fixed minute offsets — no clock read, so SSR and hydration agree. */
function ago(minutes: number): string {
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`
  const days = Math.round(minutes / 1440)
  return days === 1 ? "Yesterday" : `${days}d ago`
}

function StatusPill({ m }: { m: Movement }) {
  if (m.status === "pending" && m.confirmations) {
    const [seen, need] = m.confirmations
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-chip px-2 py-1 text-[11.5px] font-semibold text-warning">
        {/* The progress ring in miniature: a pending deposit is a countdown,
            so it shows the count rather than the word alone. */}
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-warning" />
        </span>
        {seen}/{need}
      </span>
    )
  }
  if (m.status === "failed") {
    return (
      <span className="inline-flex items-center rounded-full bg-debit-chip px-2 py-1 text-[11.5px] font-semibold text-debit">
        Failed
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-foreground/[0.07] px-2 py-1 text-[11.5px] font-semibold text-muted-foreground">
      Completed
    </span>
  )
}

export function Movements() {
  const [tab, setTab] = React.useState<Tab>("all")
  const rows = tab === "all" ? MOVEMENTS : MOVEMENTS.filter((m) => m.kind === tab)

  return (
    <CardShell className={CARD_HUE}>
      <CardHeader
        title="Recent movements"
        subtitle="Money in and out of this wallet"
        right={<Segmented size="sm" options={TABS} value={tab} onChange={setTab} />}
      />
      <div className="slim-scroll min-w-0 flex-1 overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-left">
          <thead>
            <tr className="border-y border-border/40 text-[11px] uppercase tracking-[0.07em] text-muted-foreground">
              <th className="px-4 py-2.5 font-semibold">Type</th>
              <th className="px-4 py-2.5 font-semibold">Asset</th>
              <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
              <th className="px-4 py-2.5 font-semibold">Network</th>
              <th className="px-4 py-2.5 font-semibold">Status</th>
              <th className="px-4 py-2.5 text-right font-semibold">When</th>
              <th className="px-4 py-2.5 text-right font-semibold">Tx</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/25">
            {rows.map((m) => (
              <tr key={m.id} className="transition-colors hover:bg-accent/40">
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2.5">
                    <span
                      // Direction is the glyph's meaning here, so the icon opts
                      // out of the global two-tone gold treatment.
                      className={cn(
                        "ws-icon-mono flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                        m.kind === "deposit" && "bg-credit-chip text-credit",
                        m.kind === "withdrawal" && "bg-debit-chip text-debit",
                        m.kind === "transfer" && "bg-convert-chip text-primary",
                      )}
                    >
                      <HugeiconsIcon icon={KIND_ICON[m.kind]} className="h-4 w-4" />
                    </span>
                    <span className="text-[13px] font-medium capitalize">{m.kind}</span>
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2">
                    <CoinAvatar symbol={m.symbol} size="sm" />
                    <span className="text-[13px] font-semibold">{m.symbol}</span>
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="flex flex-col items-end">
                    <span
                      className={cn(
                        "whitespace-nowrap text-[13.5px] font-semibold tabular-nums",
                        m.kind === "deposit" && "text-credit",
                        m.kind === "withdrawal" && "text-debit",
                        m.kind === "transfer" && "text-foreground",
                      )}
                    >
                      {m.kind === "deposit" ? "+" : m.kind === "withdrawal" ? "−" : ""}
                      {formatAmount(m.amount)} {m.symbol}
                    </span>
                    <span className="text-[11.5px] tabular-nums text-muted-foreground">
                      {formatUSD(m.usd)}
                    </span>
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-[13px] text-muted-foreground">{m.network}</td>
                <td className="px-4 py-3">
                  <StatusPill m={m} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-[12.5px] text-muted-foreground">
                  {ago(m.minutesAgo)}
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center justify-end">
                    <button
                      type="button"
                      title={`View ${m.txid} on the explorer`}
                      className="ws-icon-mono inline-flex items-center gap-1.5 font-mono text-[11.5px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {m.txid.length > 12 ? `${m.txid.slice(0, 10)}…` : m.txid}
                      <HugeiconsIcon icon={LinkSquare02Icon} className="h-3 w-3 shrink-0" />
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CardShell>
  )
}

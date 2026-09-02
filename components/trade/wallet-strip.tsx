"use client"

/**
 * WalletStrip — what the wallet holds of BOTH sides of the pair, on the pair's
 * own chain.
 *
 * The ticket used to quote one figure ("avail 0 USDC") and leave the rest of
 * the rail empty. Two holdings answer the two questions a trader actually has
 * before pressing the button — "how much can I buy?" and "how much can I
 * sell?" — and they sit under the CTA so the rail reads as a complete
 * instrument rather than a form with space left over.
 *
 * Pure display: the caller resolves balances from the snapshot. A `null`
 * amount means the snapshot hasn't arrived — not zero — and is drawn as a
 * skeleton, never as "0.00".
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { Skel } from "@/components/ui/system"

export type WalletStripRow = {
  symbol: string
  icon?: string | null
  /** Token units. `null` while the snapshot is loading. */
  amount: number | null
  /** The holding priced in dollars, where a price is known. */
  valueUsd: number | null
}

function fmtAmount(n: number) {
  if (n === 0) return "0"
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 })
}

function fmtUsd(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function WalletStrip({
  network,
  rows,
  className,
}: {
  /** Human chain name — "Solana". */
  network: string | null
  rows: WalletStripRow[]
  className?: string
}) {
  if (rows.length === 0) return null
  return (
    <section
      aria-label={network ? `Your wallet on ${network}` : "Your wallet"}
      data-vivid-target="trade-wallet-strip"
      data-vivid-label="What the wallet holds of this pair's two tokens"
      className={cn("flex flex-col gap-1", className)}
    >
      <h4 className="px-1 text-[12px] font-semibold text-muted-foreground">
        Your wallet{network ? ` on ${network}` : ""}
      </h4>
      <div className="divide-y divide-border/20 rounded-2xl bg-surface-sunken/70">
        {rows.map((row) => (
          <div key={row.symbol} className="flex items-center gap-2.5 px-3 py-2.5">
            <CoinAvatar symbol={row.symbol} src={row.icon} size="md" />
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{row.symbol}</span>
            {row.amount === null ? (
              <Skel className="h-3.5 w-16" />
            ) : (
              <span className="flex flex-col items-end leading-tight">
                <span className="text-[13px] font-medium tabular-nums">{fmtAmount(row.amount)}</span>
                {row.valueUsd !== null && row.amount > 0 && (
                  <span className="text-[11px] tabular-nums text-subtle">{fmtUsd(row.valueUsd)}</span>
                )}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

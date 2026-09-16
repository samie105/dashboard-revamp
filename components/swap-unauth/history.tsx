"use client"

/**
 * Recent swaps.
 *
 * The live list is the clearest data bug in the product. Its rows read:
 *
 *     USDC → 0x00000000000…
 *     solana-mainnet-beta → solana-…            Completed
 *
 * Three faults in two lines. It prints a CONTRACT ADDRESS — usually the zero
 * address — where the destination token's symbol belongs, so the coin art
 * falls back to a "0X00" monogram. It names the chain as a raw slug, twice,
 * for a swap that never left Solana. And it truncates both, so even the
 * broken value is unreadable.
 *
 * A swap's content is "1,200 USDC became 6.5702 SOL". Both sides are tokens.
 * The chain is worth saying only when it CHANGED.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, LinkSquare02Icon } from "@hugeicons/core-free-icons"
import { CardShell, CardHeader, EmptyState, Segmented } from "@/components/ui/system"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { CARD_HUE } from "@/components/preview/surface"
import {
  SWAPS,
  SWAP_STATS,
  formatAmount,
  formatUSD,
  type SwapRecord,
  type SwapStatus,
} from "@/components/swap-unauth/swap-data"

type Tab = SwapStatus | "all"

/** Fixed offsets, so no clock is read at render. */
function ago(minutes: number): string {
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`
  const days = Math.round(minutes / 1440)
  return days === 1 ? "Yesterday" : `${days}d ago`
}

function StatusPill({ s }: { s: SwapRecord }) {
  if (s.status === "pending" && s.confirmations) {
    const [seen, need] = s.confirmations
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-warning-chip px-2 py-1 text-[11.5px] font-semibold text-warning">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-warning" />
        </span>
        {seen}/{need}
      </span>
    )
  }
  if (s.status === "failed") {
    return (
      <span className="inline-flex items-center whitespace-nowrap rounded-full bg-debit-chip px-2 py-1 text-[11.5px] font-semibold text-debit">
        Failed
      </span>
    )
  }
  // Neutral. Every row on the live list wears a green "Completed" pill, which
  // spends the money-in colour on "nothing went wrong" and buries the two
  // rows that did.
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full bg-foreground/[0.07] px-2 py-1 text-[11.5px] font-medium text-muted-foreground">
      Completed
    </span>
  )
}

function Row({ s }: { s: SwapRecord }) {
  const crossChain = s.fromChain !== s.toChain

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 transition-colors hover:bg-accent/40">
      {/* The pair, as a pair. Two symbols, two marks, an arrow between. */}
      <span className="flex min-w-0 flex-1 items-center gap-2.5">
        <span className="flex shrink-0 items-center -space-x-2">
          <CoinAvatar symbol={s.fromSymbol} size="md" />
          <CoinAvatar symbol={s.toSymbol} size="md" />
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="flex items-center gap-1.5 text-[13.5px] font-semibold">
            <span>{s.fromSymbol}</span>
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              className="ws-icon-mono h-3.5 w-3.5 shrink-0 text-muted-foreground"
            />
            <span>{s.toSymbol}</span>
          </span>
          <span className="truncate text-[11.5px] text-muted-foreground">
            {/* The chain is worth saying only when it changed. A same-chain
                swap does not need "Solana → Solana". */}
            {crossChain ? `${s.fromChain} → ${s.toChain}` : s.fromChain} · {s.route} · {ago(s.minutesAgo)}
          </span>
        </span>
      </span>

      {/* Both legs, with the dollar value the live list never shows. */}
      <span className="flex shrink-0 flex-col items-end leading-tight">
        <span className="whitespace-nowrap text-[13.5px] font-semibold tabular-nums">
          <span className="text-debit">−{formatAmount(s.fromAmount, 4)}</span>
          <span className="text-muted-foreground"> → </span>
          <span className="text-credit">+{formatAmount(s.toAmount, 4)}</span>
        </span>
        <span className="whitespace-nowrap text-[11.5px] tabular-nums text-muted-foreground">
          {formatUSD(s.usd)}
        </span>
      </span>

      <span className="shrink-0">
        <StatusPill s={s} />
      </span>

      <button
        type="button"
        title={`View ${s.txid} on the explorer`}
        className="ws-icon-mono hidden shrink-0 items-center gap-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
      >
        {s.txid.slice(0, 8)}…
        <HugeiconsIcon icon={LinkSquare02Icon} className="h-3 w-3" />
      </button>
    </div>
  )
}

export function SwapHistory() {
  const [tab, setTab] = React.useState<Tab>("all")
  const rows = tab === "all" ? SWAPS : SWAPS.filter((s) => s.status === tab)

  return (
    <CardShell className={CARD_HUE}>
      <CardHeader
        title="Recent swaps"
        subtitle={`${SWAP_STATS.count} conversions · ${formatUSD(SWAP_STATS.volumeUsd)} settled`}
      />

      <div className="scrollbar-none overflow-x-auto border-t border-border/40 px-4 py-2.5">
        <Segmented
          size="sm"
          options={[
            { key: "all", label: "All" },
            { key: "completed", label: "Completed" },
            { key: "pending", label: `Pending (${SWAP_STATS.pending})` },
            { key: "failed", label: `Failed (${SWAP_STATS.failed})` },
          ]}
          value={tab}
          onChange={(k) => setTab(k as Tab)}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Nothing here" description="Swaps appear here as soon as one settles." />
      ) : (
        <div className="flex flex-1 flex-col divide-y divide-border/25 border-t border-border/40">
          {rows.map((s) => (
            <Row key={s.id} s={s} />
          ))}
        </div>
      )}
    </CardShell>
  )
}

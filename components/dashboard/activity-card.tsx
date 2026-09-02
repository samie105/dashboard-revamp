"use client"

/**
 * Recent + pending activity on the dashboard itself.
 *
 * The single biggest reason people re-open a money dashboard is "did it
 * arrive?" — so anything still in flight is pinned to the top with a live
 * status chip, and the latest settled movements sit under it.
 *
 * It read `/api/transactions/unified`, which the crypto backend does not
 * implement. The proxy forwarded it, the request failed, the catch set an
 * empty list, and a user with a page of real transfers and swaps was told
 * "No activity yet" — not a blank screen but a wrong answer, stated plainly,
 * on the card people open the dashboard to read. It reads the ledger now:
 * the same records the wallet's own history is built from.
 */

import * as React from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  RepeatIcon,
  ArrowDataTransferHorizontalIcon,
  Clock01Icon,
} from "@hugeicons/core-free-icons"
import { CardHeader, CardShell, EmptyState as SystemEmptyState, SkeletonRows } from "@/components/ui/system"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { useLedgerRecords } from "@/hooks/useLedgerRecords"
import { useSpotRegistry } from "@/hooks/useSpotRegistry"
import { describeLedgerRecord, type LedgerRow } from "@/lib/ledger-rows"
import { explorerTxUrl } from "@/lib/crypto-backend/network-meta"
import { chainLabel } from "@/lib/spot-market-search"

/** Ledger statuses that mean "still moving". */
const PENDING_STATUSES = new Set(["submitted", "pending", "processing"])

function timeAgo(iso: string | null): string {
  if (!iso) return ""
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms)) return ""
  const min = Math.floor(ms / 60_000)
  if (min < 1) return "Just now"
  if (min < 60) return `${min}m ago`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return days === 1 ? "Yesterday" : `${days}d ago`
}

function iconFor(row: LedgerRow) {
  if (row.kind === "trade") return RepeatIcon
  if (row.direction === "neutral") return ArrowDataTransferHorizontalIcon
  return row.direction === "in" ? ArrowDown01Icon : ArrowUp01Icon
}

function StatusChip({ status }: { status: string }) {
  if (status === "confirmed") return null
  if (PENDING_STATUSES.has(status)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-chip px-2 py-0.5 text-[11px] font-semibold text-warning">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warning" />
        In flight
      </span>
    )
  }
  if (status === "failed") {
    return (
      <span className="rounded-full bg-debit-chip px-2 py-0.5 text-[11px] font-semibold text-debit">
        Failed
      </span>
    )
  }
  // `unknown` is the reconciler saying it could not reach the chain — which is
  // not the same as "it didn't happen".
  return (
    <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
      Unconfirmed
    </span>
  )
}

export function ActivityCard() {
  const { records, loading } = useLedgerRecords()
  const registry = useSpotRegistry()

  const rows = React.useMemo(() => {
    const described = records
      .map((record) => describeLedgerRecord(record, registry))
      .filter((row): row is LedgerRow => row !== null)
    // Anything still moving is the reason the page was opened, so it leads.
    const pending = described.filter((row) => PENDING_STATUSES.has(row.status))
    const settled = described.filter((row) => !PENDING_STATUSES.has(row.status))
    return [...pending, ...settled].slice(0, 5)
  }, [records, registry])

  const pendingCount = React.useMemo(
    () => records.filter((record) => PENDING_STATUSES.has(String(record.status))).length,
    [records],
  )

  return (
    <CardShell data-onboarding="dash-activity">
      <CardHeader
        title="Activity"
        subtitle="Your latest movements"
        badge={
          pendingCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-chip px-2 py-0.5 text-[11px] font-semibold text-warning">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warning" />
              {pendingCount} in flight
            </span>
          ) : undefined
        }
        link={{ label: "View all", href: "/transactions" }}
      />

      {loading && records.length === 0 ? (
        <SkeletonRows rows={4} label="Loading activity" />
      ) : rows.length === 0 ? (
        <SystemEmptyState
          illustration="noTransactions"
          title="No activity yet"
          description="Deposits, withdrawals and swaps land here the moment they're made."
        />
      ) : (
        <div className="flex flex-col divide-y divide-border/20 px-1 pb-2">
          {rows.map((row) => {
            const pending = PENDING_STATUSES.has(row.status)
            const failed = row.status === "failed"
            const explorer = row.txHash ? explorerTxUrl(row.networkId, row.txHash) : null
            /* Every row now goes somewhere. They linked nowhere before, which
               on the card answering "did it arrive?" left the one question it
               raises with no way to check. */
            const body = (
              <>
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    failed ? "bg-debit-chip" : pending ? "bg-warning-chip" : "bg-foreground/[0.05]"
                  }`}
                >
                  {row.icon || row.kind === "trade" ? (
                    <CoinAvatar symbol={row.symbol} src={row.icon} size="sm" />
                  ) : (
                    <HugeiconsIcon
                      icon={pending ? Clock01Icon : iconFor(row)}
                      className={`h-[17px] w-[17px] ${
                        failed ? "text-debit" : pending ? "text-warning" : "text-muted-foreground"
                      }`}
                    />
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[13.5px] font-medium">
                      {row.label} {row.symbol}
                    </span>
                    <StatusChip status={row.status} />
                  </span>
                  <span className="truncate text-[12px] text-muted-foreground">
                    {row.networkId ? `${chainLabel(row.networkId)} · ` : ""}
                    {timeAgo(row.createdAt)}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end leading-tight">
                  {/* A number we cannot state honestly is left out, never
                      printed as zero. */}
                  {row.amountText && (
                    <span
                      className={`text-[13.5px] font-semibold tabular-nums ${
                        failed
                          ? "text-muted-foreground line-through"
                          : row.direction === "in"
                            ? "text-credit"
                            : row.direction === "out"
                              ? "text-debit"
                              : ""
                      }`}
                    >
                      {row.direction === "in" ? "+" : row.direction === "out" ? "−" : ""}
                      {row.amountText}
                    </span>
                  )}
                  {row.valueUsd !== null && (
                    <span className="text-[11.5px] tabular-nums text-muted-foreground">
                      ${row.valueUsd.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: row.valueUsd < 1 ? 4 : 2,
                      })}
                    </span>
                  )}
                </span>
              </>
            )
            const className =
              "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent/40"
            return explorer ? (
              <a
                key={row.id}
                href={explorer}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
              >
                {body}
              </a>
            ) : (
              <Link key={row.id} href="/transactions" className={className}>
                {body}
              </Link>
            )
          })}
        </div>
      )}
    </CardShell>
  )
}

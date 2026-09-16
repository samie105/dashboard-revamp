"use client"

/**
 * Recent movements — money crossing the wallet's boundary.
 *
 * The wallet page had no history at all: it showed what you hold and nothing
 * about how it got there, so "did my deposit land?" meant leaving for the
 * transactions page and coming back.
 *
 * Both kinds of row live here — transfers in and out, and the trades that
 * changed what is in the wallet — because they come off one ledger and
 * splitting them would make the list lie by omission about why a balance
 * moved. The filter narrows it; the default shows everything.
 *
 * ── What the preview had and this does not ────────────────────────────────
 * Confirmation counts. "7/12 confirmations" is the single most useful thing a
 * pending deposit can tell you, and the ledger does not carry it — only the
 * status word. So the pill says "Pending" and links to the explorer, which is
 * where the count actually lives, rather than inventing a fraction.
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
import { CardShell, CardHeader, Segmented, SkeletonRows, EmptyState } from "@/components/ui/system"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { CARD_HUE } from "@/components/ui/surface"
import { useLedgerRecords } from "@/hooks/useLedgerRecords"
import { useSpotRegistry } from "@/hooks/useSpotRegistry"
import { describeLedgerRecord, type LedgerRow } from "@/lib/ledger-rows"
import { explorerTxUrl } from "@/lib/crypto-backend/network-meta"

type Tab = "all" | "in" | "out" | "trade"

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "in", label: "In" },
  { key: "out", label: "Out" },
  { key: "trade", label: "Trades" },
]

const ROW_ICON = {
  in: ArrowDownLeft01Icon,
  out: ArrowUpRight01Icon,
  neutral: ArrowDataTransferHorizontalIcon,
} as const

const MAX_ROWS = 8

function usd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value < 1 ? 4 : 2,
  }).format(value)
}

/** Relative time, computed against a clock read in an effect rather than at
 *  render — the server has no business guessing the reader's "now", and a
 *  render-time Date.now() is a hydration mismatch waiting to happen. */
function ago(iso: string | null, now: number): string {
  if (!iso) return ""
  const then = Date.parse(iso)
  if (!Number.isFinite(then)) return ""
  const minutes = Math.max(0, Math.round((now - then) / 60_000))
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`
  const days = Math.round(minutes / 1440)
  return days === 1 ? "Yesterday" : `${days}d ago`
}

function StatusPill({ status }: { status: string }) {
  const settled = /confirm|success|complete/i.test(status)
  const failed = /fail|error|revert|cancel/i.test(status)
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11.5px] font-semibold capitalize",
        failed
          ? "bg-debit-chip text-debit"
          : settled
            ? "bg-credit-chip text-credit"
            : "bg-warning-chip text-warning",
      )}
    >
      {!settled && !failed && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-warning" />
        </span>
      )}
      {status}
    </span>
  )
}

function Row({ row, now }: { row: LedgerRow; now: number }) {
  const href = explorerTxUrl(row.networkId, row.txHash)
  const when = ago(row.createdAt, now)

  const body = (
    <>
      <span
        className={cn(
          "ws-icon-mono flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          row.direction === "in"
            ? "bg-credit-chip text-credit"
            : row.direction === "out"
              ? "bg-debit-chip text-debit"
              : "bg-convert-chip text-primary",
        )}
      >
        <HugeiconsIcon icon={ROW_ICON[row.direction]} className="h-4 w-4" />
      </span>

      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[13.5px] font-semibold">{row.label}</span>
          <CoinAvatar symbol={row.symbol} src={row.icon ?? undefined} size="sm" />
          <span className="truncate text-[12.5px] text-muted-foreground">{row.symbol}</span>
        </span>
        {when && <span className="truncate text-[11.5px] text-muted-foreground">{when}</span>}
      </span>

      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="flex items-center gap-1.5">
          {/* The amount is what the ledger stated, or nothing. A dash beats a
              number nobody can stand behind. */}
          <span
            className={cn(
              "whitespace-nowrap text-[13px] font-semibold tabular-nums",
              row.direction === "in" ? "text-credit" : row.direction === "out" ? "text-debit" : "",
            )}
          >
            {row.amountText ?? "—"}
          </span>
          {href && (
            <HugeiconsIcon
              icon={LinkSquare02Icon}
              className="ws-icon-mono h-3 w-3 shrink-0 text-muted-foreground/40"
            />
          )}
        </span>
        <span className="flex items-center gap-2">
          {row.valueUsd !== null && (
            <span className="whitespace-nowrap text-[11.5px] tabular-nums text-muted-foreground">
              {usd(row.valueUsd)}
            </span>
          )}
          <StatusPill status={row.status} />
        </span>
      </span>
    </>
  )

  const cls = "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-accent/40"

  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {body}
    </a>
  ) : (
    <span className={cls}>{body}</span>
  )
}

export function Movements() {
  const { records, loading } = useLedgerRecords()
  // The registry names the tokens a swap moved; without it a trade row can
  // only say "swap" where a symbol belongs.
  const registry = useSpotRegistry()
  const [tab, setTab] = React.useState<Tab>("all")

  // The clock, read once on mount and then on an interval — never at render.
  const [now, setNow] = React.useState(0)
  React.useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const rows = React.useMemo(
    () =>
      records
        .map((record) => describeLedgerRecord(record, registry))
        .filter((row): row is LedgerRow => row !== null),
    [records, registry],
  )

  const filtered = React.useMemo(() => {
    if (tab === "all") return rows
    if (tab === "trade") return rows.filter((r) => r.kind === "trade")
    return rows.filter((r) => r.kind === "transfer" && r.direction === tab)
  }, [rows, tab])

  return (
    <CardShell className={CARD_HUE}>
      <CardHeader
        title="Recent movements"
        subtitle={
          rows.length === 0 ? undefined : `${rows.length} on this wallet`
        }
        link={{ label: "View all", href: "/transactions" }}
      />

      <div className="px-4 pb-3">
        <Segmented
          size="sm"
          options={TABS.map((t) => ({ key: t.key, label: t.label }))}
          value={tab}
          onChange={(k) => setTab(k as Tab)}
        />
      </div>

      {loading && rows.length === 0 ? (
        <SkeletonRows rows={5} label="Loading movements" />
      ) : filtered.length === 0 ? (
        <EmptyState
          illustration="noTransactions"
          title={rows.length === 0 ? "Nothing has moved yet" : "Nothing under this filter"}
          description={
            rows.length === 0
              ? "Deposits, withdrawals and trades land here the moment they're made."
              : "Switch back to All to see everything on this wallet."
          }
        />
      ) : (
        <div className="flex flex-1 flex-col divide-y divide-border/20 px-1 pb-1">
          {filtered.slice(0, MAX_ROWS).map((row) => (
            <Row key={row.id} row={row} now={now} />
          ))}
        </div>
      )}
    </CardShell>
  )
}

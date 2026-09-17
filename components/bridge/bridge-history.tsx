"use client"

/**
 * Bridges in flight, and the ones that landed.
 *
 * This is the half the live bridge page did not have at all. You pressed its
 * button and the screen told you nothing further — but a bridge is the
 * slowest thing in the product (Arbitrum finality, then Intertrain consensus
 * minting), and those minutes are exactly when someone re-sends, or opens
 * support, or decides the money is gone.
 *
 * ── One bridge is TWO records ─────────────────────────────────────────────
 * A first-time bridge writes `bridge-approve` and then `bridge-deposit`; a
 * later one writes only the deposit. Listing both as rows would report two
 * transfers where the user made one, and inflate the count on exactly the
 * screen where they are counting their own money.
 *
 * So the DEPOSITS are the transfers. An approval only surfaces when it has no
 * deposit after it yet, which is a real and confusing state — the signature is
 * done, nothing appears to be moving, and the reason is that the allowance is
 * still confirming. That gets said in words rather than shown as a row.
 *
 * Every figure is the ledger's own. The preview this came from drew a
 * per-stage progress bar with a countdown; the ledger carries a status word
 * and a timestamp and no ETA at all, so there is no bar here. A progress bar
 * advancing on a guessed duration is worse than no bar, because it sets an
 * expectation the backend never made.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, LinkSquare02Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { CardShell, CardHeader, EmptyState, SkeletonRows } from "@/components/ui/system"
import { CARD_HUE } from "@/components/ui/surface"
import { useLedgerRecords } from "@/hooks/useLedgerRecords"
import { explorerTxUrl } from "@/lib/crypto-backend/network-meta"

const MAX_ROWS = 6

type BridgeRow = {
  id: string
  amount: string | null
  status: string
  networkId: string
  txHash: string
  at: string | null
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined
}

/** Relative time against a clock read in an effect — never at render, which
 *  is how a server and a client end up disagreeing about "now". */
function ago(iso: string | null, now: number): string {
  if (!iso || now === 0) return ""
  const then = Date.parse(iso)
  if (!Number.isFinite(then)) return ""
  const minutes = Math.max(0, Math.round((now - then) / 60_000))
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`
  const days = Math.round(minutes / 1440)
  return days === 1 ? "Yesterday" : `${days}d ago`
}

function settledOf(status: string) {
  return /confirm|success|complete/i.test(status)
}
function failedOf(status: string) {
  return /fail|error|revert|cancel/i.test(status)
}

function StatusPill({ status }: { status: string }) {
  const settled = settledOf(status)
  const failed = failedOf(status)
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-1 text-[11.5px] font-semibold capitalize",
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
      {settled ? "Landed" : failed ? "Failed" : "In flight"}
    </span>
  )
}

function Row({ row, now }: { row: BridgeRow; now: number }) {
  const href = row.networkId && row.txHash ? explorerTxUrl(row.networkId, row.txHash) : null
  const when = ago(row.at, now)

  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        {/* The route is fixed for this bridge, so it is stated on every row
            rather than made to look like a choice that was made. */}
        <span className="flex items-center gap-1.5 text-[13px] font-semibold">
          <span>USDC</span>
          <HugeiconsIcon icon={ArrowRight01Icon} className="ws-icon-mono h-3.5 w-3.5 text-muted-foreground" />
          <span>WSK</span>
        </span>
        <span className="truncate text-[11.5px] text-muted-foreground">
          Arbitrum → Intertrain{when ? ` · ${when}` : ""}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-2.5">
        <span className="whitespace-nowrap text-[13px] font-semibold tabular-nums">
          {row.amount ? `${row.amount} USDC` : "—"}
        </span>
        <StatusPill status={row.status} />
        {href && (
          <HugeiconsIcon
            icon={LinkSquare02Icon}
            className="ws-icon-mono h-3 w-3 shrink-0 text-muted-foreground/40"
          />
        )}
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

export function BridgeHistory() {
  const { records, loading } = useLedgerRecords(50)

  const [now, setNow] = React.useState(0)
  React.useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const { rows, awaitingApproval } = React.useMemo(() => {
    const deposits: BridgeRow[] = []
    let pendingApproval = false

    for (const record of records) {
      const summary = (record.summary ?? {}) as Record<string, unknown>
      const action = text(summary.action)
      if (action !== "bridge-deposit" && action !== "bridge-approve") continue

      if (action === "bridge-approve") {
        // Only interesting while it is still confirming; once the deposit
        // exists the approval is plumbing nobody needs to read about.
        if (!settledOf(record.status) && !failedOf(record.status)) pendingApproval = true
        continue
      }

      deposits.push({
        id: record.id,
        amount: text(summary.amount) ?? null,
        status: record.status,
        // The ledger types both as optional; a row without them still lists,
        // it just cannot link to an explorer.
        networkId: record.networkId ?? "",
        txHash: record.txHash ?? "",
        at: record.submittedAt ?? record.createdAt ?? null,
      })
    }

    // An approval only counts as "waiting" when no deposit has followed it.
    const anyInFlight = deposits.some((d) => !settledOf(d.status) && !failedOf(d.status))
    return { rows: deposits, awaitingApproval: pendingApproval && !anyInFlight }
  }, [records])

  const inFlight = rows.filter((r) => !settledOf(r.status) && !failedOf(r.status)).length
  const shown = rows.slice(0, MAX_ROWS)

  return (
    <CardShell className={CARD_HUE}>
      <CardHeader
        title="Your bridges"
        subtitle={
          rows.length === 0
            ? undefined
            : inFlight > 0
              ? `${inFlight} in flight · ${rows.length} total`
              : `${rows.length} completed`
        }
      />

      {awaitingApproval && (
        /* The signature is done and nothing appears to be moving. Saying why
           is the whole reason this state is called out. */
        <div className="mx-4 mb-3 flex flex-col gap-1 rounded-2xl bg-warning-chip p-3.5">
          <span className="text-[12.5px] font-semibold text-warning">Approval still confirming</span>
          <span className="text-[12px] leading-relaxed text-muted-foreground">
            You&apos;ve approved USDC for the bridge and Arbitrum is still confirming it. The deposit
            starts on its own once that lands.
          </span>
        </div>
      )}

      {loading && rows.length === 0 ? (
        <SkeletonRows rows={3} label="Loading bridges" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No bridges yet"
          description="USDC you move into Intertrain appears here with its progress, from signing to minted WSK."
        />
      ) : (
        <div className="flex flex-1 flex-col divide-y divide-border/20 px-1 pb-1">
          {shown.map((row) => (
            <Row key={row.id} row={row} now={now} />
          ))}
        </div>
      )}
    </CardShell>
  )
}

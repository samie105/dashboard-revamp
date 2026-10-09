"use client"

/**
 * The preview's "Recent activity" and "Limits & security" panels
 * (components/wallet-unauth/activity.tsx) on real data. Same markup; only
 * the data is swapped.
 *
 * Activity — the wallet's own ledger (useLedgerRecords + describeLedgerRecord,
 * exactly what the old Movements card read). The preview's Transfers tab
 * becomes Trades: there are no internal transfers on this wallet, but trades
 * move its balances and the old list showed them. The ledger carries no
 * confirmation count, so a pending row says Pending with its network and
 * time rather than inventing "7/12"; rows with a hash still open the
 * explorer. Added: loading skeleton and the two empty states.
 *
 * Limits & security — the wallet has no withdrawal-limit data, so the limit
 * box keeps its shape with "—". The checklist rows are the real security
 * doors (the WalletSecurityModal entries plus unlock), each opening its pane.
 */

import * as React from "react"
import { motion } from "motion/react"
import {
  ArrowDownLeft01Icon,
  ArrowLeftRightIcon,
  ArrowRight01Icon,
  ArrowUpRight01Icon,
  Key01Icon,
  PlusSignIcon,
  Shield01Icon,
  SquareLock02Icon,
  SquareUnlock02Icon,
} from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { Figure, Icon, MoreLink, Panel, PanelTitle, PillTabs, type IconSvg } from "@/components/dashboard/redesign/ui"
import { useLedgerRecords } from "@/hooks/useLedgerRecords"
import { useSpotRegistry } from "@/hooks/useSpotRegistry"
import { describeLedgerRecord, type LedgerRow } from "@/lib/ledger-rows"
import { explorerTxUrl } from "@/lib/crypto-backend/network-meta"
import { usd } from "@/lib/num"
import { filterActivity, statusTone, type ActivityFilter } from "@/lib/wallet-view"

/* ── Activity ─────────────────────────────────────────────────────────── */

const MAX_ROWS = 8

const STATUS: Record<ReturnType<typeof statusTone>, { label: string; className: string }> = {
  completed: { label: "Completed", className: "bg-credit/[0.12] text-credit" },
  pending: { label: "Pending", className: "bg-warning/[0.12] text-warning" },
  failed: { label: "Failed", className: "bg-debit/[0.12] text-debit" },
}

function kindOf(row: LedgerRow): { label: string; icon: IconSvg; badge: string } {
  if (row.kind === "trade") return { label: row.label, icon: ArrowLeftRightIcon, badge: "bg-primary text-primary-foreground" }
  return row.direction === "in"
    ? { label: "Deposit", icon: ArrowDownLeft01Icon, badge: "bg-credit text-background" }
    : { label: "Withdrawal", icon: ArrowUpRight01Icon, badge: "bg-foreground text-background" }
}

/** Relative time against a clock read in an effect, never at render. */
function useAgo() {
  const [now, setNow] = React.useState(0)
  React.useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])
  return (iso: string | null) => {
    if (!now || !iso) return ""
    const then = Date.parse(iso)
    if (!Number.isFinite(then)) return ""
    const m = Math.max(0, Math.round((now - then) / 60_000))
    return m < 1 ? "Just now" : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`
  }
}

export function WalletActivity({ networkName }: { networkName: (networkId: string) => string }) {
  const { records, loading } = useLedgerRecords()
  const registry = useSpotRegistry()
  const [filter, setFilter] = React.useState<ActivityFilter>("all")
  const ago = useAgo()

  const all = React.useMemo(
    () => records.map((record) => describeLedgerRecord(record, registry)).filter((row): row is LedgerRow => row !== null),
    [records, registry],
  )
  const rows = filterActivity(all, filter).slice(0, MAX_ROWS)

  return (
    <Panel className="flex flex-col gap-4 px-3 pb-3 pt-5 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-3 px-2">
        <div className="flex items-baseline gap-2.5">
          <PanelTitle className="text-[17px]">Recent activity</PanelTitle>
          {all.length > 0 && <span className="text-[12.5px] text-muted-foreground">{all.length} on this wallet</span>}
        </div>
        <div className="flex items-center gap-4">
          <PillTabs
            id="wallet-activity"
            size="sm"
            options={[
              { key: "all", label: "All" },
              { key: "deposit", label: "Deposits" },
              { key: "withdrawal", label: "Withdrawals" },
              { key: "trade", label: "Trades" },
            ]}
            value={filter}
            onChange={setFilter}
          />
          <span className="hidden sm:block">
            <MoreLink icon={ArrowRight01Icon} href="/transactions">
              View all
            </MoreLink>
          </span>
        </div>
      </div>

      {loading && all.length === 0 ? (
        <ul className="flex flex-col" aria-label="Loading activity">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="flex items-center gap-3.5 px-2 py-3 sm:px-3">
              <span className="skel size-10 shrink-0 rounded-full" />
              <span className="flex flex-1 flex-col gap-1.5">
                <span className="skel h-3.5 w-32 rounded" />
                <span className="skel h-3 w-24 rounded" />
              </span>
              <span className="skel h-4 w-20 rounded" />
            </li>
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-1 px-6 py-10 text-center">
          <p className="text-[14px] font-semibold text-foreground">{all.length === 0 ? "Nothing has moved yet" : "Nothing under this filter"}</p>
          <p className="text-[13px] text-muted-foreground">
            {all.length === 0 ? "Deposits, withdrawals and trades land here the moment they're made." : "Switch back to All to see everything on this wallet."}
          </p>
        </div>
      ) : (
        <motion.ul layout className="flex flex-col">
          {rows.map((m, i) => {
            const kind = kindOf(m)
            const tone = statusTone(m.status)
            const status = STATUS[tone]
            const href = explorerTxUrl(m.networkId, m.txHash)
            const body = (
              <>
                <span className="relative shrink-0">
                  <CoinAvatar symbol={m.symbol} src={m.icon ?? undefined} size="lg" className="size-10 ring-1 ring-foreground/10" />
                  <span className={cn("absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full border-2 border-card", kind.badge)}>
                    <Icon icon={kind.icon} className="size-3" strokeWidth={2.4} />
                  </span>
                </span>

                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[13.5px] font-semibold text-foreground">
                      {kind.label} {m.symbol}
                    </span>
                    <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.04em]", status.className)}>
                      {status.label}
                    </span>
                  </span>
                  <span className="truncate text-[12px] text-muted-foreground">
                    {[networkName(m.networkId), ago(m.createdAt)].filter(Boolean).join(" · ")}
                  </span>
                </span>

                <span className="flex flex-col items-end tabular-nums">
                  <span
                    className={cn(
                      "text-[13.5px] font-semibold",
                      tone === "failed" ? "text-muted-foreground line-through decoration-debit/60" : m.kind === "transfer" && m.direction === "in" ? "text-credit" : "text-foreground",
                    )}
                  >
                    {m.amountText ? (
                      <Figure mask="••••">{`${m.kind === "transfer" ? (m.direction === "in" ? "+" : "−") : ""}${m.amountText}`}</Figure>
                    ) : (
                      "—"
                    )}
                  </span>
                  <span className="text-[12px] text-muted-foreground">
                    {m.valueUsd !== null ? <Figure mask="••••">{usd(m.valueUsd)}</Figure> : "—"}
                  </span>
                </span>
              </>
            )
            const cls = "flex items-center gap-3.5 rounded-xl px-2 py-3 transition-colors hover:bg-foreground/[0.025] sm:px-3"
            return (
              <motion.li
                key={m.id}
                layout="position"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: i * 0.03, ease: [0.22, 1, 0.36, 1] }}
              >
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
                    {body}
                  </a>
                ) : (
                  <div className={cls}>{body}</div>
                )}
              </motion.li>
            )
          })}
        </motion.ul>
      )}
    </Panel>
  )
}

/* ── Security & limits ────────────────────────────────────────────────── */

export type SecurityView = "locks" | "recovery" | "export" | "networks"

export function SecurityLimits({
  chainsOn,
  networksToAdd,
  canOpen,
  onOpen,
  onUnlock,
}: {
  /** Chain families this wallet holds keys for. */
  chainsOn: number
  /** Families that could still be added (0 hides that row). */
  networksToAdd: number
  /** The security panes need the wallet package; until it loads they can't open. */
  canOpen: boolean
  onOpen: (view: SecurityView) => void
  onUnlock: () => void
}) {
  const rows: { key: string; label: string; icon: IconSvg; flagged?: boolean; action: string; run: () => void; needsPackage?: boolean }[] = [
    ...(networksToAdd > 0
      ? [{ key: "networks", label: `Add ${networksToAdd} ${networksToAdd === 1 ? "network" : "networks"}`, icon: PlusSignIcon, flagged: true, action: "Add", run: () => onOpen("networks"), needsPackage: true }]
      : []),
    { key: "unlock", label: "Unlock this wallet", icon: SquareUnlock02Icon, action: "Unlock", run: onUnlock },
    { key: "locks", label: "Passphrase and backup", icon: SquareLock02Icon, action: "Open", run: () => onOpen("locks"), needsPackage: true },
    { key: "recovery", label: "Get back in", icon: Shield01Icon, action: "Open", run: () => onOpen("recovery"), needsPackage: true },
    { key: "export", label: "Move an account to another app", icon: Key01Icon, action: "Open", run: () => onOpen("export"), needsPackage: true },
  ]

  return (
    <Panel className="flex flex-col gap-5 p-5">
      <div className="flex items-center justify-between">
        <PanelTitle className="text-[16px]">Limits &amp; security</PanelTitle>
        <span className="text-[12px] font-medium tabular-nums text-muted-foreground">
          {chainsOn}/{chainsOn + networksToAdd} networks on
        </span>
      </div>

      <div className="flex flex-col gap-2.5 rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02] p-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[12.5px] font-medium text-muted-foreground">24h withdrawal limit</span>
          <span className="text-[12px] font-semibold tabular-nums text-muted-foreground">—</span>
        </div>
        <span className="font-display text-[20px] font-semibold tracking-[-0.02em] tabular-nums text-foreground">—</span>
        <span className="relative h-2 overflow-hidden rounded-full bg-foreground/[0.07]" />
        <span className="text-[12px] text-muted-foreground">Withdrawal limits aren&apos;t available for this wallet yet.</span>
      </div>

      <ul className="flex flex-col gap-1">
        {rows.map((f) => {
          const disabled = f.needsPackage && !canOpen
          return (
            <li key={f.key} className="flex items-center gap-3 rounded-xl px-1 py-2">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full",
                  f.flagged ? "bg-primary/[0.14] text-primary" : "bg-foreground/[0.05] text-muted-foreground",
                )}
              >
                <Icon icon={f.icon} className="size-3.5" strokeWidth={2.2} />
              </span>
              <span className="flex-1 text-[13.5px] text-foreground">{f.label}</span>
              <button
                type="button"
                onClick={f.run}
                disabled={disabled}
                className="text-[12.5px] font-semibold text-primary hover:opacity-85 disabled:cursor-not-allowed disabled:text-muted-foreground/50 disabled:hover:opacity-100"
              >
                {f.action}
              </button>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

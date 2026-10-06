"use client"

/**
 * Wallet activity and account safety — the two things that answer "why
 * hasn't my money arrived / left yet?".
 *
 *  · Activity: deposits, withdrawals and transfers with a settlement state.
 *    A pending deposit shows its confirmations as progress, because "7 of 12"
 *    is the answer to the question someone opens this screen to ask.
 *  · Security & limits: how much can still leave today, and what would raise
 *    the ceiling.
 */

import * as React from "react"
import Link from "next/link"
import { motion } from "motion/react"
import {
  ArrowDownLeft01Icon,
  ArrowLeftRightIcon,
  ArrowRight01Icon,
  ArrowUpRight01Icon,
  Cancel01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { PREVIEW_ROUTES } from "@/components/preview/routes"
import { MOVEMENTS, SECURITY_FLAGS, WITHDRAWAL_LIMIT, formatAmount, formatUSD, type Movement } from "@/components/wallet-unauth/wallet-data"
import { Figure, Icon, MoreLink, Panel, PanelTitle, PillTabs, type IconSvg } from "@/components/redesign/ui"

/* ── Activity ─────────────────────────────────────────────────────────── */

type Filter = "all" | Movement["kind"]

const KIND: Record<Movement["kind"], { label: string; icon: IconSvg; sign: string }> = {
  deposit: { label: "Deposit", icon: ArrowDownLeft01Icon, sign: "+" },
  withdrawal: { label: "Withdrawal", icon: ArrowUpRight01Icon, sign: "−" },
  transfer: { label: "Transfer", icon: ArrowLeftRightIcon, sign: "" },
}

const STATUS: Record<Movement["status"], { label: string; className: string }> = {
  completed: { label: "Completed", className: "bg-credit/[0.12] text-credit" },
  pending: { label: "Pending", className: "bg-warning/[0.12] text-warning" },
  failed: { label: "Failed", className: "bg-debit/[0.12] text-debit" },
}

function useAgo() {
  const [ready, setReady] = React.useState(false)
  React.useEffect(() => setReady(true), [])
  return (m: number) => (!ready ? " " : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`)
}

export function WalletActivity() {
  const [filter, setFilter] = React.useState<Filter>("all")
  const ago = useAgo()
  const rows = MOVEMENTS.filter((m) => filter === "all" || m.kind === filter)

  return (
    <Panel className="flex flex-col gap-4 px-3 pb-3 pt-5 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-3 px-2">
        <div className="flex items-baseline gap-2.5">
          <PanelTitle className="text-[17px]">Recent activity</PanelTitle>
          <span className="text-[12.5px] text-muted-foreground">Last 30 days</span>
        </div>
        <div className="flex items-center gap-4">
          <PillTabs
            id="wallet-activity"
            size="sm"
            options={[
              { key: "all", label: "All" },
              { key: "deposit", label: "Deposits" },
              { key: "withdrawal", label: "Withdrawals" },
              { key: "transfer", label: "Transfers" },
            ]}
            value={filter}
            onChange={setFilter}
          />
          <span className="hidden sm:block">
            <MoreLink icon={ArrowRight01Icon} href={PREVIEW_ROUTES.transactions}>
              View all
            </MoreLink>
          </span>
        </div>
      </div>

      <motion.ul layout className="flex flex-col">
        {rows.map((m, i) => {
          const kind = KIND[m.kind]
          const status = STATUS[m.status]
          return (
            <motion.li
              key={m.id}
              layout="position"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: i * 0.03, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-3.5 rounded-xl px-2 py-3 transition-colors hover:bg-white/[0.025] sm:px-3"
            >
              <span className="relative shrink-0">
                <CoinAvatar symbol={m.symbol} size="lg" className="size-10 ring-1 ring-white/10" />
                <span
                  className={cn(
                    "absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full border-2 border-[#0f0f0f]",
                    m.kind === "deposit" ? "bg-credit text-black" : m.kind === "withdrawal" ? "bg-foreground text-black" : "bg-primary text-black",
                  )}
                >
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
                {m.status === "pending" && m.confirmations ? (
                  <span className="flex items-center gap-2">
                    <span className="relative h-1 w-24 overflow-hidden rounded-full bg-white/[0.08]">
                      <motion.span
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: m.confirmations[0] / m.confirmations[1] }}
                        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute inset-0 origin-left rounded-full bg-warning"
                      />
                    </span>
                    <span className="text-[11.5px] tabular-nums text-muted-foreground">
                      {m.confirmations[0]}/{m.confirmations[1]} confirmations
                    </span>
                  </span>
                ) : (
                  <span className="truncate text-[12px] text-muted-foreground">
                    {m.network} · {ago(m.minutesAgo)}
                  </span>
                )}
              </span>

              <span className="flex flex-col items-end tabular-nums">
                <span
                  className={cn(
                    "text-[13.5px] font-semibold",
                    m.status === "failed" ? "text-muted-foreground line-through decoration-debit/60" : m.kind === "deposit" ? "text-credit" : "text-foreground",
                  )}
                >
                  <Figure mask="••••">{`${kind.sign}${formatAmount(m.amount)} ${m.symbol}`}</Figure>
                </span>
                <span className="text-[12px] text-muted-foreground">
                  <Figure mask="••••">{formatUSD(m.usd)}</Figure>
                </span>
              </span>
            </motion.li>
          )
        })}
      </motion.ul>
    </Panel>
  )
}

/* ── Security & limits ────────────────────────────────────────────────── */

export function SecurityLimits() {
  const used = WITHDRAWAL_LIMIT.used / WITHDRAWAL_LIMIT.total
  const done = SECURITY_FLAGS.filter((f) => f.done).length

  return (
    <Panel className="flex flex-col gap-5 p-5">
      <div className="flex items-center justify-between">
        <PanelTitle className="text-[16px]">Limits &amp; security</PanelTitle>
        <span className="text-[12px] font-medium tabular-nums text-muted-foreground">
          {done}/{SECURITY_FLAGS.length} protections on
        </span>
      </div>

      <div className="flex flex-col gap-2.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[12.5px] font-medium text-muted-foreground">24h withdrawal limit</span>
          <span className="text-[12px] font-semibold tabular-nums text-muted-foreground">{Math.round(used * 100)}% used</span>
        </div>
        <span className="font-display text-[20px] font-semibold tracking-[-0.02em] tabular-nums text-foreground">
          {formatUSD(WITHDRAWAL_LIMIT.total - WITHDRAWAL_LIMIT.used, { maxFrac: 0 })}
          <span className="ml-1.5 text-[13px] font-medium text-muted-foreground">left of {formatUSD(WITHDRAWAL_LIMIT.total, { maxFrac: 0 })}</span>
        </span>
        <span className="relative h-2 overflow-hidden rounded-full bg-white/[0.07]">
          <motion.span
            initial={{ scaleX: 0 }}
            animate={{ scaleX: used }}
            transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 origin-left rounded-full bg-gradient-to-r from-primary/70 to-primary"
          />
        </span>
        <span className="text-[12px] text-muted-foreground">Verify your identity to raise this to $2,000,000.</span>
      </div>

      <ul className="flex flex-col gap-1">
        {SECURITY_FLAGS.map((f) => (
          <li key={f.label} className="flex items-center gap-3 rounded-xl px-1 py-2">
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full",
                f.done ? "bg-credit/[0.12] text-credit" : "bg-white/[0.05] text-muted-foreground",
              )}
            >
              <Icon icon={f.done ? Tick02Icon : Cancel01Icon} className="size-3.5" strokeWidth={2.4} />
            </span>
            <span className={cn("flex-1 text-[13.5px]", f.done ? "text-foreground/90" : "text-foreground")}>{f.label}</span>
            {!f.done && (
              <Link href="#" className="text-[12.5px] font-semibold text-primary hover:opacity-85">
                Turn on
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  )
}

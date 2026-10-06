"use client"

/**
 * The wallet hero: what you hold in total, and where it sits.
 *
 * The dashboard answers "how is my portfolio doing" with a curve. The wallet
 * answers "where is my money" — so this hero leads with the total and then
 * splits it two ways: by STATE (available, in orders, locked) and by ACCOUNT
 * (one bar, four cards). Both splits are summed from the same rows as the
 * total, so they always reconcile.
 *
 * On a phone only the total shows; the two splits fold away behind a
 * "Breakdown" toggle. Above them sits the action panel the person most likely
 * came for, and a full-height hero pushed it a whole screen down.
 */

import * as React from "react"
import { motion } from "motion/react"
import { ArrowDown01Icon, ViewIcon, ViewOffSlashIcon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { RollingAmount } from "@/components/ui/rolling-amount"
import {
  ACCOUNTS,
  ACCOUNT_TOTALS,
  STATE_TOTALS,
  WALLET_BTC,
  WALLET_DAY_PCT,
  WALLET_DAY_PNL,
  WALLET_TOTAL,
  formatUSD,
} from "@/components/wallet-unauth/wallet-data"
import { ChangeChip, Figure, Icon, Panel, usePrivacy } from "@/components/redesign/ui"

/** Gold ramp by rank — the account colours mean "first, second, third", not
 *  anything about the account itself. */
const ACCOUNT_TONES = ["bg-primary", "bg-primary/60", "bg-primary/30", "bg-white/20"]
const RANKED = [...ACCOUNTS].sort((a, b) => ACCOUNT_TOTALS[b.key] - ACCOUNT_TOTALS[a.key])
const tone = (key: string) => ACCOUNT_TONES[RANKED.findIndex((a) => a.key === key)]

/* ── Breakdown pieces (shared by the desktop layout and the phone fold) ── */

function StateGrid({ className }: { className?: string }) {
  return (
    <dl className={cn("grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.06]", className)}>
      {[
        { k: "Available", v: STATE_TOTALS.available, hint: "Free to move" },
        { k: "In orders", v: STATE_TOTALS.inOrder, hint: "Resting on books" },
        { k: "Locked", v: STATE_TOTALS.locked, hint: "Margin & staking" },
      ].map((s) => (
        <div key={s.k} className="flex flex-col gap-1 bg-[#111] px-3.5 py-3 sm:px-4">
          <dt className="text-[12px] font-medium text-muted-foreground">{s.k}</dt>
          <dd className="truncate font-display text-[16px] font-semibold tabular-nums text-foreground sm:text-[17px]">
            <Figure mask="••••">{formatUSD(s.v, { maxFrac: 0 })}</Figure>
          </dd>
          <dd className="truncate text-[11px] text-muted-foreground/70">{s.hint}</dd>
        </div>
      ))}
    </dl>
  )
}

function AccountSplit({ animateKey }: { animateKey?: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div key={animateKey} className="flex h-2.5 gap-1 overflow-hidden rounded-full">
        {RANKED.map((a, i) => (
          <motion.span
            key={a.key}
            title={`${a.label} · ${((ACCOUNT_TOTALS[a.key] / WALLET_TOTAL) * 100).toFixed(1)}%`}
            initial={{ width: 0 }}
            animate={{ width: `${(ACCOUNT_TOTALS[a.key] / WALLET_TOTAL) * 100}%` }}
            transition={{ duration: 0.9, delay: 0.2 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            className={cn("h-full rounded-full", tone(a.key))}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ACCOUNTS.map((a) => {
          const share = (ACCOUNT_TOTALS[a.key] / WALLET_TOTAL) * 100
          return (
            <div
              key={a.key}
              className="dash-lift group flex flex-col gap-1.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5 hover:bg-white/[0.035]"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
                  <span className={cn("size-2 rounded-full", tone(a.key))} />
                  {a.label}
                </span>
                <span className="text-[12px] font-semibold tabular-nums text-muted-foreground">{share.toFixed(1)}%</span>
              </span>
              <span className="font-display text-[18px] font-semibold tracking-[-0.02em] tabular-nums text-foreground">
                <Figure>{formatUSD(ACCOUNT_TOTALS[a.key])}</Figure>
              </span>
              <span className="truncate text-[12px] text-muted-foreground">{a.caption}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Hero ─────────────────────────────────────────────────────────────── */

export function WalletHero() {
  const { hidden, toggle } = usePrivacy()
  const [open, setOpen] = React.useState(false)
  const regionId = React.useId()

  return (
    <Panel className="flex flex-col gap-5 p-5 md:gap-6 md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
        {/* ── Total ─────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-[14.5px] font-medium text-muted-foreground">Estimated balance</h1>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/80">
              Demo data
            </span>
            <button
              type="button"
              onClick={toggle}
              aria-label={hidden ? "Show balances" : "Hide balances"}
              aria-pressed={hidden}
              className={cn(
                "flex size-7 items-center justify-center rounded-full transition-colors duration-200 hover:bg-white/[0.06]",
                hidden ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon icon={hidden ? ViewOffSlashIcon : ViewIcon} className="size-[17px]" />
            </button>
          </div>
          <div className="font-display text-[42px] font-semibold leading-none tracking-[-0.045em] tabular-nums text-foreground sm:text-[50px]">
            {hidden ? <span className="tracking-[0.04em]">••••••</span> : <RollingAmount value={formatUSD(WALLET_TOTAL)} />}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-[15px] font-medium tabular-nums text-muted-foreground">
              ≈ {hidden ? "••••" : WALLET_BTC.toFixed(6)} <span className="text-foreground/70">BTC</span>
            </span>
            <span aria-hidden className="h-4 w-px bg-white/10" />
            <ChangeChip value={WALLET_DAY_PCT} size="sm" />
            <span className="text-[14px] font-semibold tabular-nums text-credit">
              <Figure mask="••••">+{formatUSD(WALLET_DAY_PNL)}</Figure>
            </span>
            <span className="text-[13px] text-muted-foreground">today</span>
          </div>
        </div>

        {/* Desktop: the state split sits beside the total. */}
        <StateGrid className="hidden min-w-[420px] md:grid" />
      </div>

      {/* Desktop: the account split is always open. */}
      <div className="hidden md:block">
        <AccountSplit />
      </div>

      {/* ── Phone: one row that folds the rest away ─────────────── */}
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={regionId}
          className="flex h-12 w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 text-left transition-colors active:bg-white/[0.05]"
        >
          {/* The collapsed row still says something: a mini split bar and
              what is free to move — the one figure people check first. */}
          <span className="flex h-1.5 w-12 shrink-0 gap-0.5 overflow-hidden rounded-full">
            {RANKED.map((a) => (
              <span key={a.key} className={cn("h-full", tone(a.key))} style={{ width: `${(ACCOUNT_TOTALS[a.key] / WALLET_TOTAL) * 100}%` }} />
            ))}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
            <span className="font-semibold text-foreground">
              <Figure mask="••••">{formatUSD(STATE_TOTALS.available, { maxFrac: 0 })}</Figure>
            </span>{" "}
            available · 4 accounts
          </span>
          <span className="flex items-center gap-1 text-[12.5px] font-semibold text-primary">
            {open ? "Hide" : "Breakdown"}
            <Icon icon={ArrowDown01Icon} className={cn("size-4 transition-transform duration-300", open && "rotate-180")} strokeWidth={2} />
          </span>
        </button>

        {/* Height animates via grid rows 0fr → 1fr: real content height, no
            measuring, and closed content stays out of the tab order. */}
        <div
          id={regionId}
          role="region"
          aria-label="Balance breakdown"
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
            open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
          inert={!open}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="flex flex-col gap-4 pt-4">
              <StateGrid />
              {/* Re-keyed on open so the split bar grows in each time it is
                  revealed, rather than having animated unseen at load. */}
              <AccountSplit animateKey={open ? "open" : "closed"} />
            </div>
          </div>
        </div>
      </div>
    </Panel>
  )
}

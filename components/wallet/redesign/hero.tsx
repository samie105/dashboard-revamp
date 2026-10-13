"use client"

/**
 * The preview's wallet hero (components/wallet-unauth/hero.tsx) on the real
 * wallet: the estimated total (with the privacy toggle), its BTC equivalent
 * and 24h move, the Available / In orders / Locked grid, and the split cards.
 *
 * Swapped for real data:
 *  · the accounts are Spot (the wallet's own holdings — swaps trade
 *    straight from it), Futures (the trading account), and Earn, shown as
 *    "Soon" and never counted. The preview's Funding account has no
 *    counterpart, so the cards share the row three ways instead of four;
 *  · Available / In orders / Locked are summed from those same accounts, so
 *    they reconcile with the total exactly as in the preview;
 *  · an account that can't be read right now shows "—", not $0.
 * Added: loading skeletons, the "as of" sync line and its refresh button,
 * and the old page's "How this wallet works" help button.
 */

import * as React from "react"
import { motion } from "motion/react"
import { ArrowDown01Icon, HelpCircleIcon, RefreshIcon, ViewIcon, ViewOffSlashIcon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { RollingAmount } from "@/components/ui/rolling-amount"
import { ChangeChip, Figure, Icon, Panel, usePrivacy } from "@/components/dashboard/redesign/ui"
import { usd } from "@/lib/num"

/** One account the money sits in. `value` null = not readable right now;
 *  `soon` = the account isn't open yet (shown, never counted). */
export type SplitPart = { key: string; label: string; caption: string; value: number | null; soon?: boolean }
export type StateTotals = { available: number; inOrder: number; locked: number }

/** Gold ramp by rank — the account colours mean "first, second, third", not
 *  anything about the account itself (as in the preview). */
const TONES = ["bg-primary", "bg-primary/60", "bg-primary/30", "bg-foreground/20"]

function useTone(parts: SplitPart[]) {
  const ranked = [...parts].filter((p) => !p.soon && (p.value ?? 0) > 0).sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
  return {
    ranked,
    tone: (key: string) => {
      const i = ranked.findIndex((p) => p.key === key)
      return i < 0 ? "bg-foreground/10" : TONES[i] ?? TONES[TONES.length - 1]
    },
  }
}

function StateGrid({ state, className }: { state: StateTotals; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-foreground/[0.06] bg-foreground/[0.06]", className)}>
      {[
        { k: "Available", v: state.available, hint: "Free to move" },
        { k: "In orders", v: state.inOrder, hint: "Resting on books" },
        { k: "Locked", v: state.locked, hint: "Margin & staking" },
      ].map((s) => (
        <div key={s.k} className="flex flex-col gap-1 bg-card px-3.5 py-3 sm:px-4 dark:bg-[color-mix(in_oklab,var(--card)_55%,var(--background))]">
          <dt className="text-[12px] font-medium text-muted-foreground">{s.k}</dt>
          <dd className="truncate font-display text-[16px] font-semibold tabular-nums text-foreground sm:text-[17px]">
            <Figure mask="••••">{usd(s.v, { min: 0, max: 0 })}</Figure>
          </dd>
          <dd className="truncate text-[11px] text-muted-foreground/70">{s.hint}</dd>
        </div>
      ))}
    </dl>
  )
}

function AccountSplit({ parts, total, animateKey }: { parts: SplitPart[]; total: number; animateKey?: string }) {
  const { ranked, tone } = useTone(parts)
  return (
    <div className="flex flex-col gap-4">
      <div key={animateKey} className="flex h-2.5 gap-1 overflow-hidden rounded-full">
        {total > 0 &&
          ranked.map((p, i) => (
            <motion.span
              key={p.key}
              title={`${p.label} · ${(((p.value ?? 0) / total) * 100).toFixed(1)}%`}
              initial={{ width: 0 }}
              animate={{ width: `${((p.value ?? 0) / total) * 100}%` }}
              transition={{ duration: 0.9, delay: 0.2 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className={cn("h-full rounded-full", tone(p.key))}
            />
          ))}
      </div>

      <div
        className="grid grid-cols-2 gap-3 lg:grid-cols-[repeat(var(--split-n),minmax(0,1fr))]"
        style={{ "--split-n": Math.max(parts.length, 1) } as React.CSSProperties}
      >
        {parts.map((a) => {
          const share = a.value !== null && total > 0 ? (a.value / total) * 100 : null
          return (
            <div
              key={a.key}
              className={cn(
                "ds-lift group flex flex-col gap-1.5 rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02] px-4 py-3.5 hover:bg-foreground/[0.035]",
                a.soon && "opacity-60",
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
                  <span className={cn("size-2 rounded-full", tone(a.key))} />
                  {a.label}
                </span>
                {a.soon ? (
                  <span className="rounded-md bg-foreground/[0.07] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Soon</span>
                ) : (
                  <span className="text-[12px] font-semibold tabular-nums text-muted-foreground">{share === null ? "—" : `${share.toFixed(1)}%`}</span>
                )}
              </span>
              <span className="font-display text-[18px] font-semibold tracking-[-0.02em] tabular-nums text-foreground">
                {a.value === null ? "—" : <Figure>{usd(a.value)}</Figure>}
              </span>
              <span className="truncate text-[12px] text-muted-foreground">{a.caption}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function WalletHero({
  loading,
  total,
  btc,
  dayPct,
  dayPnl,
  parts,
  state,
  syncLine,
  refreshing,
  onRefresh,
  onHelp,
}: {
  loading: boolean
  total: number
  btc: number | null
  dayPct: number | undefined
  dayPnl: number | null
  /** The accounts, in the preview's fixed order. */
  parts: SplitPart[]
  state: StateTotals
  syncLine: string
  refreshing: boolean
  onRefresh: () => void
  /** Re-opens the welcome guide ("How this wallet works"). */
  onHelp: () => void
}) {
  const { hidden, toggle } = usePrivacy()
  const { ranked, tone } = useTone(parts)
  const [open, setOpen] = React.useState(false)
  const regionId = React.useId()

  return (
    <Panel className="flex flex-col gap-5 p-5 md:gap-6 md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
        {/* ── Total ─────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-[14.5px] font-medium text-muted-foreground">Estimated balance</h1>
            <button
              type="button"
              onClick={toggle}
              aria-label={hidden ? "Show balances" : "Hide balances"}
              aria-pressed={hidden}
              className={cn(
                "flex size-7 items-center justify-center rounded-full transition-colors duration-200 hover:bg-foreground/[0.06]",
                hidden ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon icon={hidden ? ViewOffSlashIcon : ViewIcon} className="size-[17px]" />
            </button>
            <button
              type="button"
              onClick={onHelp}
              aria-label="How this wallet works"
              title="How this wallet works"
              className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors duration-200 hover:bg-foreground/[0.06] hover:text-foreground"
            >
              <Icon icon={HelpCircleIcon} className="size-[17px]" />
            </button>
          </div>
          <div className="font-display text-[42px] font-semibold leading-none tracking-[-0.045em] tabular-nums text-foreground sm:text-[50px]">
            {loading ? (
              <span className="skel inline-block h-[46px] w-[260px] rounded-lg" aria-label="Loading balance" />
            ) : hidden ? (
              <span className="tracking-[0.04em]">••••••</span>
            ) : (
              <RollingAmount value={usd(total)} />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {btc !== null && (
              <>
                <span className="text-[15px] font-medium tabular-nums text-muted-foreground">
                  ≈ {hidden ? "••••" : btc.toFixed(6)} <span className="text-foreground/70">BTC</span>
                </span>
                {(dayPct !== undefined || dayPnl !== null) && <span aria-hidden className="h-4 w-px bg-foreground/10" />}
              </>
            )}
            {dayPct !== undefined && <ChangeChip value={dayPct} size="sm" />}
            {dayPnl !== null && (
              <span className={cn("text-[14px] font-semibold tabular-nums", dayPnl >= 0 ? "text-credit" : "text-debit")}>
                <Figure mask="••••">{`${dayPnl >= 0 ? "+" : "−"}${usd(Math.abs(dayPnl))}`}</Figure>
              </span>
            )}
            {(dayPct !== undefined || dayPnl !== null) && <span className="text-[13px] text-muted-foreground">today</span>}
          </div>
          <span className="flex items-center gap-2 text-[12px] text-muted-foreground">
            {syncLine}
            <button
              type="button"
              onClick={onRefresh}
              aria-label={refreshing ? "Syncing" : "Refresh balances"}
              title={refreshing ? "Syncing…" : "Refresh balances"}
              className="flex size-6 items-center justify-center rounded-full transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
            >
              <Icon icon={RefreshIcon} className={cn("size-3.5", refreshing && "animate-spin")} />
            </button>
          </span>
        </div>

        {/* Desktop: the state split sits beside the total. */}
        <StateGrid state={state} className="hidden min-w-[420px] md:grid" />
      </div>

      {/* Desktop: the account split is always open. */}
      <div className="hidden md:block">
        <AccountSplit parts={parts} total={total} />
      </div>

      {/* ── Phone: one row that folds the rest away ─────────────── */}
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={regionId}
          className="flex h-12 w-full items-center gap-3 rounded-xl border border-foreground/[0.07] bg-foreground/[0.025] px-3.5 text-left transition-colors active:bg-foreground/[0.05]"
        >
          <span className="flex h-1.5 w-12 shrink-0 gap-0.5 overflow-hidden rounded-full">
            {total > 0 &&
              ranked.map((p) => <span key={p.key} className={cn("h-full", tone(p.key))} style={{ width: `${((p.value ?? 0) / total) * 100}%` }} />)}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
            <span className="font-semibold text-foreground">
              <Figure mask="••••">{usd(state.available, { min: 0, max: 0 })}</Figure>
            </span>{" "}
            available · {parts.length} accounts
          </span>
          <span className="flex items-center gap-1 text-[12.5px] font-semibold text-primary">
            {open ? "Hide" : "Breakdown"}
            <Icon icon={ArrowDown01Icon} className={cn("size-4 transition-transform duration-300", open && "rotate-180")} strokeWidth={2} />
          </span>
        </button>

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
              <StateGrid state={state} />
              <AccountSplit parts={parts} total={total} animateKey={open ? "open" : "closed"} />
            </div>
          </div>
        </div>
      </div>
    </Panel>
  )
}

"use client"

/**
 * Flow kit — the web port of the mobile app's `features/wallet/flow-ui.tsx`.
 * Shared chrome for every money-movement flow (buy, sell, fund, withdraw,
 * swap) so the screens compose a flow instead of re-inventing one.
 *
 * House rules encoded here:
 *  · The AMOUNT is the hero — a big, light, borderless figure, not a boxed
 *    input.
 *  · Selection = raised fill (accent), never a gold border.
 *  · The CTA states its blocker ("Enter an amount", "Not enough in your
 *    Dollar Account…") instead of sitting disabled and silent.
 *  · Long-running moves are backend-owned: the status screen is a progress
 *    report — a staged checklist that advances as the poll comes back — not
 *    a spinner and a shrug.
 *  · Failures are honest and calming: what happened, whether money moved,
 *    what to do next.
 */

import * as React from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { AlertCircleIcon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

/* ── FlowShell — the centered column every flow lives in ───────────────── */

export function FlowShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-md px-4 py-8", className)}>{children}</div>
}

/* ── ContextPanel — quiet "where money sits" rows above the form ───────── */

export function ContextPanel({
  rows,
  className,
}: {
  rows: { label: string; value: React.ReactNode }[]
  className?: string
}) {
  if (rows.length === 0) return null
  return (
    <div className={cn("divide-y divide-border/20 rounded-2xl bg-card", className)}>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between px-4 py-3">
          <span className="text-[13px] text-muted-foreground">{r.label}</span>
          <span className="text-[13px] font-semibold tabular-nums">{r.value}</span>
        </div>
      ))}
    </div>
  )
}

/* ── AmountField — the hero figure ─────────────────────────────────────── */

export function AmountField({
  value,
  onChange,
  unit,
  hint,
  problem,
  /** When the spendable max is known, chips are 25/50/75/Max of it.
   *  Otherwise pass `presets` for fixed amounts. */
  maxSpend,
  presets,
  autoFocus = true,
}: {
  value: string
  onChange: (v: string) => void
  unit: string
  /** Quiet line under the figure, e.g. "Min 5 · Max 5,000". */
  hint?: string
  /** Validation message — replaces the hint, in warning tone. */
  problem?: string | null
  maxSpend?: number | null
  presets?: number[]
  autoFocus?: boolean
}) {
  const set = (v: string) => {
    if (/^[0-9]*\.?[0-9]*$/.test(v)) onChange(v)
  }
  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div className="flex w-full items-baseline justify-center gap-2">
        <input
          value={value}
          onChange={(e) => set(e.target.value)}
          inputMode="decimal"
          autoFocus={autoFocus}
          placeholder="0"
          aria-label={`Amount in ${unit}`}
          className="w-full min-w-0 bg-transparent text-center font-display text-[clamp(2.75rem,8vw,3.5rem)] font-light leading-none tracking-[-0.02em] tabular-nums outline-none placeholder:text-muted-foreground/30"
        />
      </div>
      <span className="text-[13px] font-semibold text-muted-foreground">{unit}</span>

      {(maxSpend != null && maxSpend > 0) ? (
        <div className="flex items-center gap-1.5">
          {[0.25, 0.5, 0.75, 1].map((pct) => (
            <button
              key={pct}
              onClick={() => onChange(pct === 1 ? String(Math.floor(maxSpend * 100) / 100) : (maxSpend * pct).toFixed(2))}
              className="rounded-full bg-surface-sunken px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {pct === 1 ? "Max" : `${pct * 100}%`}
            </button>
          ))}
        </div>
      ) : presets && presets.length > 0 ? (
        <div className="flex items-center gap-1.5">
          {presets.map((p) => (
            <button
              key={p}
              onClick={() => onChange(String(p))}
              className="rounded-full bg-surface-sunken px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {p.toLocaleString()}
            </button>
          ))}
        </div>
      ) : null}

      {problem ? (
        <p className="text-center text-[13px] font-medium text-warning">{problem}</p>
      ) : hint ? (
        <p className="text-center text-xs text-subtle">{hint}</p>
      ) : null}
    </div>
  )
}

/* ── ChoiceRow — network / destination selection ───────────────────────── */

export function ChoiceRow<T extends string>({
  options,
  value,
  onChange,
  columns = 3,
}: {
  options: { key: T; label: string; sub?: string; icon?: string }[]
  value: T
  onChange: (k: T) => void
  columns?: 2 | 3
}) {
  return (
    <div className={cn("grid gap-2", columns === 2 ? "grid-cols-2" : "grid-cols-3")}>
      {options.map((o) => {
        const active = o.key === value
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-2xl px-3 py-3 transition-colors",
              active
                ? "bg-accent ring-1 ring-foreground/[0.08]"
                : "bg-surface-sunken/70 hover:bg-accent/60",
            )}
          >
            {o.icon && <img src={o.icon} alt="" className="h-5 w-5 rounded-full" />}
            <span className="flex min-w-0 flex-col items-start leading-tight">
              <span className={cn("text-[13px] font-semibold", !active && "text-foreground/80")}>{o.label}</span>
              {o.sub && <span className="text-[11px] text-subtle">{o.sub}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ── DetailPanel — the review breakdown ────────────────────────────────── */

export function DetailPanel({
  rows,
  className,
}: {
  rows: { label: string; value: React.ReactNode; strong?: boolean }[]
  className?: string
}) {
  return (
    <div className={cn("divide-y divide-border/15 rounded-2xl bg-surface-sunken/70 px-4", className)}>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between py-2.5">
          <span className={cn("text-[13px]", r.strong ? "font-semibold" : "text-muted-foreground")}>{r.label}</span>
          <span className={cn("text-[13px] tabular-nums", r.strong ? "font-bold" : "font-medium")}>{r.value}</span>
        </div>
      ))}
    </div>
  )
}

/* ── InlineNotice — warning / error copy that reads like a sentence ────── */

export function InlineNotice({
  tone = "warning",
  children,
  className,
}: {
  tone?: "warning" | "error"
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed",
        tone === "warning" ? "bg-warning-chip text-warning" : "bg-debit-chip text-debit",
        className,
      )}
    >
      {children}
    </div>
  )
}

/* ── FlowCta — the pill that states its blocker ────────────────────────── */

export function FlowCta({
  label,
  onClick,
  disabled,
  busy,
}: {
  /** The blocker ladder's current rung — or the action itself. */
  label: string
  onClick: () => void
  disabled?: boolean
  busy?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      className={cn(
        "flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-bold transition-all",
        "bg-primary text-primary-foreground hover:bg-primary/90",
        (disabled || busy) && "cursor-not-allowed opacity-40 hover:bg-primary",
      )}
    >
      {busy && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
      )}
      {label}
    </button>
  )
}

/* ── StageList — the poll-driven checklist ─────────────────────────────── */

export type Stage = { key: string; label: string }

export function StageList({
  stages,
  /** Index of the stage in flight. Everything before it renders done;
   *  pass stages.length when the whole flow completed. */
  activeIndex,
}: {
  stages: Stage[]
  activeIndex: number
}) {
  return (
    <div className="flex w-full flex-col">
      {stages.map((s, i) => {
        const done = i < activeIndex
        const current = i === activeIndex
        const last = i === stages.length - 1
        return (
          <div key={s.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  done && "bg-credit-chip text-credit",
                  current && "bg-primary/15 text-primary",
                  !done && !current && "bg-foreground/[0.06] text-subtle",
                )}
              >
                {done ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                ) : current ? (
                  <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-current opacity-50" />
                )}
              </span>
              {!last && <span className={cn("w-px flex-1 min-h-4", done ? "bg-credit/30" : "bg-border/40")} />}
            </div>
            <span
              className={cn(
                "pb-4 pt-0.5 text-[13px]",
                done && "text-muted-foreground",
                current && "font-semibold",
                !done && !current && "text-subtle",
              )}
            >
              {s.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* ── StatusScreen — processing / success / failure, one presentation ───── */

export function StatusScreen({
  state,
  headline,
  caption,
  stages,
  activeIndex = 0,
  txHash,
  notice,
  primary,
  secondary,
}: {
  state: "processing" | "success" | "failure"
  headline: string
  caption?: React.ReactNode
  stages?: Stage[]
  activeIndex?: number
  txHash?: string | null
  /** Extra warning line (e.g. partial delivery). */
  notice?: React.ReactNode
  primary?: { label: string; onClick?: () => void; href?: string }
  secondary?: { label: string; onClick?: () => void; href?: string }
}) {
  const [copied, setCopied] = React.useState(false)

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl bg-card px-6 py-8 text-center">
      {state === "success" ? (
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-credit-chip">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="text-credit"><path d="M20 6L9 17l-5-5" /></svg>
        </span>
      ) : state === "failure" ? (
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-debit-chip">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="text-debit"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </span>
      ) : (
        <span className="relative flex h-16 w-16 items-center justify-center">
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
          <span className="h-2.5 w-2.5 rounded-full bg-primary" />
        </span>
      )}

      <div className="flex flex-col gap-1">
        <h2 className="font-display text-xl font-bold tracking-[-0.01em]">{headline}</h2>
        {caption && <p className="mx-auto max-w-xs text-[13px] leading-relaxed text-muted-foreground">{caption}</p>}
      </div>

      {stages && stages.length > 0 && (
        <div className="w-full max-w-xs pt-1 text-left">
          <StageList stages={stages} activeIndex={activeIndex} />
        </div>
      )}

      {notice && <InlineNotice className="w-full text-left">{notice}</InlineNotice>}

      {txHash && (
        <button
          onClick={() => {
            navigator.clipboard.writeText(txHash)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
          className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-surface-sunken px-3 py-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-accent"
          title="Copy transaction hash"
        >
          <span className="truncate">{txHash.slice(0, 10)}…{txHash.slice(-8)}</span>
          <span className={cn("shrink-0 text-[10px] font-sans font-semibold", copied ? "text-credit" : "text-subtle")}>
            {copied ? "Copied" : "Copy"}
          </span>
        </button>
      )}

      {state === "processing" && (
        <p className="text-[11px] text-subtle">Updates automatically — you can leave this page.</p>
      )}

      {(primary || secondary) && (
        <div className="flex w-full flex-col gap-2 pt-1 sm:flex-row-reverse">
          {primary &&
            (primary.href ? (
              <Link href={primary.href} className="flex h-11 flex-1 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90">
                {primary.label}
              </Link>
            ) : (
              <button onClick={primary.onClick} className="flex h-11 flex-1 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90">
                {primary.label}
              </button>
            ))}
          {secondary &&
            (secondary.href ? (
              <Link href={secondary.href} className="flex h-11 flex-1 items-center justify-center rounded-full bg-surface-sunken text-sm font-semibold text-foreground transition-colors hover:bg-accent">
                {secondary.label}
              </Link>
            ) : (
              <button onClick={secondary.onClick} className="flex h-11 flex-1 items-center justify-center rounded-full bg-surface-sunken text-sm font-semibold text-foreground transition-colors hover:bg-accent">
                {secondary.label}
              </button>
            ))}
        </div>
      )}
    </div>
  )
}

/* ── UnavailablePanel — a real screen, not a lonely sentence ───────────── */

export function UnavailablePanel({
  title,
  reason,
  icon = AlertCircleIcon,
  tone = "warning",
}: {
  title: string
  reason?: string
  /** Defaults to a caution mark. Illustrations are for promos and empty
   *  states — an error is not the place for borrowed art. */
  icon?: typeof AlertCircleIcon
  tone?: "warning" | "muted"
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-card px-6 py-10 text-center">
      <span
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full",
          tone === "warning" ? "bg-warning-chip text-warning" : "bg-foreground/[0.06] text-muted-foreground",
        )}
      >
        <HugeiconsIcon icon={icon} className="h-6 w-6" />
      </span>
      <p className="text-[15px] font-semibold">{title}</p>
      <p className="mx-auto max-w-xs text-[13px] leading-relaxed text-muted-foreground">
        {reason || "This is usually brief — check back in a few minutes."}
      </p>
      <Link href="/" className="mt-1 inline-flex items-center rounded-full border border-primary/40 px-4 py-2 text-[13px] font-semibold text-primary transition-colors hover:bg-primary/10">
        Back to dashboard
      </Link>
    </div>
  )
}

/* ── FlowSkeleton — loading placeholder in the flow's own shape ────────── */

export function FlowSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4">
      <div className="h-12 rounded-2xl bg-card" />
      <div className="flex flex-col items-center gap-3 py-6">
        <div className="h-12 w-40 rounded-xl bg-card" />
        <div className="h-3 w-24 rounded bg-card" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="h-12 rounded-2xl bg-card" />
        <div className="h-12 rounded-2xl bg-card" />
        <div className="h-12 rounded-2xl bg-card" />
      </div>
      <div className="h-12 rounded-full bg-card" />
    </div>
  )
}

/* ── AnnouncementBanner — a paused/degraded notice that sits ABOVE a still
      visible form, so the user can see what the flow offers even when they
      can't act on it yet. ─────────────────────────────────────────────── */

export function AnnouncementBanner({
  title,
  detail,
  tone = "warning",
  action,
}: {
  title: string
  detail?: React.ReactNode
  tone?: "warning" | "error"
  action?: { label: string; href: string }
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl px-4 py-3.5",
        tone === "warning" ? "bg-warning-chip" : "bg-debit-chip",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
          tone === "warning" ? "text-warning" : "text-debit",
        )}
      >
        <HugeiconsIcon icon={AlertCircleIcon} className="h-5 w-5" />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className={cn("text-[13px] font-semibold", tone === "warning" ? "text-warning" : "text-debit")}>
          {title}
        </p>
        {detail && (
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">{detail}</p>
        )}
        {action && (
          <Link href={action.href} className="mt-1 w-fit text-[12.5px] font-semibold text-primary hover:underline">
            {action.label} →
          </Link>
        )}
      </div>
    </div>
  )
}

/* ── ErrorDetail — human message up front, raw payload behind a toggle ─── */

export function ErrorDetail({ message, raw }: { message: string; raw?: string | null }) {
  const [open, setOpen] = React.useState(false)
  return (
    <div className="rounded-xl bg-debit-chip px-3.5 py-2.5">
      <p className="text-[13px] leading-relaxed text-debit">{message}</p>
      {raw && raw !== message && (
        <>
          <button
            onClick={() => setOpen((v) => !v)}
            className="mt-1 text-[11.5px] font-semibold text-debit/70 underline-offset-2 hover:underline"
          >
            {open ? "Hide details" : "Details"}
          </button>
          {open && (
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-background/40 p-2 font-mono text-[10.5px] leading-relaxed text-muted-foreground">
              {raw}
            </pre>
          )}
        </>
      )}
    </div>
  )
}

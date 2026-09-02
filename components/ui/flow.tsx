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
import {
  AlertCircleIcon,
  ArrowDownLeft01Icon,
  ArrowRight01Icon,
  ArrowUpRight01Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

/* ── FlowShell — the centered column every flow lives in ───────────────── */

export function FlowShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-md px-4 py-8", className)}>{children}</div>
}

/* ── FlowHeader — the flow names its direction, in the colour of money ──── */

export function FlowHeader({
  direction,
  title,
  subtitle,
  className,
}: {
  /** "in" = money arriving (credit green), "out" = money leaving (debit red).
   *  The one place outside a balance where those colours may appear — they
   *  mean direction here exactly as they do on a transaction row. */
  direction: "in" | "out"
  title: string
  subtitle?: string
  className?: string
}) {
  const isIn = direction === "in"
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span
        className={cn(
          // ws-badge-pop: the direction badge lands with a small rotational
          // settle when the flow first appears — placed, not painted.
          "ws-badge-pop flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          isIn ? "bg-credit-chip text-credit" : "bg-debit-chip text-debit",
        )}
      >
        <HugeiconsIcon icon={isIn ? ArrowDownLeft01Icon : ArrowUpRight01Icon} className="h-5 w-5" />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="font-display text-[17px] font-semibold leading-tight tracking-[-0.01em]">{title}</h2>
        {subtitle && <p className="text-xs leading-snug text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  )
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
    // Sunken, not card — these flows also render INSIDE a bg-card modal, where
    // a card-on-card panel disappears. Sunken + hairline reads on every ground.
    <div className={cn("divide-y divide-border/20 rounded-2xl bg-surface-sunken/70 ring-1 ring-border/25", className)}>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between px-4 py-3">
          <span className="text-[13px] text-muted-foreground">{r.label}</span>
          <span className="text-[13px] font-semibold tabular-nums">{r.value}</span>
        </div>
      ))}
    </div>
  )
}

/* ── RouteStrip — where the money starts and where it lands ────────────── */

/**
 * The flow's story told as a route: source on the left, destination on the
 * right, the direction arrow between them in the colour of the money. The
 * endpoints are LIVE — pick a different network or venue below and the
 * destination updates in place, so the strip always states exactly what the
 * CTA is about to do.
 */
export function RouteStrip({
  from,
  to,
  direction,
  className,
}: {
  from: { label: string; sub?: React.ReactNode }
  to: { label: string; sub?: React.ReactNode }
  direction: "in" | "out"
  className?: string
}) {
  const isIn = direction === "in"
  return (
    <div
      className={cn(
        "grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl bg-surface-sunken/70 px-4 py-3 ring-1 ring-border/25",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-subtle">From</span>
        {/* Keyed by label: when the endpoint changes (network flip, venue
            swap) the new name takes a small rise instead of teleporting. */}
        <span key={from.label} className="ws-microswap truncate text-[13px] font-semibold leading-tight">
          {from.label}
        </span>
        {from.sub && (
          <span className="truncate text-[11.5px] tabular-nums leading-tight text-muted-foreground">{from.sub}</span>
        )}
      </div>
      <span
        aria-hidden
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          isIn ? "bg-credit-chip text-credit" : "bg-debit-chip text-debit",
        )}
      >
        <HugeiconsIcon icon={ArrowRight01Icon} className="h-3.5 w-3.5" />
      </span>
      <div className="flex min-w-0 flex-col items-end gap-0.5 text-right">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-subtle">To</span>
        <span key={to.label} className="ws-microswap truncate text-[13px] font-semibold leading-tight">
          {to.label}
        </span>
        {to.sub && (
          <span className="truncate text-[11.5px] tabular-nums leading-tight text-muted-foreground">{to.sub}</span>
        )}
      </div>
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
  approx,
  /** When the spendable max is known, chips are 25/50/75/Max of it.
   *  Otherwise pass `presets` for fixed amounts. */
  maxSpend,
  presets,
  autoFocus = true,
  maxDecimals = 2,
  disabled = false,
}: {
  value: string
  onChange: (v: string) => void
  unit: string
  /** Quiet line under the figure, e.g. "Min 5 · Max 5,000". */
  hint?: string
  /** Validation message — replaces the hint, in warning tone. */
  problem?: string | null
  /** Live conversion for the typed amount ("≈ $101.00 charged to your Dollar
   *  Account") — the answer to "what does this figure cost me", right where
   *  the figure is. Takes the hint's line while present; problem outranks it. */
  approx?: string | null
  maxSpend?: number | null
  presets?: number[]
  autoFocus?: boolean
  /** These flows settle in cents. Accepting more precision than the service
   *  can honour meant a user could type 100.005, read "$100.01" in the review
   *  panel, and have 100.005 sent — the two numbers disagreeing about their
   *  own money. */
  maxDecimals?: number
  /** True while a value captured from this field is in flight (e.g. an intent
   *  create) — the figure the user is about to review must be the one they
   *  see here, not one they slipped in mid-request. */
  disabled?: boolean
}) {
  // The percentage chips honour the unit's own precision. A fixed two places
  // was right for a cents-settled dollar flow and wrong everywhere else: on a
  // 0.005 SOL balance "Max" floored to 0.00 and the chip became a dead control
  // that set an amount the field itself then rejected. Floor rather than
  // round — a chip must never propose more than the balance it is a fraction
  // of, which `.toFixed()` could.
  const chipPlaces = Math.min(Math.max(maxDecimals, 0), 8)
  const chipAmount = (pct: number, max: number) => {
    const factor = 10 ** chipPlaces
    return String(Math.floor(max * pct * factor) / factor)
  }

  const set = (v: string) => {
    if (!/^[0-9]*\.?[0-9]*$/.test(v)) return
    const [whole = "", frac] = v.split(".")
    // Trim runs of leading zeros ("007" → "7") but keep a lone "0" and the
    // "0." a user is mid-way through typing.
    const w = whole.replace(/^0+(?=\d)/, "")
    if (frac !== undefined && frac.length > maxDecimals) return
    onChange(frac !== undefined ? `${w}.${frac}` : w)
  }

  // Focus by hand with preventScroll, never via the autoFocus attribute: the
  // attribute's focus scrolls ancestors to reveal the input, and this field
  // mounts late (skeleton → form) inside overlays — one positioning accident
  // and that scroll yanks the whole page (it did).
  const inputRef = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => {
    if (autoFocus) inputRef.current?.focus({ preventScroll: true })
  }, [autoFocus])
  return (
    <div className="flex flex-col items-center gap-2.5 py-1.5">
      <div className="flex w-full items-baseline justify-center gap-2">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => set(e.target.value)}
          disabled={disabled}
          inputMode="decimal"
          placeholder="0"
          aria-label={`Amount in ${unit}`}
          data-vivid-target="flow-amount"
          data-vivid-label={`The amount to move, in ${unit}`}
          className="w-full min-w-0 bg-transparent text-center font-display text-[clamp(2.75rem,8vw,3.5rem)] font-light leading-none tracking-[-0.02em] tabular-nums outline-none placeholder:text-muted-foreground/30 disabled:opacity-50"
        />
      </div>
      <span className="rounded-full bg-surface-sunken px-2.5 py-1 text-[11px] font-bold tracking-[0.04em] text-muted-foreground ring-1 ring-border/25">
        {unit}
      </span>

      {(maxSpend != null && maxSpend > 0) ? (
        <div className="flex items-center gap-1.5">
          {[0.25, 0.5, 0.75, 1].map((pct) => (
            <button
              key={pct}
              onClick={() => onChange(chipAmount(pct, maxSpend))}
              disabled={disabled}
              className="inline-flex min-h-11 items-center rounded-full bg-surface-sunken px-3.5 text-xs font-semibold text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-90 motion-reduce:active:scale-100 disabled:pointer-events-none disabled:opacity-50 sm:min-h-0 sm:py-1.5"
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
              disabled={disabled}
              className="inline-flex min-h-11 items-center rounded-full bg-surface-sunken px-3.5 text-xs font-semibold text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-90 motion-reduce:active:scale-100 disabled:pointer-events-none disabled:opacity-50 sm:min-h-0 sm:py-1.5"
            >
              {p.toLocaleString()}
            </button>
          ))}
        </div>
      ) : null}

      {problem ? (
        <p className="text-center text-[13px] font-medium text-warning">{problem}</p>
      ) : approx ? (
        /* Mounted once when an amount first exists (not keyed by text — that
           would replay the rise on every keystroke). */
        <p className="ws-microswap text-center text-[13px] font-medium tabular-nums text-muted-foreground">
          {approx}
        </p>
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
  disabled = false,
}: {
  options: { key: T; label: string; sub?: string; icon?: string }[]
  value: T
  onChange: (k: T) => void
  columns?: 2 | 3
  /** True while a choice made here is in flight elsewhere (e.g. an intent
   *  create) — the option the user is about to review must be the one they
   *  picked, not one they swapped in mid-request. */
  disabled?: boolean
}) {
  return (
    <div className={cn("grid gap-2", columns === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3")}>
      {options.map((o) => {
        const active = o.key === value
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            disabled={disabled}
            className={cn(
              "relative flex flex-col items-center gap-1.5 rounded-2xl px-3 pb-3 pt-3.5 transition-all active:scale-[0.97] motion-reduce:active:scale-100 disabled:pointer-events-none disabled:opacity-50",
              active
                ? // The chosen option floats: a half-step lift + a real
                  // shadow, so selection reads as depth, not just tint.
                  "-translate-y-0.5 bg-accent shadow-[0_8px_20px_-10px_rgb(0_0_0/0.6)] ring-1 ring-foreground/[0.10] motion-reduce:translate-y-0"
                : "bg-surface-sunken/70 hover:bg-accent/60",
            )}
          >
            {/* Gold = active state, exactly what this dot means. It pops in
                when the choice lands rather than being painted in place. */}
            {active && (
              <span className="ws-pop-in absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </span>
            )}
            {o.icon && <img src={o.icon} alt="" className="h-6 w-6 rounded-full" />}
            <span className="flex min-w-0 flex-col items-center leading-tight">
              <span className={cn("text-[13px] font-semibold", !active && "text-foreground/80")}>{o.label}</span>
              {o.sub && <span className="mt-0.5 text-[11px] tabular-nums text-subtle">{o.sub}</span>}
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
  // A receipt, not a table: dotted leaders run label to value the way a
  // printed ticket does, and the total row separates itself with a hairline
  // and a size step instead of just bolding in place.
  return (
    <div className={cn("rounded-2xl bg-surface-sunken/70 px-4 py-1.5 ring-1 ring-border/25", className)}>
      {rows.map((r) => (
        <div
          key={r.label}
          className={cn("flex items-baseline gap-2.5 py-2.5", r.strong && "mt-0.5 border-t border-border/40")}
        >
          <span className={cn("shrink-0 text-[13px]", r.strong ? "font-semibold" : "text-muted-foreground")}>
            {r.label}
          </span>
          <span aria-hidden className="mb-1 flex-1 self-end border-b border-dotted border-foreground/15" />
          {/* The value must be the side that gives: both halves were shrink-0,
              so a full-precision amount burst the panel instead of truncating.
              The dotted leader collapses first, then this truncates. */}
          <span
            className={cn(
              "min-w-0 truncate text-right tabular-nums",
              r.strong ? "text-[15px] font-bold" : "text-[13px] font-medium",
            )}
            title={typeof r.value === "string" ? r.value : undefined}
          >
            {r.value}
          </span>
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
  control,
}: {
  /** The blocker ladder's current rung — or the action itself. */
  label: string
  onClick: () => void
  disabled?: boolean
  busy?: boolean
  /** Who this button is, for screen readers and the Vivid control layer.
   *  Defaults to the money-flow identity — a guarded "flow-submit" that
   *  announces a transfer. A CTA that moves no money (wallet setup) passes its
   *  own, because announcing "Confirm transfer… Moves real money" over a
   *  "Get started" button is simply false, and the guard would demand spoken
   *  confirmation for a step that doesn't warrant it. */
  control?: { target: string; describe: string; guarded?: boolean }
}) {
  const guarded = control?.guarded ?? true
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      data-vivid-target={control?.target ?? "flow-submit"}
      data-vivid-guard={guarded ? "" : undefined}
      aria-label={control ? `${control.describe} — ${label}` : `Confirm transfer — ${label}`}
      data-vivid-label={
        control ? `${control.describe}: ${label}.` : `Submit this money flow: ${label}. Moves real money.`
      }
      className={cn(
        "flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-bold transition-all",
        "bg-primary text-primary-foreground hover:bg-primary/90",
        disabled || busy
          ? "cursor-not-allowed opacity-40 hover:bg-primary"
          : // Armed: the CTA glows — the one gold moment in the flow earns it.
            // ws-cta-breathe swells that glow on a slow loop; the static
            // shadow beneath is the reduced-motion resting state.
            "ws-cta-breathe shadow-[0_10px_28px_-10px_color-mix(in_oklab,var(--primary)_55%,transparent)] active:scale-[0.985] motion-reduce:active:scale-100",
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

/** mm:ss for a stage that's been running long enough to be worth counting. */
function fmtElapsed(ms: number) {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const sec = total % 60
  return m > 0 ? `${m}m ${String(sec).padStart(2, "0")}s` : `${sec}s`
}

/**
 * Ticks once a second while `since` is set. Used for the live counters on the
 * active stage and the status headline — a transfer that's been running four
 * minutes should say so rather than show the same spinner it showed at second
 * two. Returns 0 when there's nothing to count, so callers can render nothing.
 */
export function useElapsed(since: number | null) {
  const [ms, setMs] = React.useState(0)
  React.useEffect(() => {
    if (since === null) {
      setMs(0)
      return
    }
    setMs(Date.now() - since)
    const id = setInterval(() => setMs(Date.now() - since), 1000)
    return () => clearInterval(id)
  }, [since])
  return since === null ? 0 : ms
}

/**
 * The stage the flow has reached, and when it got there.
 *
 * Two jobs, both about not lying to the user:
 *
 *  1. **Monotonic.** A service can report a status this client doesn't know —
 *     a new intermediate step, or a retry re-reporting an earlier one — and
 *     the raw lookups answer "index 0" for anything unrecognised. Rendered
 *     literally, the checklist un-ticked itself halfway through a transfer.
 *     Taking the high-water mark makes an unknown status mean "no news".
 *
 *  2. **Timestamped.** The live counter needs to know when the CURRENT stage
 *     began, which is not when the flow began.
 *
 * Both were briefly done by mutating refs during render, which happens to work
 * and is exactly the thing concurrent rendering is allowed to break. This is
 * state, updated in an effect, converging in one extra pass.
 */
export function useStageProgress(rawIndex: number, resetKey: unknown) {
  // Lazy initialiser: a bare Date.now() here runs on every render, not just
  // the first, which is a call into an impure function during render.
  const [state, setState] = React.useState(() => ({ index: rawIndex, since: Date.now() }))

  // A new flow starts over — otherwise the high-water mark from the last
  // transfer would pin the next one's checklist to wherever that one ended.
  React.useEffect(() => {
    setState({ index: 0, since: Date.now() })
  }, [resetKey])

  const index = Math.max(rawIndex, state.index)

  React.useEffect(() => {
    setState((prev) => (index > prev.index ? { index, since: Date.now() } : prev))
  }, [index])

  return { index, since: state.since }
}

/** A checkmark that draws itself in rather than popping. Keyframed, not a
 *  transition: the check only exists once the stage is done, so it MOUNTS in
 *  its final state — a transition from the undone state never fires. */
function StageCheck({ done }: { done: boolean }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
      <path
        d="M20 6L9 17l-5-5"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={done ? 0 : 1}
        style={done ? { animation: "ws-check-draw 0.45s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both" } : undefined}
        className="motion-reduce:animate-none"
      />
    </svg>
  )
}

export function StageList({
  stages,
  /** Index of the stage in flight. Everything before it renders done;
   *  pass stages.length when the whole flow completed. */
  activeIndex,
  /** When the current stage started, epoch ms. Drives the live counter — pass
   *  null to leave the stage silent (e.g. once everything is done). */
  stageStartedAt = null,
  /** Wait this long before showing a counter, so a stage that resolves in two
   *  seconds never flashes one. */
  countAfterMs = 8_000,
  /** Stagger the rows in on mount — for the status screen's entrance. */
  cascade = false,
}: {
  stages: Stage[]
  activeIndex: number
  stageStartedAt?: number | null
  countAfterMs?: number
  cascade?: boolean
}) {
  const elapsed = useElapsed(stageStartedAt)
  const showCount = stageStartedAt !== null && elapsed >= countAfterMs

  return (
    <div className="flex w-full flex-col">
      {stages.map((s, i) => {
        const done = i < activeIndex
        const current = i === activeIndex
        const last = i === stages.length - 1
        return (
          <div
            key={s.key}
            className={cn("flex gap-3", cascade && "ws-casc")}
            style={cascade ? { animationDelay: `${240 + i * 90}ms` } : undefined}
          >
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  // The wash transitions too, so a stage completing is one
                  // continuous change rather than three simultaneous swaps.
                  "transition-colors duration-500",
                  // ws-pop-in joins the class list the moment the stage
                  // completes, so the node takes a small victorious bounce.
                  done && "ws-pop-in bg-credit-chip text-credit",
                  current && "bg-primary/15 text-primary",
                  !done && !current && "bg-foreground/[0.06] text-subtle",
                )}
              >
                {current && (
                  // A halo pushing outward from the live dot: proof the flow is
                  // still connected, without a spinner's false precision.
                  <span
                    aria-hidden
                    className="ws-stage-halo absolute inset-0 rounded-full bg-primary/40"
                  />
                )}
                {done ? (
                  <StageCheck done />
                ) : current ? (
                  <span className="relative h-2 w-2 rounded-full bg-primary" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-current opacity-50" />
                )}
              </span>
              {!last && (
                // The rail is a track with a fill that GROWS when the stage
                // above completes — the single clearest signal that the flow
                // advanced. On the live stage the fill is replaced by a
                // travelling gradient: motion where the work is.
                <span className="relative w-px flex-1 min-h-4 overflow-hidden rounded-full bg-border/40">
                  <span
                    className={cn(
                      "absolute inset-x-0 top-0 origin-top rounded-full transition-transform duration-500 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                      "h-full bg-credit/40",
                      done ? "scale-y-100" : "scale-y-0",
                    )}
                  />
                  {current && (
                    <span aria-hidden className="ws-stage-rail-active absolute inset-0" />
                  )}
                </span>
              )}
            </div>
            <span
              className={cn(
                "flex items-baseline gap-2 pb-4 pt-0.5 text-[13px] transition-colors duration-500",
                done && "text-muted-foreground",
                current && "font-semibold",
                !done && !current && "text-subtle",
              )}
            >
              {s.label}
              {current && showCount && (
                <span className="text-[11.5px] font-normal tabular-nums text-subtle">
                  {fmtElapsed(elapsed)}
                </span>
              )}
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
  stageStartedAt = null,
  reference,
  txHash,
  notice,
  autoUpdating = true,
  primary,
  secondary,
  direction,
  figure,
}: {
  state: "processing" | "success" | "failure"
  /** Tints the transfer core in the money's colour; gold when omitted. */
  direction?: "in" | "out"
  /** The amount in transit ("250.75 USDT") — sits at the core's heart. */
  figure?: string
  headline: string
  caption?: React.ReactNode
  stages?: Stage[]
  activeIndex?: number
  /** When the CURRENT stage began, epoch ms — drives the live counter. */
  stageStartedAt?: number | null
  /** The order reference. Always shown while processing: a user who closes the
   *  modal mid-transfer needs something to quote, and burying it in a
   *  timeout-only notice meant it appeared exactly when it was too late. */
  reference?: string | null
  txHash?: string | null
  /** Extra warning line (e.g. partial delivery). */
  notice?: React.ReactNode
  /** False once the caller has stopped polling — the "updates automatically"
   *  line is a promise, so it goes away when it stops being kept. */
  autoUpdating?: boolean
  primary?: { label: string; onClick?: () => void; href?: string }
  secondary?: { label: string; onClick?: () => void; href?: string }
}) {
  const [copied, setCopied] = React.useState(false)
  const [refCopied, setRefCopied] = React.useState(false)

  /* The stream and the current-stage accents wear the money's colour. */
  const tone =
    direction === "in" ? "var(--credit)" : direction === "out" ? "var(--debit)" : "var(--primary)"

  return (
    // No card fill of its own — this screen IS the surface it sits on, whether
    // that's the modal or the page column. The whole screen enters as a
    // sequence: emblem, verdict, stages one by one, then the paperwork.
    <div className="flex flex-col items-center gap-3.5 rounded-2xl px-6 py-6 text-center">
      {state === "success" ? (
        /* The verdict pops, and a double ring ripples out — the one moment
           in the flow that has earned a small celebration. */
        <span className="relative flex h-16 w-16">
          <span aria-hidden className="ws-ripple absolute inset-0 rounded-full bg-credit/25" />
          <span aria-hidden className="ws-ripple absolute inset-0 rounded-full bg-credit/15" style={{ animationDelay: "0.18s" }} />
          <span className="ws-pop-in relative flex h-16 w-16 items-center justify-center rounded-full bg-credit-chip">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="text-credit"><path d="M20 6L9 17l-5-5" /></svg>
          </span>
        </span>
      ) : state === "failure" ? (
        <span className="ws-pop-in flex h-16 w-16 items-center justify-center rounded-full bg-debit-chip">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="text-debit"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </span>
      ) : (
        /* The transfer core — the money inside the machine that is moving
           it. The outer SVG ring is REAL state: it fills as stages complete
           (the half-step credits the stage currently in flight). Everything
           else is the machine running: comet arc, counter-rotating gyros,
           orbiting sparks, the figure breathing in a glow field. A ripple
           bursts from the core every time a stage lands (keyed remount). */
        <div
          className="ws-casc ws-casc-0 relative flex h-[196px] w-[196px] items-center justify-center"
          style={{ "--ws-stream-tone": tone } as React.CSSProperties}
        >
          {/* Glow field */}
          <span
            aria-hidden
            className="ws-glow-breathe absolute -inset-10 rounded-full"
            style={{
              background: `radial-gradient(closest-side, color-mix(in oklab, ${tone} 22%, transparent), transparent 70%)`,
            }}
          />
          {/* Stage-advance burst — remounts on every advance and replays. */}
          <span
            key={activeIndex}
            aria-hidden
            className="ws-ripple absolute inset-3 rounded-full"
            style={{ background: `color-mix(in oklab, ${tone} 16%, transparent)` }}
          />
          {/* Comet arc sweeping the rim */}
          <span aria-hidden className="ws-core-arc" />
          {/* Counter-rotating dashed gyros */}
          <span
            aria-hidden
            className="ws-orbit absolute inset-[14px] rounded-full border border-dashed"
            style={{ borderColor: `color-mix(in oklab, ${tone} 30%, transparent)`, "--ws-orbit-dur": "17s" } as React.CSSProperties}
          />
          <span
            aria-hidden
            className="ws-orbit ws-orbit-rev absolute inset-[30px] rounded-full border border-dashed"
            style={{ borderColor: `color-mix(in oklab, ${tone} 18%, transparent)`, "--ws-orbit-dur": "26s" } as React.CSSProperties}
          />
          {/* Orbiting sparks — three, staggered so they start scattered. */}
          {[
            { inset: "6px", dur: "6.5s", delay: "0s", size: 6 },
            { inset: "22px", dur: "9s", delay: "-3s", size: 5 },
            { inset: "38px", dur: "12s", delay: "-7s", size: 4 },
          ].map((p, i) => (
            <span
              key={i}
              aria-hidden
              className={cn("ws-orbit absolute rounded-full", i === 1 && "ws-orbit-rev")}
              style={{ inset: p.inset, "--ws-orbit-dur": p.dur, animationDelay: p.delay } as React.CSSProperties}
            >
              <span
                className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  height: p.size,
                  width: p.size,
                  background: tone,
                  boxShadow: `0 0 10px color-mix(in oklab, ${tone} 80%, transparent)`,
                }}
              />
            </span>
          ))}
          {/* Progress ring — fills per completed stage. */}
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90">
            <circle cx="50" cy="50" r="46" fill="none" strokeWidth="1.5" className="stroke-border/50" />
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              strokeWidth="3"
              strokeLinecap="round"
              stroke={tone}
              strokeDasharray={2 * Math.PI * 46}
              strokeDashoffset={
                2 * Math.PI * 46 *
                (1 - (stages && stages.length > 0 ? Math.min(1, (activeIndex + 0.45) / stages.length) : 0.12))
              }
              className="transition-[stroke-dashoffset] duration-1000 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            />
          </svg>
          {/* The heart: the money itself. */}
          <div className="ws-core-breathe relative flex flex-col items-center gap-1">
            {figure ? (
              <>
                <span className="max-w-[168px] text-balance break-words px-1 text-center font-display text-[clamp(1.05rem,4.6vw,26px)] font-light leading-none tracking-[-0.01em] tabular-nums">
                  {figure}
                </span>
                <span className="text-[9.5px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                  in transit
                </span>
              </>
            ) : (
              <span className="h-3 w-3 rounded-full" style={{ background: tone }} />
            )}
          </div>
        </div>
      )}

      <div className={cn("flex flex-col gap-1", state === "processing" && "ws-casc ws-casc-1")}>
        <h2 className="font-display text-xl font-bold tracking-[-0.01em]">{headline}</h2>
        {caption && <p className="mx-auto max-w-xs text-[13px] leading-relaxed text-muted-foreground">{caption}</p>}
      </div>

      {stages && stages.length > 0 && (
        <div className="w-full max-w-xs pt-1 text-left">
          <StageList
            stages={stages}
            activeIndex={activeIndex}
            stageStartedAt={state === "processing" ? stageStartedAt : null}
            cascade={state === "processing"}
          />
        </div>
      )}

      {notice && <InlineNotice className="w-full text-left">{notice}</InlineNotice>}

      {/* The transaction hash — the receipt.
          This was an 11px pill showing ten characters, an ellipsis and eight
          more. It is the one artifact proving the transfer happened and the
          only thing worth pasting into an explorer or handing to support, and
          it was the smallest text on the screen, truncated past usefulness.
          It is stated in full now, selectable, wrapped rather than clipped,
          with copying as a real button instead of a word. */}
      {txHash && (
        <div className="w-full rounded-2xl bg-surface-sunken/80 p-3 text-left ring-1 ring-border/40">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
              Transaction hash
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(txHash)
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }}
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors",
                copied
                  ? "bg-credit-chip text-credit"
                  : "bg-foreground/[0.08] text-foreground hover:bg-foreground/[0.14]",
              )}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          {/* `select-all` so one tap or click takes the whole hash — half a
              hash is worse than none. */}
          <p className="select-all break-all font-mono text-[12.5px] leading-relaxed text-foreground/90">
            {txHash}
          </p>
        </div>
      )}

      {/* The reference. Quieter than the hash — it identifies our record of
          the transfer, not the transfer itself. */}
      {reference && state !== "success" && (
        <button
          onClick={() => {
            navigator.clipboard.writeText(reference)
            setRefCopied(true)
            setTimeout(() => setRefCopied(false), 1500)
          }}
          className="ws-microswap inline-flex max-w-full items-center gap-1.5 text-[11px] text-subtle transition-colors hover:text-muted-foreground"
          title="Copy reference"
        >
          <span className="shrink-0">Ref</span>
          <span className="truncate font-mono">{reference}</span>
          <span className={cn("shrink-0 font-semibold", refCopied ? "text-credit" : "text-subtle")}>
            {refCopied ? "Copied" : "Copy"}
          </span>
        </button>
      )}

      {state === "processing" && autoUpdating && (
        <p className="ws-casc text-[11px] text-subtle" style={{ animationDelay: "620ms" }}>
          Updates automatically — you can leave this page.
        </p>
      )}

      {/* The end of a money flow, so the actions are sized like the decision
          they are: 52px, not the 11-unit chrome height. On a phone this is
          also the touch target, and "Back to wallet" was a 44px sliver under a
          full-height card. */}
      {(primary || secondary) && (
        <div className="flex w-full flex-col gap-2.5 pt-2 sm:flex-row-reverse">
          {primary &&
            (primary.href ? (
              <Link href={primary.href} className="flex h-[52px] flex-1 items-center justify-center rounded-full bg-primary text-[15px] font-bold text-primary-foreground transition-colors hover:bg-primary/90">
                {primary.label}
              </Link>
            ) : (
              <button onClick={primary.onClick} className="flex h-[52px] flex-1 items-center justify-center rounded-full bg-primary text-[15px] font-bold text-primary-foreground transition-colors hover:bg-primary/90">
                {primary.label}
              </button>
            ))}
          {secondary &&
            (secondary.href ? (
              <Link href={secondary.href} className="flex h-[52px] flex-1 items-center justify-center rounded-full bg-surface-sunken text-[15px] font-semibold text-foreground ring-1 ring-border/40 transition-colors hover:bg-accent">
                {secondary.label}
              </Link>
            ) : (
              <button onClick={secondary.onClick} className="flex h-[52px] flex-1 items-center justify-center rounded-full bg-surface-sunken text-[15px] font-semibold text-foreground ring-1 ring-border/40 transition-colors hover:bg-accent">
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
  action,
}: {
  title: string
  reason?: string
  /** Defaults to a caution mark. Illustrations are for promos and empty
   *  states — an error is not the place for borrowed art. */
  icon?: typeof AlertCircleIcon
  tone?: "warning" | "muted"
  /** Overrides the default "Back to dashboard" link. Inside a modal the way
   *  out is closing it — navigating would throw away the screen underneath. */
  action?: { label: string; onClick: () => void }
}) {
  const actionCls =
    "mt-1 inline-flex items-center rounded-full border border-primary/40 px-4 py-2 text-[13px] font-semibold text-primary transition-colors hover:bg-primary/10"
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl px-6 py-10 text-center">
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
      {action ? (
        <button type="button" onClick={action.onClick} className={actionCls}>
          {action.label}
        </button>
      ) : (
        <Link href="/" className={actionCls}>
          Back to dashboard
        </Link>
      )}
    </div>
  )
}

/* ── FlowSkeleton — loading placeholder in the flow's own shape ────────── */

export function FlowSkeleton() {
  // Neutral wash, not bg-card — the skeleton also renders inside the bg-card
  // modal, where card-coloured blocks are invisible.
  return (
    <div className="flex animate-pulse flex-col gap-4">
      <div className="h-12 rounded-2xl bg-foreground/[0.05]" />
      <div className="flex flex-col items-center gap-3 py-6">
        <div className="h-12 w-40 rounded-xl bg-foreground/[0.05]" />
        <div className="h-3 w-24 rounded bg-foreground/[0.05]" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="h-12 rounded-2xl bg-foreground/[0.05]" />
        <div className="h-12 rounded-2xl bg-foreground/[0.05]" />
        <div className="h-12 rounded-2xl bg-foreground/[0.05]" />
      </div>
      <div className="h-12 rounded-full bg-foreground/[0.05]" />
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
  /** Links out, or acts in place — a banner that offers a way forward has to
   *  be able to reach the same screen's state, not only another route. */
  action?: { label: string; href?: string; onClick?: () => void }
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
        {action &&
          (action.href ? (
            <Link href={action.href} className="mt-1 inline-flex min-h-9 w-fit items-center text-[12.5px] font-semibold text-primary hover:underline">
              {action.label} →
            </Link>
          ) : (
            <button
              onClick={action.onClick}
              className="mt-1 inline-flex min-h-9 w-fit items-center text-[12.5px] font-semibold text-primary hover:underline"
            >
              {action.label} →
            </button>
          ))}
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

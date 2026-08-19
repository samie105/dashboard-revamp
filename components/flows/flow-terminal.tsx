"use client"

/**
 * FlowTerminal — the money-flow modal's form, laid out as an INSTRUMENT
 * rather than a form. Two zones:
 *
 *   STAGE (left / top on mobile): the emotional half. Direction-coloured
 *   atmosphere, the amount huge with its live conversion, and the route
 *   drawn as a vertical transit line with a light beam forever travelling
 *   from source to destination.
 *
 *   CONTROLS (right / below): the working half. Picker chips, quick-amount
 *   chips, a full 3×4 keypad (physical typing still works — the amount is a
 *   real input and every control returns focus to it), the receipt collapsed
 *   to its total, and the CTA pinned at the bottom.
 *
 * The page variants (/buy, /sell, /fund) keep the single-column composition —
 * this is the overlay's native shape. State machines stay in the clients;
 * this component is layout + input affordances only.
 */

import * as React from "react"
import { cn } from "@/lib/utils"

type Endpoint = { label: string; sub?: React.ReactNode }
export type ReceiptRow = { label: string; value: React.ReactNode; strong?: boolean }

/* ── Route rail — the transit line on the stage ─────────────────────────── */

function RouteRail({ from, to, tone, className }: { from: Endpoint; to: Endpoint; tone: string; className?: string }) {
  const End = ({ ep, solid }: { ep: Endpoint; solid?: boolean }) => (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-3.5 w-3 shrink-0 items-center justify-center">
        <span
          className="h-2 w-2 rounded-full"
          style={solid ? { background: tone } : { boxShadow: `inset 0 0 0 2px ${tone}` }}
        />
      </span>
      <span className="flex min-w-0 flex-col">
        {/* Keyed by label: when the endpoint changes (network flip, venue
            swap) the new name takes a small rise instead of teleporting. */}
        <span key={ep.label} className="ws-microswap truncate text-[13px] font-semibold leading-tight">
          {ep.label}
        </span>
        {ep.sub && <span className="truncate text-[11.5px] tabular-nums text-muted-foreground">{ep.sub}</span>}
      </span>
    </div>
  )
  return (
    <div className={className}>
      <End ep={from} />
      {/* The beam always travels DOWN — the money always flows source →
          destination; direction is said by which endpoint sits where. */}
      <div className="relative my-1 ml-[5px] h-8 w-0.5 overflow-hidden rounded-full bg-border/50">
        <span
          aria-hidden
          className="ws-flow-beam absolute inset-x-0 top-0 h-4"
          style={{ background: `linear-gradient(to bottom, transparent, ${tone}, transparent)` }}
        />
      </div>
      <End ep={to} solid />
    </div>
  )
}

/* ── Keypad ─────────────────────────────────────────────────────────────── */

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"] as const

export function AmountKeypad({
  value,
  onChange,
  maxDecimals = 2,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  maxDecimals?: number
  disabled?: boolean
}) {
  const press = (k: string) => {
    if (k === "back") {
      onChange(value.slice(0, -1))
      return
    }
    if (k === ".") {
      if (value.includes(".")) return
      onChange(value === "" ? "0." : value + ".")
      return
    }
    const next = value === "0" ? k : value + k
    const [whole = "", frac] = next.split(".")
    if (frac !== undefined && frac.length > maxDecimals) return
    if (whole.length > 7) return
    onChange(frac !== undefined ? `${whole}.${frac}` : whole)
  }
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          tabIndex={-1}
          disabled={disabled}
          /* preventDefault on mousedown: the amount input keeps focus, so
             physical typing and the keypad interleave without a caret hop. */
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => press(k)}
          aria-label={k === "back" ? "Delete last digit" : k}
          className={cn(
            "flex h-12 items-center justify-center rounded-xl font-display text-lg font-medium tabular-nums",
            "transition-all duration-150 hover:bg-accent/70 active:scale-90 active:bg-accent motion-reduce:active:scale-100",
            "disabled:pointer-events-none disabled:opacity-40",
            k === "back" && "text-muted-foreground",
          )}
        >
          {k === "back" ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6H9l-5 6 5 6h11a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1Z" />
              <path d="m12 9 6 6M18 9l-6 6" />
            </svg>
          ) : (
            k
          )}
        </button>
      ))}
    </div>
  )
}

/* ── Chip row — network / venue selection as compact pills ─────────────── */

export function ChipRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string; sub?: string; icon?: string }[]
  value: T
  onChange: (k: T) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {options.map((o) => {
        const active = o.key === value
        return (
          <button
            key={o.key}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange(o.key)}
            className={cn(
              "flex items-center gap-2 rounded-full px-3 py-2 text-[13px] font-semibold transition-all active:scale-[0.96] motion-reduce:active:scale-100",
              active
                ? "bg-accent shadow-[0_6px_16px_-8px_rgb(0_0_0/0.6)] ring-1 ring-foreground/[0.10]"
                : "bg-surface-sunken/70 text-foreground/75 hover:bg-accent/60",
            )}
          >
            {o.icon && <img src={o.icon} alt="" className="h-[18px] w-[18px] rounded-full" />}
            {o.label}
            {o.sub && <span className="text-[11px] font-medium tabular-nums text-subtle">{o.sub}</span>}
            {active && (
              /* Gold = active state; pops in when the choice lands. */
              <span className="ws-pop-in flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/* ── Mini receipt — the total always visible, the itemisation one tap away ─ */

function MiniReceipt({ rows }: { rows: ReceiptRow[] }) {
  const [open, setOpen] = React.useState(false)
  const total = rows.find((r) => r.strong) ?? rows[rows.length - 1]
  const detail = rows.filter((r) => r !== total)
  return (
    <div className="rounded-xl bg-surface-sunken/70 ring-1 ring-border/25">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5"
      >
        <span className="text-[12.5px] text-muted-foreground">{total.label}</span>
        <span className="flex items-center gap-1.5 text-[13px] font-bold tabular-nums">
          {total.value}
          <svg
            className={cn("h-3 w-3 text-subtle transition-transform duration-200", open && "rotate-180")}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="border-t border-border/30 px-3.5 py-1">
          {detail.map((r) => (
            <div key={r.label} className="flex items-baseline gap-2.5 py-1.5">
              <span className="shrink-0 text-[12.5px] text-muted-foreground">{r.label}</span>
              <span aria-hidden className="mb-1 flex-1 self-end border-b border-dotted border-foreground/15" />
              <span className="shrink-0 text-[12.5px] font-medium tabular-nums">{r.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── The terminal ───────────────────────────────────────────────────────── */

export function FlowTerminal({
  direction,
  title,
  amount,
  onAmountChange,
  unit,
  approx,
  problem,
  hint,
  maxSpend,
  presets,
  maxDecimals = 2,
  route,
  topSlot,
  banners,
  picker,
  receipt,
  errorSlot,
  cta,
  disabled,
}: {
  direction: "in" | "out"
  title: string
  amount: string
  onAmountChange: (v: string) => void
  unit: string
  /** Live conversion for the typed amount — sits under the figure. */
  approx?: string | null
  /** Validation line — replaces approx/hint, warning tone. */
  problem?: string | null
  hint?: string
  maxSpend?: number | null
  presets?: number[]
  maxDecimals?: number
  route: { from: Endpoint; to: Endpoint }
  /** Renders at the top of the controls column (e.g. the Buy/Receive tabs). */
  topSlot?: React.ReactNode
  banners?: React.ReactNode
  /** The network / venue picker, eyebrow included. */
  picker?: React.ReactNode
  receipt?: ReceiptRow[] | null
  errorSlot?: React.ReactNode
  cta: React.ReactNode
  /** Inert form (paused / failed to load): keypad and chips disable. */
  disabled?: boolean
}) {
  const isIn = direction === "in"
  const tone = isIn ? "var(--credit)" : "var(--debit)"

  const inputRef = React.useRef<HTMLInputElement>(null)
  // preventScroll, never the autoFocus attribute — this mounts inside an
  // overlay and a scrolling focus once yanked the whole page.
  React.useEffect(() => {
    inputRef.current?.focus({ preventScroll: true })
  }, [])

  // Each landed digit gives the figure a tiny pop. Replayed by class swap —
  // remounting the input would drop focus and the caret.
  React.useEffect(() => {
    const el = inputRef.current
    if (!el || amount === "") return
    el.classList.remove("ws-digit-pop")
    void el.offsetWidth
    el.classList.add("ws-digit-pop")
  }, [amount])

  // Same sanitiser as AmountField: digits, one dot, capped decimals, no
  // leading-zero runs.
  const setFromTyping = (v: string) => {
    if (!/^[0-9]*\.?[0-9]*$/.test(v)) return
    const [whole = "", frac] = v.split(".")
    const w = whole.replace(/^0+(?=\d)/, "")
    if (frac !== undefined && frac.length > maxDecimals) return
    onAmountChange(frac !== undefined ? `${w}.${frac}` : w)
  }

  const chips: { label: string; value: string }[] =
    maxSpend != null && maxSpend > 0
      ? [0.25, 0.5, 0.75, 1].map((pct) => ({
          label: pct === 1 ? "Max" : `${pct * 100}%`,
          value: pct === 1 ? String(Math.floor(maxSpend * 100) / 100) : (maxSpend * pct).toFixed(2),
        }))
      : (presets ?? []).map((p) => ({ label: p.toLocaleString(), value: String(p) }))

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      {/* ── Stage ── */}
      <div className="relative flex shrink-0 flex-col gap-5 overflow-hidden px-5 pb-5 pt-3 md:w-[44%] md:justify-between md:border-r md:border-border/30 md:px-6 md:pb-6 md:pt-4">
        {/* Direction atmosphere — the stage is lit in the money's colour,
            with the same slow aurora register as the dashboard's silk. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(130% 100% at 20% 0%, color-mix(in oklab, ${tone} 13%, transparent) 0%, transparent 62%)`,
            }}
          />
          <div
            className="ws-aurora-a absolute -left-12 top-6 h-40 w-64 rounded-full blur-2xl"
            style={{ background: `radial-gradient(closest-side, color-mix(in oklab, ${tone} 17%, transparent), transparent)` }}
          />
          <div
            className="ws-aurora-b absolute -right-10 bottom-8 hidden h-36 w-56 rounded-full blur-2xl md:block"
            style={{ background: `radial-gradient(closest-side, color-mix(in oklab, ${tone} 11%, transparent), transparent)` }}
          />
        </div>

        <div className="ws-casc ws-casc-1 relative flex flex-col gap-0.5">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.14em]" style={{ color: tone }}>
            {isIn ? "Money in" : "Money out"}
          </span>
          <h2 className="font-display text-[17px] font-bold tracking-[-0.01em]">{title}</h2>
        </div>

        <div className="ws-casc-pop ws-casc-2 relative flex flex-col items-start gap-1.5">
          <input
            ref={inputRef}
            value={amount}
            onChange={(e) => setFromTyping(e.target.value)}
            inputMode="decimal"
            placeholder="0"
            aria-label={`Amount in ${unit}`}
            data-vivid-target="flow-amount"
            data-vivid-label={`The amount to move, in ${unit}`}
            className="w-full min-w-0 bg-transparent font-display text-[clamp(2.6rem,5vw,3.4rem)] font-light leading-none tracking-[-0.02em] tabular-nums caret-primary outline-none placeholder:text-muted-foreground/30"
          />
          <span className="rounded-full bg-surface-sunken/80 px-2.5 py-1 text-[11px] font-bold tracking-[0.04em] text-muted-foreground ring-1 ring-border/25">
            {unit}
          </span>
          {problem ? (
            <p className="text-[12.5px] font-medium leading-snug text-warning">{problem}</p>
          ) : approx ? (
            <p className="ws-microswap text-[12.5px] font-medium tabular-nums text-muted-foreground">{approx}</p>
          ) : hint ? (
            <p className="text-[11.5px] text-subtle">{hint}</p>
          ) : null}
        </div>

        <RouteRail from={route.from} to={route.to} tone={tone} className="ws-casc ws-casc-3 relative" />
      </div>

      {/* ── Controls ── */}
      <div className="relative flex min-w-0 flex-1 flex-col gap-3 px-4 pb-4 pt-3 sm:px-5">
        {topSlot}
        {banners}
        {picker && <div className="ws-casc ws-casc-3">{picker}</div>}

        {chips.length > 0 && (
          <div className="ws-casc ws-casc-4 flex flex-wrap items-center gap-1.5">
            {chips.map((c) => (
              <button
                key={c.label}
                type="button"
                disabled={disabled}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onAmountChange(c.value)}
                className="rounded-full bg-surface-sunken px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-90 disabled:pointer-events-none disabled:opacity-40 motion-reduce:active:scale-100"
              >
                {c.label}
              </button>
            ))}
          </div>
        )}

        <div className="ws-casc ws-casc-5">
          <AmountKeypad value={amount} onChange={onAmountChange} maxDecimals={maxDecimals} disabled={disabled} />
        </div>

        {receipt && receipt.length > 0 && (
          <div className="ws-casc ws-casc-6">
            <MiniReceipt rows={receipt} />
          </div>
        )}
        {errorSlot}

        {/* Pinned confirm — a money modal never hides its button below the
            fold. Solid footer with a hairline; content slides under it. */}
        <div className="ws-casc ws-casc-6 sticky bottom-0 z-10 -mx-4 -mb-4 mt-auto border-t border-border/40 bg-card/85 px-4 pb-4 pt-3 backdrop-blur-xl sm:-mx-5 sm:px-5">
          {cta}
        </div>
      </div>
    </div>
  )
}

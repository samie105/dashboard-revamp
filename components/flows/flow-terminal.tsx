"use client"

/**
 * FlowTerminal — the money-flow modal's form, laid out as an INSTRUMENT
 * rather than a form. Two zones:
 *
 *   STAGE (left / top on mobile): the emotional half. Direction-coloured
 *   atmosphere, the amount huge with its live conversion and quick-amount
 *   chips, and the route drawn as a vertical transit line with a light
 *   beam forever travelling from source to destination.
 *
 *   CONTROLS (right / below): the decisions. Full-width option rows for
 *   the network / venue (each carrying its real wallet address or balance,
 *   with a radio that turns into the gold check), the receipt always open
 *   — ending with what the Dollar Account will hold AFTER the move — and
 *   the CTA pinned at the bottom.
 *
 * The page variants (/buy, /sell, /fund) keep the single-column
 * composition — this is the overlay's native shape. State machines stay
 * in the clients; this component is layout + input affordances only.
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import { DetailPanel } from "@/components/ui/flow"

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

/* ── Option rows — the network / venue decision, one row per choice ────── */

export function OptionRows<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { key: T; label: string; sub?: React.ReactNode; icon?: string }[]
  value: T
  onChange: (k: T) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {options.map((o) => {
        const active = o.key === value
        return (
          <button
            key={o.key}
            type="button"
            disabled={disabled}
            /* preventDefault on mousedown keeps focus on the amount input,
               so picking a network never interrupts typing. */
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange(o.key)}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-all active:scale-[0.99] motion-reduce:active:scale-100",
              "disabled:pointer-events-none disabled:opacity-40",
              active
                ? // Selection = raised fill + a half-step of depth, per the
                  // house rule — never a gold border.
                  "bg-accent shadow-[0_8px_20px_-10px_rgb(0_0_0/0.6)] ring-1 ring-foreground/[0.10]"
                : "bg-surface-sunken/60 hover:bg-accent/60",
            )}
          >
            {o.icon && <img src={o.icon} alt="" className="h-6 w-6 shrink-0 rounded-full" />}
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className={cn("text-[13.5px] font-semibold", !active && "text-foreground/85")}>{o.label}</span>
              {o.sub && <span className="mt-0.5 truncate text-[11.5px] tabular-nums text-muted-foreground">{o.sub}</span>}
            </span>
            {active ? (
              /* Gold = active state; pops in when the choice lands. */
              <span className="ws-pop-in flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </span>
            ) : (
              <span className="h-4 w-4 shrink-0 rounded-full ring-1 ring-inset ring-border" />
            )}
          </button>
        )
      })}
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
  /** Always-open ticket; the clients end it with the balance-after line. */
  receipt?: ReceiptRow[] | null
  errorSlot?: React.ReactNode
  cta: React.ReactNode
  /** Inert form (paused / failed to load): chips disable. */
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

        <div className="ws-casc-pop ws-casc-2 relative flex flex-col items-start gap-2">
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
          <div className="flex flex-wrap items-center gap-1">
            <span className="rounded-full bg-surface-sunken/80 px-2 py-1 text-[10.5px] font-bold tracking-[0.04em] text-muted-foreground ring-1 ring-border/25">
              {unit}
            </span>
            {chips.map((c) => (
              <button
                key={c.label}
                type="button"
                disabled={disabled}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onAmountChange(c.value)}
                className="rounded-full bg-surface-sunken/80 px-2 py-1 text-[10.5px] font-semibold text-muted-foreground ring-1 ring-border/25 transition-all hover:bg-accent hover:text-foreground active:scale-90 disabled:pointer-events-none disabled:opacity-40 motion-reduce:active:scale-100"
              >
                {c.label}
              </button>
            ))}
          </div>
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
      <div className="relative flex min-w-0 flex-1 flex-col gap-3.5 px-4 pb-4 pt-3 sm:px-5">
        {topSlot}
        {banners}
        {picker && <div className="ws-casc ws-casc-4">{picker}</div>}

        {receipt && receipt.length > 0 && (
          /* ws-microswap, NOT a cascade beat: this mounts on the first typed
             digit, and a delay-laddered entrance would hold it invisible for
             its whole delay every time. The ladder is for modal-open only. */
          <div className="ws-microswap">
            <DetailPanel rows={receipt} />
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

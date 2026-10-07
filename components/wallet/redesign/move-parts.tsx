"use client"

/**
 * The preview's form parts for the Move funds panel
 * (components/wallet-unauth/action-panel.tsx) — FieldLabel, Note, the gold
 * button, the asset dropdown and the amount field — with the real inputs'
 * rules: the amount field keeps the asset's own precision and floors its
 * percentage chips (as components/ui/flow.tsx AmountField does), and shows
 * the flow's own validation message where the preview said "More than you
 * have".
 */

import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { Alert02Icon, ArrowDown01Icon, InformationCircleIcon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { Figure, Icon } from "@/components/dashboard/redesign/ui"
import { acceptAmountInput, chipAmount } from "@/lib/wallet-view"

export function FieldLabel({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-0.5">
      <span className="text-[12.5px] font-semibold text-foreground/85">{children}</span>
      {aside && <span className="min-w-0 truncate text-[12px] text-muted-foreground">{aside}</span>}
    </div>
  )
}

export function Note({ tone = "info", children }: { tone?: "info" | "warning" | "error" | "success"; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[12.5px] leading-relaxed",
        tone === "warning"
          ? "border-warning/25 bg-warning/[0.06] text-foreground/80"
          : tone === "error"
            ? "border-debit/25 bg-debit/[0.06] text-foreground/80"
            : tone === "success"
              ? "border-credit/25 bg-credit/[0.06] text-foreground/80"
              : "border-foreground/[0.06] bg-foreground/[0.025] text-muted-foreground",
      )}
    >
      <Icon
        icon={tone === "info" ? InformationCircleIcon : Alert02Icon}
        className={cn(
          "mt-0.5 size-4 shrink-0",
          tone === "warning" ? "text-warning" : tone === "error" ? "text-debit" : tone === "success" ? "text-credit" : "text-muted-foreground",
        )}
      />
      <span className="min-w-0">{children}</span>
    </div>
  )
}

/** The submit button. `label` carries the same Vivid control identity the
 *  flow's own FlowCta gives it (components/ui/flow.tsx): by default a guarded
 *  "flow-submit" that announces a real money move. */
export function PrimaryButton({
  children,
  disabled,
  busy,
  onClick,
  label,
  control,
}: {
  children: React.ReactNode
  disabled?: boolean
  busy?: boolean
  onClick?: () => void
  label: string
  control?: { target: string; describe: string; guarded?: boolean }
}) {
  const guarded = control?.guarded ?? true
  return (
    <button
      type="button"
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      onClick={onClick}
      data-vivid-target={control?.target ?? "flow-submit"}
      data-vivid-guard={guarded ? "" : undefined}
      aria-label={control ? `${control.describe} — ${label}` : `Confirm transfer — ${label}`}
      data-vivid-label={control ? `${control.describe}: ${label}.` : `Submit this money flow: ${label}. Moves real money.`}
      className="ds-gold flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14.5px] font-semibold disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none"
    >
      {busy && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  )
}

/* ── Asset dropdown ───────────────────────────────────────────────────── */

export type AssetOption = {
  key: string
  symbol: string
  logo?: string
  /** Second line in the list — the network the holding sits on. */
  network: string
  /** Second line on the closed field — usually the asset's name or network. */
  name: string
  amount: string
}

export function AssetSelect({
  options,
  value,
  onChange,
  label = "Asset",
  disabled,
  placeholder = "Choose an asset",
}: {
  options: AssetOption[]
  value: AssetOption | undefined
  onChange: (key: string) => void
  label?: string
  disabled?: boolean
  placeholder?: string
}) {
  const [open, setOpen] = React.useState(false)
  const wrap = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("pointerdown", onDown)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("pointerdown", onDown)
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div ref={wrap} className="relative flex flex-col gap-2">
      <FieldLabel>{label}</FieldLabel>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-14 items-center gap-3 rounded-xl border bg-foreground/[0.025] px-3.5 text-left transition-colors disabled:opacity-50",
          open ? "border-primary/45" : "border-foreground/[0.08] hover:border-foreground/[0.14]",
        )}
      >
        {value ? (
          <>
            <CoinAvatar symbol={value.symbol} src={value.logo} size="lg" className="size-8 ring-1 ring-foreground/10" />
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="text-[14px] font-semibold text-foreground">{value.symbol}</span>
              <span className="truncate text-[12px] text-muted-foreground">{value.name}</span>
            </span>
            <span className="flex flex-col items-end leading-tight">
              <span className="text-[13px] font-semibold tabular-nums text-foreground">
                <Figure mask="••••">{value.amount}</Figure>
              </span>
              <span className="text-[11.5px] text-muted-foreground">available</span>
            </span>
          </>
        ) : (
          <span className="flex-1 text-[13.5px] text-muted-foreground">{placeholder}</span>
        )}
        <Icon icon={ArrowDown01Icon} className={cn("size-4 text-muted-foreground transition-transform duration-300", open && "rotate-180")} strokeWidth={2} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
            className="slim-scroll absolute inset-x-0 top-full z-30 mt-1.5 max-h-[264px] overflow-y-auto rounded-xl border border-foreground/[0.08] bg-popover/98 p-1.5 shadow-[0_20px_50px_-12px_rgb(0_0_0/0.45)] backdrop-blur-xl"
          >
            {options.map((r) => (
              <li key={r.key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={value?.key === r.key}
                  onClick={() => {
                    onChange(r.key)
                    setOpen(false)
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-foreground/[0.05]",
                    value?.key === r.key && "bg-primary/[0.08]",
                  )}
                >
                  <CoinAvatar symbol={r.symbol} src={r.logo} size="lg" className="size-7 ring-1 ring-foreground/10" />
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="text-[13.5px] font-semibold">{r.symbol}</span>
                    <span className="truncate text-[11.5px] text-muted-foreground">{r.network}</span>
                  </span>
                  <span className="text-[12.5px] font-medium tabular-nums text-muted-foreground">
                    <Figure mask="••••">{r.amount}</Figure>
                  </span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Amount field ─────────────────────────────────────────────────────── */

export function AmountField({
  value,
  onChange,
  max,
  symbol,
  maxDecimals,
  problem,
  approx,
  hint,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  /** Spendable maximum, or null when it isn't known yet. */
  max: number | null
  symbol: string
  maxDecimals: number
  problem?: string | null
  approx?: string | null
  hint?: string | null
  disabled?: boolean
}) {
  // Same input rule as the flow's own field (lib/wallet-view.ts).
  const set = (raw: string) => {
    const next = acceptAmountInput(raw, maxDecimals)
    if (next !== null) onChange(next)
  }
  const part = (pct: number) => (max === null ? "" : chipAmount(max, pct, maxDecimals))

  return (
    <div className="flex flex-col gap-2">
      <FieldLabel aside={max !== null ? <Figure mask="••••">{`Max ${max} ${symbol}`}</Figure> : undefined}>Amount</FieldLabel>
      <div
        className={cn(
          "flex h-14 items-center gap-2 rounded-xl border bg-foreground/[0.025] pl-3.5 pr-2 transition-colors focus-within:border-primary/45",
          problem ? "border-debit/50" : "border-foreground/[0.08]",
        )}
      >
        <input
          inputMode="decimal"
          value={value}
          disabled={disabled}
          onChange={(e) => set(e.target.value)}
          placeholder="0.00"
          aria-label={`Amount in ${symbol}`}
          data-vivid-target="flow-amount"
          data-vivid-label={`The amount to move, in ${symbol}`}
          className="min-w-0 flex-1 bg-transparent font-display text-[18px] font-semibold tabular-nums text-foreground outline-none placeholder:text-muted-foreground/40 disabled:opacity-50"
        />
        <span className="text-[13px] font-semibold text-muted-foreground">{symbol}</span>
        <button
          type="button"
          disabled={disabled || max === null || max <= 0}
          onClick={() => onChange(part(1))}
          className="h-8 rounded-lg bg-primary/[0.12] px-3 text-[12px] font-bold uppercase tracking-[0.04em] text-primary transition-colors hover:bg-primary/20 disabled:opacity-40"
        >
          Max
        </button>
      </div>
      <div className="flex items-center justify-between gap-2 px-0.5">
        <div className="flex gap-1.5">
          {[25, 50, 75].map((p) => (
            <button
              key={p}
              type="button"
              disabled={disabled || max === null || max <= 0}
              onClick={() => onChange(part(p / 100))}
              className="h-7 rounded-lg border border-foreground/[0.07] px-2.5 text-[11.5px] font-semibold text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground disabled:opacity-40"
            >
              {p}%
            </button>
          ))}
        </div>
        <span className={cn("min-w-0 truncate text-right text-[12px] tabular-nums", problem ? "font-semibold text-debit" : "text-muted-foreground")}>
          {problem ?? approx ?? hint ?? " "}
        </span>
      </div>
    </div>
  )
}

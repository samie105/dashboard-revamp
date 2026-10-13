"use client"

/**
 * The preview ticket's building blocks (components/buy-sell-unauth/ticket.tsx),
 * on tokens instead of the preview's fixed near-black surfaces. Shared by the
 * Buy and Sell tickets. Presentational only.
 */

import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { ArrowDown01Icon, ArrowDownDoubleIcon, Tick02Icon, Wallet02Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { Icon, SLIDE, type IconSvg } from "@/components/dashboard/redesign/ui"

/* ── Picker (asset or currency) ───────────────────────────────────────── */

export type PickerItem = { key: string; label: string; sub: string; art: React.ReactNode }

/** The preview's dropdown chip. With one choice (or `disabled`) it's a plain chip. */
export function Picker({ items, value, onChange, label, disabled = false }: { items: PickerItem[]; value: string; onChange: (key: string) => void; label: string; disabled?: boolean }) {
  const [open, setOpen] = React.useState(false)
  const wrap = React.useRef<HTMLDivElement>(null)
  const current = items.find((i) => i.key === value) ?? items[0]
  const fixed = disabled || items.length <= 1

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

  if (!current) return null
  return (
    <div ref={wrap} className="relative shrink-0">
      <button
        type="button"
        aria-label={label}
        aria-haspopup={fixed ? undefined : "listbox"}
        aria-expanded={fixed ? undefined : open}
        disabled={fixed}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-11 items-center gap-2 rounded-full border bg-foreground/[0.04] pl-1.5 pr-3 transition-colors disabled:cursor-default",
          open ? "border-primary/45" : "border-foreground/[0.09]",
          !fixed && !open && "hover:border-foreground/[0.16]",
          fixed && "pr-4",
        )}
      >
        {current.art}
        <span className="text-[14.5px] font-semibold text-foreground">{current.label}</span>
        {!fixed && <Icon icon={ArrowDown01Icon} className={cn("size-4 text-muted-foreground transition-transform duration-300", open && "rotate-180")} strokeWidth={2} />}
      </button>
      <AnimatePresence>
        {open && !fixed && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 top-full z-30 mt-2 max-h-[320px] w-[248px] origin-top-right overflow-y-auto rounded-2xl border border-foreground/[0.08] bg-popover/98 p-1.5 shadow-[0_20px_50px_-12px_rgb(0_0_0/0.45)] backdrop-blur-xl"
          >
            {items.map((i) => (
              <li key={i.key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i.key === value}
                  onClick={() => {
                    onChange(i.key)
                    setOpen(false)
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-foreground/[0.05]",
                    i.key === value && "bg-primary/[0.08]",
                  )}
                >
                  {i.art}
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="text-[13.5px] font-semibold text-foreground">{i.label}</span>
                    <span className="truncate text-[11.5px] text-muted-foreground">{i.sub}</span>
                  </span>
                  {i.key === value && <Icon icon={Tick02Icon} className="size-4 text-primary" strokeWidth={2.2} />}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}

/** A country flag from its emoji (as FiatSelect draws it): an image, since Windows shows flag emoji as bare letters. */
export function FlagArt({ flag }: { flag?: string }) {
  const [failed, setFailed] = React.useState(false)
  const code = flag ? Array.from(flag).map((letter) => String.fromCharCode((letter.codePointAt(0) ?? 0) - 127397)).join("").toLowerCase() : ""
  const ok = /^[a-z]{2}$/.test(code) && !failed
  return (
    <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/25 bg-primary/[0.1] text-[11px] font-semibold text-primary">
      {ok ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`https://flagcdn.com/w40/${code}.png`} alt="" className="size-full object-cover" onError={() => setFailed(true)} />
      ) : (
        code.toUpperCase()
      )}
    </span>
  )
}

/* ── Amount box ───────────────────────────────────────────────────────── */

export function AmountBox({
  label,
  aside,
  children,
  footer,
  tone = "default",
}: {
  label: string
  aside?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  tone?: "default" | "error" | "muted"
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border p-4 transition-colors sm:p-5",
        tone === "error" ? "border-debit/40 bg-debit/[0.03]" : tone === "muted" ? "border-foreground/[0.05] bg-foreground/[0.015]" : "border-foreground/[0.08] bg-foreground/[0.025] focus-within:border-primary/40",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
        {aside && <span className="text-[12.5px] text-muted-foreground">{aside}</span>}
      </div>
      <div className="flex items-center gap-3">{children}</div>
      {footer}
    </div>
  )
}

export const amountInput =
  "min-w-0 flex-1 bg-transparent font-display text-[30px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-foreground outline-none placeholder:text-muted-foreground/30 disabled:opacity-50 sm:text-[34px]"

/** The joint between the pay and receive boxes. */
export function Joint() {
  return (
    <span className="absolute left-1/2 top-[calc(50%-4px)] z-10 flex size-10 -translate-x-1/2 items-center justify-center rounded-full border-4 border-card bg-muted text-primary">
      <Icon icon={ArrowDownDoubleIcon} className="size-4" strokeWidth={2} />
    </span>
  )
}

/* ── Method cards ─────────────────────────────────────────────────────── */

export type MethodCard = {
  key: string
  label: string
  detail: string
  icon: IconSvg
  /** Right column, top and bottom lines. */
  top?: string
  bottom?: string
  /** Shown but not selectable. */
  soon?: boolean
}

export function MethodGrid({ label, methods, value, onChange, id, disabled = false }: { label: string; methods: MethodCard[]; value: string; onChange: (key: string) => void; id: string; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="px-0.5 text-[12.5px] font-semibold text-foreground/85">{label}</span>
      <div role="radiogroup" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {methods.map((m) => {
          const on = m.key === value
          const off = m.soon || disabled
          return (
            <button
              key={m.key}
              type="button"
              role="radio"
              aria-checked={on}
              aria-disabled={off || undefined}
              onClick={() => !off && onChange(m.key)}
              className={cn(
                "relative flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors",
                m.soon ? "cursor-not-allowed border-foreground/[0.05] opacity-45" : on ? "border-primary/55" : "border-foreground/[0.07] hover:border-foreground/[0.14]",
              )}
            >
              {on && <motion.span layoutId={id} transition={SLIDE} className="absolute inset-0 rounded-2xl bg-primary/[0.06]" />}
              <span className={cn("relative flex size-10 shrink-0 items-center justify-center rounded-xl border", on ? "border-primary/40 bg-primary/[0.12] text-primary" : "border-foreground/[0.07] bg-foreground/[0.03] text-foreground/80")}>
                <Icon icon={m.icon ?? Wallet02Icon} className="size-[18px]" />
              </span>
              <span className="relative flex min-w-0 flex-1 flex-col leading-tight">
                <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-foreground">
                  <span className="truncate">{m.label}</span>
                  {m.soon && <span className="rounded bg-foreground/[0.08] px-1 text-[9.5px] font-bold uppercase tracking-[0.05em] text-muted-foreground">Soon</span>}
                </span>
                <span className="truncate text-[12px] text-muted-foreground">{m.detail}</span>
              </span>
              {(m.top || m.bottom) && (
                <span className="relative flex flex-col items-end leading-tight">
                  {m.top && <span className="text-[12px] font-semibold text-foreground/80">{m.top}</span>}
                  {m.bottom && <span className="text-[11px] text-muted-foreground">{m.bottom}</span>}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ── Breakdown ────────────────────────────────────────────────────────── */

export type BreakdownRow = { label: string; value: React.ReactNode; strong?: boolean }

export function Breakdown({ rows }: { rows: BreakdownRow[] }) {
  const body = rows.filter((r) => !r.strong)
  const total = rows.filter((r) => r.strong)
  return (
    <dl className="flex flex-col gap-2.5 rounded-2xl border border-foreground/[0.06] bg-foreground/[0.015] px-4 py-3.5 text-[13px]">
      {body.map((r) => (
        <div key={r.label} className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{r.label}</dt>
          <dd className="min-w-0 break-words text-right font-semibold tabular-nums text-foreground">{r.value}</dd>
        </div>
      ))}
      {total.map((r) => (
        <div key={r.label} className="mt-1 flex justify-between gap-3 border-t border-foreground/[0.06] pt-3">
          <dt className="font-semibold text-foreground">{r.label}</dt>
          <dd className="min-w-0 break-words text-right font-display text-[15px] font-semibold tabular-nums text-foreground">{r.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/* ── Order screen pieces ──────────────────────────────────────────────── */

/** The status badge: a spinner while working, a tick when done, a mark otherwise. */
export function StatusBadge({ state }: { state: "working" | "done" | "problem" | "review" }) {
  return (
    <span className="relative flex size-16 items-center justify-center">
      {state === "working" && <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />}
      <span
        className={cn(
          "relative flex size-16 items-center justify-center rounded-full",
          state === "done" ? "bg-credit/[0.14] text-credit" : state === "problem" ? "bg-debit/[0.12] text-debit" : state === "review" ? "bg-warning/[0.12] text-warning" : "bg-primary/[0.12] text-primary",
        )}
      >
        {state === "done" ? (
          <Icon icon={Tick02Icon} className="size-8" strokeWidth={2.4} />
        ) : state === "working" ? (
          <span className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        ) : (
          <span className="font-display text-[26px] font-semibold leading-none">!</span>
        )}
      </span>
    </span>
  )
}

/** The staged checklist. `active` = index in flight; stages.length = all done. */
export function Stages({ stages, active }: { stages: string[]; active: number }) {
  return (
    <ol className="flex flex-col rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02] p-4">
      {stages.map((s, i) => {
        const state = i < active ? "done" : i === active ? "current" : "todo"
        return (
          <li key={s} className="relative flex items-center gap-3 py-2">
            {i < stages.length - 1 && <span aria-hidden className={cn("absolute left-[11px] top-[30px] h-[calc(100%-14px)] w-px transition-colors duration-500", state === "done" ? "bg-credit/40" : "bg-foreground/[0.08]")} />}
            <span
              className={cn(
                "relative flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-300",
                state === "done" && "border-credit/40 bg-credit/[0.12] text-credit",
                state === "current" && "border-primary/50 bg-primary/[0.1]",
                state === "todo" && "border-foreground/[0.1]",
              )}
            >
              {state === "done" ? <Icon icon={Tick02Icon} className="size-3" strokeWidth={2.6} /> : state === "current" ? <span className="size-2 animate-pulse rounded-full bg-primary" /> : null}
            </span>
            <span className={cn("text-[13.5px] font-medium transition-colors", state === "todo" ? "text-muted-foreground" : "text-foreground")}>{s}</span>
          </li>
        )
      })}
    </ol>
  )
}

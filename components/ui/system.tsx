"use client"

/**
 * System primitives — the web port of the mobile app's `crypto/ui/bits.tsx`
 * discipline. Sizes here are measured off the live iPhone 17 simulator, not
 * guessed. House rules these encode:
 *
 *  · Colour carries meaning only: gold = brand/primary action, emerald/red =
 *    money direction (via the --credit/--debit token pairs), nothing decorative.
 *  · Dark cards separate by fill, not outline; rows separate with hairlines.
 *  · Every figure is tabular so live values don't jitter.
 *  · A card names itself INSIDE the card (title + subtitle), never with a
 *    decorative leading icon.
 *  · Active segment = neutral raised fill (accent), never a gold fill.
 *  · Balance figures are LIGHT weight and large — the hero is airy, not chunky.
 */

import * as React from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { RollingAmount } from "@/components/ui/rolling-amount"

export { RollingAmount }

/* ── Illustrations — ported from the mobile app's assets/banners ────────── */

export const illustrations = {
  noCrypto:        "/illustrations/no-crypto-yet.png",
  noTransactions:  "/illustrations/empty-transactions.png",
  noNotifications: "/illustrations/empty-notifications.png",
  beneficiaries:   "/illustrations/beneficiaries.png",
  kyc:             "/illustrations/kyc-gold.png",
  twoFactor:       "/illustrations/two-factor-auth.png",
  cryptoBuy:       "/illustrations/crypto-buy.png",
  cryptoSwap:      "/illustrations/crypto-swap.png",
  cryptoTrade:     "/illustrations/crypto-trade.png",
  welcome:         "/illustrations/dashboard-welcome.png",
  noMessages:      "/illustrations/no-messages-illustration.png",
  unauthorized:    "/illustrations/unauthorized-illustration.png",
} as const

export type IllustrationKey = keyof typeof illustrations

/* ── Rise — staggered entrance wrapper (mobile's Rise cascade) ─────────── */

export function Rise({
  delay = 0,
  className,
  children,
}: {
  delay?: number
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("rise", className)} style={{ "--rise-delay": `${delay}ms` } as React.CSSProperties}>
      {children}
    </div>
  )
}

/* ── Eyebrow — the uppercase section/stat label (mobile: 13px, 0.08em) ─── */

export function Eyebrow({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground", className)}>
      {children}
    </span>
  )
}

/* ── Balance — the hero figure. Large, LIGHT, tabular. ─────────────────── */

export function Balance({
  value,
  hidden,
  mask = "$••••••",
  className,
}: {
  value: string
  hidden?: boolean
  mask?: string
  className?: string
}) {
  return (
    <RollingAmount
      value={hidden ? mask : value}
      className={cn(
        "font-display font-light leading-[1.05] tracking-[-0.02em]",
        "text-[clamp(2.75rem,5.5vw,4.5rem)]",
        className,
      )}
    />
  )
}

/* ── DeltaChip — percent/amount change in a 14%-tinted chip ────────────── */

export function DeltaChip({
  value,
  suffix = "%",
  prefix,
  className,
}: {
  /** The signed number. Positive renders credit, negative renders debit. */
  value: number
  suffix?: string
  prefix?: string
  className?: string
}) {
  const up = value >= 0
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-1 text-[13px] font-semibold tabular-nums",
        up ? "bg-credit-chip text-credit" : "bg-debit-chip text-debit",
        className,
      )}
    >
      {up ? "+" : ""}
      {prefix}
      {Math.abs(value) >= 1000
        ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
        : value.toFixed(2)}
      {suffix}
    </span>
  )
}

/* ── ChangeText — bare directional figure for table cells ──────────────── */

export function ChangeText({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("font-medium tabular-nums", value >= 0 ? "text-credit" : "text-debit", className)}>
      {value >= 0 ? "+" : ""}
      {value.toFixed(2)}%
    </span>
  )
}

/* ── Segmented — the ONE tab system. Fully-rounded track, raised thumb. ── */

export type SegmentedOption<T extends string> = {
  key: T
  label: string
  icon?: React.ComponentType<{ className?: string }>
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  className,
}: {
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (key: T) => void
  /** md = the mobile 40px bar. sm = compact, for inside card headers. */
  size?: "sm" | "md"
  className?: string
}) {
  const md = size === "md"
  return (
    // The track is the SUNKEN step of the stone ladder and the thumb is the
    // RAISED one — two full steps apart, so the selection stays legible on a
    // card, on the page, and on top of the silk field. A translucent track
    // (foreground/6%) picked up whatever was behind it and the thumb vanished.
    <div
      className={cn(
        "inline-flex shrink-0 items-center rounded-full bg-surface-sunken",
        md ? "gap-1 p-1" : "gap-0.5 p-0.5",
        className,
      )}
    >
      {options.map((opt) => {
        const active = value === opt.key
        const Icon = opt.icon
        return (
          <button
            key={opt.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.key)}
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              md ? "px-3.5 py-2 text-[13px]" : "px-2.5 py-1 text-xs",
              active
                ? "bg-card text-foreground shadow-sm ring-1 ring-foreground/[0.08] dark:bg-accent"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {Icon && <Icon className={cn(md ? "h-4 w-4" : "h-3.5 w-3.5", active && "text-primary")} />}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

/* ── PageHeader — title + subtitle, bare icon actions on the right ─────── */

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
  className,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  /** Where "back" goes. A href navigates; a function runs instead (close a
   *  modal, step back inside a flow). Sub-pages should always pass one — a
   *  screen you can only leave through the browser chrome is a dead end. */
  back?: string | (() => void)
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 items-start gap-2">
        {back !== undefined && <BackAction to={back} />}
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="font-display text-2xl font-bold tracking-[-0.01em]">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-1">{actions}</div>}
    </div>
  )
}

/** The one back control. Sits on the SUNKEN step so it reads as a control
 *  rather than a link, and lines up with the title's cap height. */
export function BackAction({ to, className }: { to: string | (() => void); className?: string }) {
  const cls = cn(
    "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
    className,
  )
  const icon = <HugeiconsIcon icon={ArrowLeft01Icon} className="h-[18px] w-[18px]" />
  return typeof to === "string" ? (
    <Link href={to} aria-label="Back" title="Back" className={cls}>{icon}</Link>
  ) : (
    <button type="button" onClick={to} aria-label="Back" title="Back" className={cls}>{icon}</button>
  )
}

/** Bare icon button for PageHeader actions — no chip, no border. */
export function IconAction({
  icon: Icon,
  label,
  onClick,
  href,
  active,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick?: () => void
  href?: string
  active?: boolean
}) {
  const cls = cn(
    "inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-accent",
    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
  )
  const inner = <Icon className="h-[18px] w-[18px]" />
  return href ? (
    <a href={href} aria-label={label} title={label} className={cls}>{inner}</a>
  ) : (
    <button onClick={onClick} aria-label={label} title={label} className={cls}>{inner}</button>
  )
}

/* ── CardHeader — the in-card header idiom (no decorative icon) ────────── */

export function CardHeader({
  title,
  subtitle,
  link,
  right,
  className,
}: {
  title: string
  subtitle?: string
  link?: { label: string; href: string }
  right?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 px-4 py-3.5", className)}>
      <div className="flex min-w-0 flex-col">
        <h3 className="text-[15px] font-semibold leading-tight">{title}</h3>
        {subtitle && <span className="text-[13px] text-muted-foreground">{subtitle}</span>}
      </div>
      {right}
      {link && (
        <a href={link.href} className="shrink-0 text-[13px] font-medium text-primary hover:underline">
          {link.label}
        </a>
      )}
    </div>
  )
}

/* ── ActionPill — gold circular icon chip + label (mobile home rail) ───── */

export function ActionPill({
  icon: Icon,
  label,
  href,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  href?: string
  onClick?: () => void
}) {
  const cls =
    "flex shrink-0 items-center gap-2.5 rounded-full bg-card py-2 pl-2 pr-4 transition-colors hover:bg-accent"
  const inner = (
    <>
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/[0.12]">
        <Icon className="h-4 w-4 text-primary" />
      </span>
      <span className="text-[14px] font-semibold">{label}</span>
    </>
  )
  return href ? (
    <a href={href} className={cls}>{inner}</a>
  ) : (
    <button onClick={onClick} className={cls}>{inner}</button>
  )
}

/* ── EmptyState — illustration (or gold chip) + title + body + CTAs ────── */

export function EmptyState({
  illustration,
  icon: Icon,
  title,
  description,
  ctas = [],
  className,
}: {
  illustration?: IllustrationKey
  icon?: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  ctas?: { label: string; href: string; icon?: React.ComponentType<{ className?: string }> }[]
  className?: string
}) {
  return (
    <div className={cn("flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center", className)}>
      {illustration ? (
        // Never wrap an illustration in a circle or glow — it carries its own.
        <img
          src={illustrations[illustration]}
          alt=""
          className="h-28 w-28 object-contain"
          loading="lazy"
        />
      ) : Icon ? (
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/[0.12]">
          <Icon className="h-5 w-5 text-primary" />
        </span>
      ) : null}
      <div className="flex flex-col gap-1">
        <span className="text-[15px] font-semibold">{title}</span>
        {description && (
          <span className="mx-auto max-w-xs text-[13px] leading-relaxed text-muted-foreground">
            {description}
          </span>
        )}
      </div>
      {ctas.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {ctas.map((c) => (
            <a
              key={c.label}
              href={c.href}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 px-4 py-2 text-[13px] font-semibold text-primary transition-colors hover:bg-primary/10"
            >
              {c.icon && <c.icon className="h-3.5 w-3.5" />}
              {c.label}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── ListRow — gold rounded-square icon chip + title/subtitle + right ──── */

export function ListRow({
  icon: Icon,
  iconTone = "primary",
  title,
  subtitle,
  right,
  href,
  onClick,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>
  iconTone?: "primary" | "danger"
  title: string
  subtitle?: string
  right?: React.ReactNode
  href?: string
  onClick?: () => void
  className?: string
}) {
  const inner = (
    <>
      {Icon && (
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            iconTone === "danger" ? "bg-debit-chip" : "bg-primary/[0.12]",
          )}
        >
          <Icon className={cn("h-[18px] w-[18px]", iconTone === "danger" ? "text-debit" : "text-primary")} />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[14px] font-medium">{title}</span>
        {subtitle && <span className="truncate text-[12.5px] text-muted-foreground">{subtitle}</span>}
      </span>
      {right}
    </>
  )
  const cls = cn("flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40", className)
  if (href) return <a href={href} className={cls}>{inner}</a>
  if (onClick) return <button onClick={onClick} className={cls}>{inner}</button>
  return <div className={cls}>{inner}</div>
}

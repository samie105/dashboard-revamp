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
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"
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
  grow = false,
  className,
  vividPrefix,
}: {
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (key: T) => void
  /** md = the mobile 40px bar. sm = compact, for inside card headers. */
  size?: "sm" | "md"
  /** Fill the row: the track goes full-width and options split it evenly.
   *  For master tab bars (e.g. the money-flow modal's direction toggle). */
  grow?: boolean
  className?: string
  /** Registers each option with Vivid as `${prefix}-${key}` so the assistant
   *  can press tabs. Omit on controls Vivid has no business touching. */
  vividPrefix?: string
}) {
  const md = size === "md"
  const trackRef = React.useRef<HTMLDivElement>(null)
  const [thumb, setThumb] = React.useState<{ left: number; width: number } | null>(null)
  const [settled, setSettled] = React.useState(false)

  const measure = React.useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const btn = track.querySelector<HTMLElement>(`[data-seg-key="${CSS.escape(value)}"]`)
    if (!btn) return
    setThumb({ left: btn.offsetLeft, width: btn.offsetWidth })
  }, [value])

  React.useLayoutEffect(() => {
    measure()
  }, [measure, options.length, size, grow])

  // grow-bars resize with the viewport, and late font loads reflow labels.
  React.useEffect(() => {
    const track = trackRef.current
    if (!track || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(measure)
    ro.observe(track)
    return () => ro.disconnect()
  }, [measure])

  // The thumb must not slide on first paint — springs are for changes, not
  // arrivals. The transition switches on one frame after the first measure.
  React.useEffect(() => {
    if (!thumb || settled) return
    const id = requestAnimationFrame(() => setSettled(true))
    return () => cancelAnimationFrame(id)
  }, [thumb, settled])

  // Droplet: while the thumb travels it stretches like liquid and relaxes
  // as it lands — fired only on a value CHANGE, never on first paint.
  const [stretching, setStretching] = React.useState(false)
  const prevValue = React.useRef(value)
  React.useEffect(() => {
    if (prevValue.current === value) return
    prevValue.current = value
    if (!settled) return
    setStretching(true)
    const id = setTimeout(() => setStretching(false), 360)
    return () => clearTimeout(id)
  }, [value, settled])

  return (
    // The track is the SUNKEN step of the stone ladder and the thumb is the
    // RAISED one — two full steps apart, so the selection stays legible on a
    // card, on the page, and on top of the silk field. A translucent track
    // (foreground/6%) picked up whatever was behind it and the thumb vanished.
    // The thumb is ONE element that slides between options on a spring —
    // selection travels, it doesn't teleport.
    <div
      ref={trackRef}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full bg-surface-sunken",
        md ? "gap-1 p-1" : "gap-0.5 p-0.5",
        // flex-1 (basis 0) rather than a bare w-full: inside a flex row, 100%
        // would claim the whole line and squeeze out anything beside it.
        grow && "flex w-full min-w-0 flex-1",
        className,
      )}
    >
      {thumb && (
        <span
          aria-hidden
          className={cn(
            "absolute rounded-full bg-card shadow-sm ring-1 ring-foreground/[0.08] dark:bg-accent",
            md ? "inset-y-1" : "inset-y-0.5",
            settled &&
              "transition-[left,width] duration-[340ms] [transition-timing-function:cubic-bezier(0.3,1.4,0.4,1)] motion-reduce:transition-none",
            stretching && "ws-thumb-stretch",
          )}
          style={{ left: thumb.left, width: thumb.width }}
        />
      )}
      {options.map((opt) => {
        const active = value === opt.key
        const Icon = opt.icon
        return (
          <button
            key={opt.key}
            type="button"
            data-seg-key={opt.key}
            aria-pressed={active}
            {...(vividPrefix
              ? { "data-vivid-target": `${vividPrefix}-${opt.key}`, "data-vivid-label": `${opt.label} tab` }
              : {})}
            onClick={() => onChange(opt.key)}
            className={cn(
              "relative z-10 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              "active:scale-[0.96] motion-reduce:active:scale-100",
              md ? "px-3.5 py-2 text-[13px]" : "px-2.5 py-1 text-xs",
              grow && "flex-1 justify-center",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              // Before the first client measure (SSR, fonts still loading) the
              // active button paints its own fill so selection never vanishes.
              !thumb && active && "bg-card shadow-sm ring-1 ring-foreground/[0.08] dark:bg-accent",
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
          {/* Large-title scale — the iOS register: big, bold, tight. */}
          <h1 className="font-display text-[28px] font-bold leading-[1.15] tracking-[-0.02em]">{title}</h1>
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

/* ── CardShell — the dashboard card surface: translucent fill + a neutral
   corner-light ring (the hero account cards' gold ring, de-tinted — family
   resemblance without spending gold on a container). ─────────────────────── */

export function CardShell({ className, children, ...rest }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        // ws-card-glass: the iOS-26 clear grade — a LOW fill (45%) so the
        // silk field genuinely transmits through the pane, with the heavy
        // blur+saturate in ws-card-glass doing the legibility work. The
        // no-backdrop-filter fallback in globals re-solidifies the fill.
        "ws-card-glass relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl bg-card/45",
        // The lens: a lit bevel at the top edge, soft occlusion at the
        // bottom — what makes clear glass read as a pane, not a tint.
        "shadow-[inset_0_1px_0_rgb(255_255_255/0.07),inset_0_12px_24px_-20px_rgb(255_255_255/0.12),inset_0_-14px_26px_-22px_rgb(0_0_0/0.35)]",
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl p-px"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in oklab, var(--foreground) 14%, transparent), color-mix(in oklab, var(--foreground) 4%, transparent) 40%, transparent 65%)",
          WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          maskComposite: "exclude",
        }}
      />
      {children}
    </div>
  )
}

/* ── CardHeader — the in-card header idiom (no decorative icon) ────────── */

export function CardHeader({
  title,
  subtitle,
  badge,
  link,
  right,
  className,
}: {
  title: string
  subtitle?: string
  /** Small status chip rendered beside the title (e.g. "2 in flight"). */
  badge?: React.ReactNode
  link?: { label: string; href: string }
  right?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 px-4 py-3.5", className)}>
      <div className="flex min-w-0 flex-col">
        <span className="flex items-center gap-2.5">
          <h3 className="text-[15px] font-semibold leading-tight">{title}</h3>
          {badge}
        </span>
        {subtitle && <span className="text-[13px] text-muted-foreground">{subtitle}</span>}
      </div>
      {right}
      {link && (
        // Navigation stays muted — gold is for brand, primary CTA and active
        // state, never a "View all".
        <a
          href={link.href}
          className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {link.label}
          <HugeiconsIcon icon={ArrowRight01Icon} className="h-3.5 w-3.5" />
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
  ...rest
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  href?: string
  onClick?: () => void
} & Record<`data-${string}`, string>) {
  const cls =
    // Glass pill — same floating-surface dialect as the nav controls, with a
    // press squish so the rail feels like buttons rather than chips.
    "ws-card-glass flex shrink-0 items-center gap-2.5 rounded-full bg-card/55 py-2 pl-2 pr-4 ring-1 ring-border/40 transition-all hover:bg-accent/70 active:scale-[0.96] motion-reduce:active:scale-100"
  const inner = (
    <>
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/[0.12]">
        <Icon className="h-4 w-4 text-primary" />
      </span>
      <span className="text-[14px] font-semibold">{label}</span>
    </>
  )
  return href ? (
    <a href={href} className={cls} {...rest}>{inner}</a>
  ) : (
    <button onClick={onClick} className={cls} {...rest}>{inner}</button>
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

/* ── Skeletons — the shape of what's loading ───────────────────────────── */

/** One shimmering block. Neutral; never gold. */
export function Skel({ className }: { className?: string }) {
  return <span aria-hidden className={cn("skel block rounded-md", className)} />
}

/**
 * A list of rows in the ListRow shape: leading avatar, two stacked lines, a
 * right-aligned figure. Rows fade toward the bottom so the card reads as
 * continuing past the fold rather than stopping dead.
 *
 * `aria-busy` + a polite label so a screen reader is told the region is
 * loading instead of being read a wall of empty boxes.
 */
export function SkeletonRows({
  rows = 4,
  label = "Loading",
  className,
}: {
  rows?: number
  label?: string
  className?: string
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={cn("flex flex-1 flex-col divide-y divide-border/15", className)}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-3"
          style={{ opacity: 1 - i * (0.55 / Math.max(1, rows - 1)) }}
        >
          <Skel className="h-8 w-8 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skel className="h-3 w-24 max-w-[40%]" />
            <Skel className="h-2.5 w-16 max-w-[28%]" />
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Skel className="h-3 w-16" />
            <Skel className="h-2.5 w-10" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Rows of figures with no avatar — market tables and stat lists. */
export function SkeletonTable({
  rows = 5,
  cols = 3,
  label = "Loading",
  className,
}: {
  rows?: number
  cols?: number
  label?: string
  className?: string
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={cn("flex flex-1 flex-col divide-y divide-border/15", className)}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-3"
          style={{ opacity: 1 - i * (0.55 / Math.max(1, rows - 1)) }}
        >
          <Skel className="h-7 w-7 shrink-0 rounded-full" />
          <Skel className="h-3 w-20 max-w-[30%]" />
          <div className="flex flex-1 items-center justify-end gap-6">
            {Array.from({ length: Math.max(1, cols - 1) }).map((_, c) => (
              <Skel key={c} className="h-3 w-14" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Allocation palette ────────────────────────────────────────────────────
   A composition chart needs its slices told apart, and the system's rule is
   that gold means brand / primary CTA / active state — never a data colour.
   The escape is that this ramp isn't a *categorical* palette: nothing here
   says "SOL is gold". It's an ordinal ladder, gold at the top rung and
   walking down through amber, bronze and brown as the share shrinks, so the
   colour encodes RANK. Read it like a heat scale, not a key.

   One ladder, used by both the Assets donut and the Portfolio weight bars, so
   the two pages describe composition in the same voice. ─────────────────── */

export const ALLOCATION_RAMP = [
  "oklch(0.825 0.172 88)",   // 1st — brand gold
  "oklch(0.745 0.152 78)",   // 2nd — amber
  "oklch(0.660 0.128 68)",   // 3rd — deep amber
  "oklch(0.575 0.100 60)",   // 4th — bronze
  "oklch(0.490 0.072 55)",   // 5th — brown
  "oklch(0.410 0.048 50)",   // 6th — deep brown
] as const

/** Colour for rank `i`. Anything past the ladder (the "Other" bucket) settles
 *  into warm stone so it reads as a remainder rather than a holding. */
export function allocationColor(i: number) {
  return ALLOCATION_RAMP[i] ?? "oklch(0.330 0.020 48)"
}

/* ── Sparkline — a real series, or nothing ─────────────────────────────────
   The previous version took a 24h percentage and drew one of two hard-coded
   zig-zags from its SIGN. Every coin with the same direction got an identical
   curve, and when the price feed reported 0.00% across the board (Hyperliquid
   carries no 24h change) the whole watchlist drew the same flat green tick.
   A chart that isn't reading data is worse than no chart, so this one renders
   only when it's handed points, and says so by returning null when it isn't. */

export function Sparkline({
  points,
  width = 64,
  height = 24,
  className,
}: {
  points: number[] | undefined
  width?: number
  height?: number
  className?: string
}) {
  const id = React.useId()
  if (!points || points.length < 2) return null

  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  // A dead-flat series would otherwise pin to the top edge; centre it instead.
  const flat = max - min < Number.EPSILON
  const pad = 1.5
  const y = (v: number) =>
    flat ? height / 2 : height - pad - ((v - min) / span) * (height - pad * 2)
  const x = (i: number) => (i / (points.length - 1)) * width

  const line = points.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ")
  const up = points[points.length - 1] >= points[0]
  const stroke = up ? "var(--credit)" : "var(--debit)"

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      className={cn("shrink-0 overflow-visible", className)}
    >
      <defs>
        <linearGradient id={`sl-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${line} ${width},${height}`} fill={`url(#sl-${id})`} />
      <polyline
        points={line}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

/* ── WeightBar — one row's share of a whole ────────────────────────────────
   A number in a column tells you a holding's value; it takes arithmetic to
   learn whether that's most of the portfolio or a rounding error. The bar
   answers that at a glance, and shares the allocation ladder so a row's
   colour matches its slice in the donut on Assets. ───────────────────────── */

export function WeightBar({
  pct,
  rank = 0,
  className,
}: {
  pct: number
  rank?: number
  className?: string
}) {
  return (
    <span
      className={cn(
        "block h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.07]",
        className,
      )}
    >
      <span
        className="block h-full rounded-full transition-[width] duration-700 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: allocationColor(rank) }}
      />
    </span>
  )
}

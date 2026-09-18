/**
 * Small pieces every launchpad screen shares.
 *
 * No hooks and no "use client", so the server-rendered pages can use them
 * directly. Inline SVG rather than <HugeiconsIcon> for the same reason: that
 * component is a forwardRef with no client directive and cannot render in a
 * server component.
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import { CardShell } from "@/components/ui/system"
import { CARD_HUE } from "@/components/ui/surface"
import {
  PROVENANCE,
  STATUS_LABEL,
  type Launch,
  type LaunchStatus,
} from "@/components/launchpad-unauth/launch-data"

/* ── Avatar ─────────────────────────────────────────────────────────────── */

const AVATAR_SIZE = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-[12.5px]",
  lg: "h-14 w-14 text-[16px]",
} as const

/**
 * A launch's mark. The uploaded icon when there is one; otherwise the symbol's
 * first two letters on a hue seeded from the launch, so sixteen placeholders
 * are sixteen distinct marks rather than sixteen grey circles.
 */
export function LaunchAvatar({
  launch,
  size = "md",
  className,
}: {
  launch: Pick<Launch, "symbol" | "hue" | "iconUrl">
  size?: keyof typeof AVATAR_SIZE
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold tracking-[-0.02em] text-white ring-1 ring-white/10 ring-inset",
        AVATAR_SIZE[size],
        className
      )}
      style={
        launch.iconUrl
          ? undefined
          : {
              background: `linear-gradient(140deg, hsl(${launch.hue} 62% 46%), hsl(${(launch.hue + 40) % 360} 58% 28%))`,
            }
      }
    >
      {launch.iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={launch.iconUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        launch.symbol.slice(0, 2)
      )}
    </span>
  )
}

/* ── Status ─────────────────────────────────────────────────────────────── */

/**
 * Neutral for every state. Status is not money direction, so it does not get
 * credit/debit; and gold is brand, primary action and active state — a gold
 * "Graduated" chip would make one state look like the button to press.
 * Graduating gets the warning tone because it genuinely is an in-between
 * state worth noticing: the curve is full and the pool is not yet live.
 */
export function StatusPill({
  status,
  className,
}: {
  status: LaunchStatus
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        status === "graduating"
          ? "bg-warning-chip text-warning"
          : "bg-foreground/[0.07] text-muted-foreground",
        className
      )}
    >
      {status === "live" && (
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" />
      )}
      {status === "graduating" && (
        <span aria-hidden className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-60 motion-reduce:hidden" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-warning" />
        </span>
      )}
      {status === "graduated" && (
        <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3">
          <path
            d="M2.5 6.2 4.9 8.5 9.5 3.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {STATUS_LABEL[status]}
    </span>
  )
}

/* ── Progress ───────────────────────────────────────────────────────────── */

/**
 * Progress toward graduation. Gold, because it is the brand's one measure of
 * a launch's momentum and never a gain or a loss — green here would say
 * "you are up", which a curve filling is not, for the reader.
 */
export function ProgressBar({
  bps,
  className,
}: {
  bps: number
  className?: string
}) {
  const pct = Math.min(100, Math.max(0, bps / 100))
  return (
    <span
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label="Progress toward graduation"
      className={cn(
        "block h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.08]",
        className
      )}
    >
      <span
        className="block h-full rounded-full bg-primary/85"
        style={{ width: `${pct}%` }}
      />
    </span>
  )
}

/* ── Assumed marker ─────────────────────────────────────────────────────── */

/**
 * Marks a figure the preview invented. Deliberately quiet — it is for the
 * reviewer, and a loud badge on every fee would make the screen unreadable —
 * but always present, so an assumed number can never be mistaken for a
 * decided one during review.
 */
export function Assumed({ note }: { note: string }) {
  return (
    <span
      title={`Assumed in this preview — ${note}`}
      className="ml-1.5 inline-flex cursor-help items-center rounded border border-dashed border-foreground/25 px-1 text-[9.5px] leading-[1.5] font-semibold tracking-[0.06em] text-muted-foreground/80 uppercase"
    >
      est.
    </span>
  )
}

/* ── Manifest ───────────────────────────────────────────────────────────── */

/**
 * "Figures on this page", split into sourced and assumed.
 *
 * This is the provenance manifest made visible. It exists so that whoever
 * signs off a screen signs off knowing which of its numbers are decided and
 * which are placeholders — and so the assumed list can become the backend's
 * to-do list rather than something found after launch.
 */
export function ManifestCard({
  page,
}: {
  page: "discovery" | "token" | "create"
}) {
  const rows = PROVENANCE.filter((p) => p.pages.includes(page))
  const sourced = rows.filter((r) => r.kind === "sourced")
  const assumed = rows.filter((r) => r.kind === "assumed")

  return (
    <CardShell className={CARD_HUE}>
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-col gap-1">
          <span className="text-[14px] font-semibold">
            Figures on this page
          </span>
          <span className="text-[12.5px] leading-relaxed text-muted-foreground">
            For review. Sourced figures have a real home; assumed ones are
            placeholders that need a decision or a source before this screen can
            ship.
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ManifestList title={`Sourced · ${sourced.length}`} rows={sourced} />
          <ManifestList
            title={`Assumed · ${assumed.length}`}
            rows={assumed}
            dashed
          />
        </div>
      </div>
    </CardShell>
  )
}

function ManifestList({
  title,
  rows,
  dashed,
}: {
  title: string
  rows: typeof PROVENANCE
  dashed?: boolean
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-[10.5px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
        {title}
      </span>
      <ul className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <li
            key={r.figure}
            className={cn(
              "flex flex-col gap-0.5 rounded-xl px-3 py-2",
              dashed
                ? "border border-dashed border-foreground/15"
                : "bg-foreground/[0.04]"
            )}
          >
            <span className="text-[12.5px] font-medium">{r.figure}</span>
            <span className="text-[11.5px] leading-snug text-muted-foreground">
              {r.note}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

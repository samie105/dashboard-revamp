/**
 * The token page's panels: identity, progress, the creator's share, and the
 * launch's fixed terms.
 *
 * One rule across all of them: every figure comes from `viewOf`, the single
 * derivation in launch-data. The progress rail, the chart's marker and the
 * hero's price are three views of one number and cannot drift apart.
 */

import * as React from "react"
import Link from "next/link"
import { CardShell, CardHeader } from "@/components/ui/system"
import { CARD_HUE, HERO_HUE } from "@/components/ui/surface"
import { DetailPanel } from "@/components/ui/flow"
import { CopyAddress } from "@/components/launchpad-unauth/copy-address"
import {
  Assumed,
  LaunchAvatar,
  ProgressBar,
  StatusPill,
} from "@/components/launchpad-unauth/parts"
import {
  CURVE_SUPPLY,
  GRADUATION_SOL,
  RESERVE_SUPPLY,
  SOL_USD,
  TOTAL_SUPPLY,
  TRADE_FEE_BPS,
  ago,
  creatorAllocation,
  fmtPct,
  fmtSol,
  fmtTinyUsd,
  fmtTokens,
  fmtUsd,
  type LaunchView,
} from "@/components/launchpad-unauth/launch-data"
import { PREVIEW_ROUTES } from "@/components/preview/routes"

/* ── Hero ───────────────────────────────────────────────────────────────── */

export function TokenHero({ launch: v }: { launch: LaunchView }) {
  return (
    <CardShell className={HERO_HUE}>
      <div className="flex flex-col gap-6 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between lg:p-7">
        <div className="flex min-w-0 items-center gap-4">
          <LaunchAvatar launch={v} size="lg" />
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="truncate font-display text-[26px] leading-none font-semibold tracking-[-0.02em]">
                {v.name}
              </h1>
              <span className="text-[14px] font-semibold text-muted-foreground">
                ${v.symbol}
              </span>
              <StatusPill status={v.status} />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <CopyAddress label="Mint" value={v.mint} />
              <CopyAddress label="Creator" value={v.creator} />
              <span className="px-1 text-[11.5px] text-muted-foreground">
                Launched {ago(v.minutesAgo)}
              </span>
            </div>
          </div>
        </div>

        {/* The price, in dollars first: a per-token SOL price on a fresh curve
            is eight zeros long and communicates nothing. The SOL figure sits
            under it for anyone checking the arithmetic. */}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-border/40 sm:min-w-[20rem]">
          <div className="flex flex-col gap-1 bg-card/40 px-4 py-3">
            <span className="text-[10.5px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              Price
            </span>
            <span className="font-display text-[17px] leading-none font-medium tabular-nums sm:text-[21px]">
              {fmtTinyUsd(v.priceUsd)}
            </span>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {v.priceSol.toPrecision(3)} SOL
            </span>
          </div>
          <div className="flex flex-col gap-1 bg-card/40 px-4 py-3">
            <span className="text-[10.5px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              Market cap
            </span>
            <span className="font-display text-[17px] leading-none font-medium tabular-nums sm:text-[21px]">
              {fmtUsd(v.marketCapUsd)}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {fmtTokens(TOTAL_SUPPLY)} supply
            </span>
          </div>
        </div>
      </div>
    </CardShell>
  )
}

/* ── Progress ───────────────────────────────────────────────────────────── */

/**
 * Raised against threshold, with the remainder stated.
 *
 * No time estimate, on purpose. Nothing on chain says when a curve will
 * fill, and an ETA built from recent volume would be a guess that looks like
 * a promise — the manifest lists `timeToGraduation` as a figure to keep off
 * this screen. The SOL still needed is exact, and it is the more useful
 * number anyway.
 */
export function ProgressRail({ launch: v }: { launch: LaunchView }) {
  const closed = v.status !== "live"
  return (
    <CardShell className={CARD_HUE}>
      <CardHeader
        title="Progress to graduation"
        subtitle={
          v.status === "graduated"
            ? "The curve filled and liquidity was seeded"
            : v.status === "graduating"
              ? "Threshold reached — the pool is being created"
              : `${fmtSol(v.remainingSol, 2)} to go`
        }
      />
      <div className="flex flex-col gap-3 px-4 pb-4">
        <ProgressBar bps={v.progressBps} className="h-2.5" />
        <div className="grid grid-cols-3 gap-2">
          <Fact
            label="Raised"
            value={fmtSol(Math.min(v.solRaised, GRADUATION_SOL), 2)}
          />
          <Fact label="Threshold" value={fmtSol(GRADUATION_SOL, 0)} />
          <Fact label="Progress" value={fmtPct(v.progressBps)} align="end" />
        </div>
        {closed && (
          <Link
            href={PREVIEW_ROUTES.markets}
            className="inline-flex w-fit items-center gap-1.5 text-[12.5px] font-semibold text-primary transition-opacity hover:opacity-80"
          >
            {v.status === "graduated"
              ? "Trade it on the open market"
              : "It will trade on the open market once the pool is live"}
            <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3">
              <path
                d="M4.5 2.5 8 6l-3.5 3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        )}
      </div>
    </CardShell>
  )
}

function Fact({
  label,
  value,
  align,
}: {
  label: string
  value: string
  align?: "end"
}) {
  return (
    <span
      className={
        align === "end"
          ? "flex flex-col items-end gap-0.5 text-right"
          : "flex flex-col gap-0.5"
      }
    >
      <span className="text-[10.5px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </span>
      <span className="text-[13.5px] font-semibold tabular-nums">{value}</span>
    </span>
  )
}

/* ── The creator's share ────────────────────────────────────────────────── */

/**
 * How much of this token the creator took at launch, stated before anyone
 * buys.
 *
 * A creator who takes a large share at the floor price and sells into the
 * first buyers is the most common way a launch goes wrong, and the figure is
 * public on chain either way — so it is on the token page permanently, not a
 * click away. It is stated as a fact, in neutral colours: an 18% allocation
 * is not a loss and is not red.
 *
 * The bar is the whole supply, so the creator's slice is seen in proportion
 * to everything else rather than as a lone percentage.
 */
export function AllocationPanel({ launch: v }: { launch: LaunchView }) {
  const creator = creatorAllocation(v.creatorBps)
  const boughtByOthers = Math.max(0, v.tokensSold - creator.tokens)
  const stillOnCurve = Math.max(0, CURVE_SUPPLY - v.tokensSold)

  const segments = [
    {
      key: "creator",
      label: "Creator",
      tokens: creator.tokens,
      className: "bg-primary",
    },
    {
      key: "others",
      label: "Bought by others",
      tokens: boughtByOthers,
      className: "bg-primary/35",
    },
    {
      key: "curve",
      label: "Still on the curve",
      tokens: stillOnCurve,
      className: "bg-foreground/[0.12]",
    },
    {
      key: "reserve",
      label: "Liquidity reserve",
      tokens: RESERVE_SUPPLY,
      className:
        "bg-[repeating-linear-gradient(135deg,color-mix(in_oklab,var(--foreground)_22%,transparent)_0_3px,transparent_3px_6px)]",
    },
  ]

  return (
    <CardShell className={CARD_HUE}>
      <CardHeader
        title="Creator allocation"
        subtitle={
          v.creatorBps === 0
            ? "The creator took nothing at launch"
            : "Taken at launch, with no vesting"
        }
      />
      <div className="flex flex-col gap-3.5 px-4 pb-4">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-[26px] leading-none font-medium tabular-nums">
            {v.creatorBps === 0 ? "0%" : fmtPct(v.creatorBps)}
          </span>
          <span className="text-[12px] text-muted-foreground">
            of curve supply
          </span>
        </div>

        <div
          className="flex h-2.5 w-full gap-px overflow-hidden rounded-full"
          aria-hidden
        >
          {segments.map((s) =>
            s.tokens > 0 ? (
              <span
                key={s.key}
                className={s.className}
                style={{ width: `${(s.tokens / TOTAL_SUPPLY) * 100}%` }}
              />
            ) : null
          )}
        </div>
        <ul className="flex flex-col gap-1.5">
          {segments.map((s) => (
            <li key={s.key} className="flex items-center gap-2 text-[12px]">
              <span
                aria-hidden
                className={`h-2 w-2 shrink-0 rounded-sm ${s.className}`}
              />
              <span className="flex-1 text-muted-foreground">{s.label}</span>
              <span className="font-medium tabular-nums">
                {fmtTokens(s.tokens)}
              </span>
            </li>
          ))}
        </ul>

        {v.creatorBps > 0 && (
          <p className="rounded-xl bg-foreground/[0.04] px-3 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
            Bought off the same curve as everyone else, at the launch price, in
            the transaction that created the token — {fmtTokens(creator.tokens)}{" "}
            tokens for {fmtSol(creator.sol, 3)} ({fmtUsd(creator.sol * SOL_USD)}
            ). Nothing is locked, so it can be sold at any time.
          </p>
        )}
      </div>
    </CardShell>
  )
}

/* ── Terms ──────────────────────────────────────────────────────────────── */

export function TermsPanel({ launch: v }: { launch: LaunchView }) {
  return (
    <CardShell className={CARD_HUE}>
      <CardHeader
        title="Launch terms"
        subtitle="Fixed when the token was created"
      />
      <div className="px-4 pb-4">
        <DetailPanel
          rows={[
            { label: "Total supply", value: fmtTokens(TOTAL_SUPPLY) },
            { label: "Sold on the curve", value: fmtTokens(CURVE_SUPPLY) },
            { label: "Held for liquidity", value: fmtTokens(RESERVE_SUPPLY) },
            { label: "Graduates at", value: fmtSol(GRADUATION_SOL, 0) },
            {
              label: "Trading fee",
              value: (
                <span className="inline-flex items-center">
                  {fmtPct(TRADE_FEE_BPS)}
                  <Assumed note="the fee model is undecided (open question #3)" />
                </span>
              ),
            },
            {
              label: "Status",
              value:
                v.status === "live" ? "Tradable on the curve" : "Curve closed",
            },
          ]}
        />
      </div>
    </CardShell>
  )
}

/* ── About ──────────────────────────────────────────────────────────────── */

export function AboutPanel({ launch: v }: { launch: LaunchView }) {
  const links = [
    v.links.website && { label: "Website", href: v.links.website },
    v.links.x && { label: `@${v.links.x}`, href: `https://x.com/${v.links.x}` },
    v.links.telegram && {
      label: "Telegram",
      href: `https://t.me/${v.links.telegram}`,
    },
  ].filter(Boolean) as { label: string; href: string }[]

  return (
    <CardShell className={CARD_HUE}>
      <CardHeader
        title="About"
        subtitle="Written by the creator, not checked by us"
      />
      <div className="flex flex-col gap-3 px-4 pb-4">
        <p className="text-[13px] leading-relaxed text-foreground/85">
          {v.description}
        </p>
        {links.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.05] px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
              >
                {l.label}
                <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3">
                  <path
                    d="M4 3h5v5M9 3 3.5 8.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            ))}
          </div>
        )}
      </div>
    </CardShell>
  )
}

/* ── The ticket's place ─────────────────────────────────────────────────── */

/**
 * Where buy/sell will go. Stage 3.
 *
 * Holding the space rather than leaving a gap keeps the page's shape honest
 * during review: the layout being signed off here is the layout that will
 * carry a ticket, not a layout the ticket will later have to be squeezed into.
 */
export function TicketPlaceholder({ launch: v }: { launch: LaunchView }) {
  return (
    <CardShell className={CARD_HUE}>
      <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/[0.12] text-primary">
          <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4">
            <path
              d="M3 10.5 6.5 7l2.5 2.5L13 5.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="text-[14px] font-semibold">
          {v.status === "live"
            ? `Buy and sell ${v.symbol}`
            : `${v.symbol} has left the curve`}
        </span>
        <span className="max-w-xs text-[12.5px] leading-relaxed text-muted-foreground">
          {v.status === "live"
            ? "The curve ticket arrives in Stage 3 of the preview. It will quote off the curve itself, with slippage stated."
            : "Once a curve closes there is nothing to buy on it — trading moves to the open market."}
        </span>
      </div>
    </CardShell>
  )
}

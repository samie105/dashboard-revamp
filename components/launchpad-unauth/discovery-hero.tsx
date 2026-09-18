/**
 * The top of the discovery page.
 *
 * Left: what this is, in the three steps a launch actually goes through —
 * because "bonding curve" means nothing to most people who arrive here, and
 * "graduation" means less. Right: the live counts, and the one primary action.
 *
 * The chain row states availability per chain in the three states the plan
 * requires — live, paused with its reason, and "soon" for chains not built —
 * read live from the availability switch (Stage 5).
 */

import * as React from "react"
import { CardShell } from "@/components/ui/system"
import { HERO_HUE } from "@/components/ui/surface"
import {
  GRADUATION_SOL,
  LAUNCHES,
  RESERVE_SUPPLY,
  TOTAL_SUPPLY,
  fmtSol,
  viewOf,
} from "@/components/launchpad-unauth/launch-data"
import {
  ChainChips,
  LaunchCta,
} from "@/components/launchpad-unauth/availability-ui"

const STEPS = [
  {
    title: "Launch on a curve",
    body: "Your token starts on a bonding curve. The price rises as people buy and falls as they sell — no order book, no listing.",
  },
  {
    title: `Graduate at ${GRADUATION_SOL} SOL`,
    body: "When the curve has raised enough, it closes. Nobody decides when: the threshold does.",
  },
  {
    title: "Liquidity is seeded",
    body: `The raised SOL is paired with the ${Math.round((RESERVE_SUPPLY / TOTAL_SUPPLY) * 100)}% of supply held back for it, and the token trades on the open market.`,
  },
]

export function DiscoveryHero() {
  const views = LAUNCHES.map(viewOf)
  const live = views.filter((v) => v.status === "live")
  // Strictly "graduated", matching the grid's filter of the same name. This
  // counted `status !== "live"` and so included the one GRADUATING launch —
  // the hero said 3 while the filter a scroll below said 2.
  const graduated = views.filter((v) => v.status === "graduated").length
  const onCurves = live.reduce((sum, v) => sum + v.solRaised, 0)

  return (
    <CardShell className={HERO_HUE}>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* ── What this is ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-6 p-6 lg:p-8">
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold tracking-[0.12em] text-primary uppercase">
              Launchpad
            </span>
            <h1 className="font-display text-[clamp(1.75rem,3.4vw,2.5rem)] leading-[1.1] font-semibold tracking-[-0.02em]">
              Launch a token. Let the curve price it.
            </h1>
          </div>

          <ol className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex flex-col gap-1.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/[0.14] text-[11px] font-bold text-primary tabular-nums">
                  {i + 1}
                </span>
                <span className="text-[13.5px] leading-snug font-semibold">
                  {step.title}
                </span>
                <span className="text-[12.5px] leading-relaxed text-muted-foreground">
                  {step.body}
                </span>
              </li>
            ))}
          </ol>

          {/* Live from the availability switch — see availability.ts. A
              paused chain reads differently from an unbuilt one. */}
          <ChainChips />
        </div>

        {/* ── The counts, and the one action ─────────────────────────── */}
        <div className="flex flex-col justify-between gap-5 border-t border-border/40 p-6 lg:border-t-0 lg:border-l lg:p-8">
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl bg-border/40 lg:grid-cols-1">
            <Count label="On a curve now" value={String(live.length)} />
            <Count label="Graduated" value={String(graduated)} />
            <Count
              label="SOL on live curves"
              value={fmtSol(onCurves, 1).replace(" SOL", "")}
              unit="SOL"
            />
          </div>

          <LaunchCta />
        </div>
      </div>
    </CardShell>
  )
}

function Count({
  label,
  value,
  unit,
}: {
  label: string
  value: string
  unit?: string
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 bg-card/40 px-4 py-3.5">
      <span className="truncate text-[10.5px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </span>
      {/* flex-wrap: in the phone's three-across row the cell is ~110px, and
          "447.1 SOL" at display size is wider than that. The unit drops under
          the figure rather than running out of the cell. */}
      <span className="flex flex-wrap items-baseline gap-x-1">
        <span className="font-display text-[19px] leading-none font-medium tabular-nums sm:text-[22px]">
          {value}
        </span>
        {unit && (
          <span className="text-[12px] text-muted-foreground">{unit}</span>
        )}
      </span>
    </div>
  )
}

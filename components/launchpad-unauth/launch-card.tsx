/**
 * One launch in the discovery grid — and, unchanged, the live preview on the
 * create form.
 *
 * That second use is the reason it takes a plain `Launch` and derives its own
 * figures through `viewOf`: the create form hands it a draft, and the card a
 * creator sees while typing is the card buyers will see, byte for byte. A
 * separate "preview card" would drift from the real one within a week.
 *
 * What it deliberately does NOT show: a price sparkline, a 24h change, a
 * holder count. All three need a trade index that does not exist, and each is
 * listed in launch-data's manifest as a figure to keep off this screen.
 * Progress toward graduation is the headline because it is the one measure of
 * momentum the chain actually supplies.
 */

import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { CardShell } from "@/components/ui/system"
import { CARD_HUE } from "@/components/ui/surface"
import {
  GRADUATION_SOL,
  ago,
  fmtPct,
  fmtUsd,
  viewOf,
  type Launch,
} from "@/components/launchpad-unauth/launch-data"
import {
  LaunchAvatar,
  ProgressBar,
  StatusPill,
} from "@/components/launchpad-unauth/parts"

export function LaunchCard({
  launch,
  href,
}: {
  launch: Launch
  href?: string
}) {
  const v = viewOf(launch)
  const graduated = v.status !== "live"

  const body = (
    <CardShell
      className={cn(
        CARD_HUE,
        "h-full transition-[transform,box-shadow] duration-200",
        href &&
          "group-hover:-translate-y-0.5 group-hover:shadow-[0_18px_40px_-24px_rgb(0_0_0/0.8)] motion-reduce:group-hover:translate-y-0"
      )}
    >
      <div className="flex h-full flex-col gap-3.5 p-4">
        <div className="flex items-start gap-3">
          <LaunchAvatar launch={v} />
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate text-[14.5px] font-semibold">
              {v.name}
            </span>
            <span className="truncate text-[12px] font-medium text-muted-foreground">
              ${v.symbol}
            </span>
          </span>
          <StatusPill status={v.status} />
        </div>

        <p className="line-clamp-2 min-h-[2.6em] text-[12.5px] leading-[1.3] text-muted-foreground">
          {v.description}
        </p>

        <div className="flex flex-col gap-1.5">
          <ProgressBar bps={v.progressBps} />
          <span className="flex items-baseline justify-between gap-2 text-[11.5px] tabular-nums">
            <span className="font-semibold text-foreground">
              {fmtPct(v.progressBps)}
            </span>
            <span className="text-muted-foreground">
              {graduated
                ? `${GRADUATION_SOL} SOL raised`
                : `${v.solRaised.toLocaleString("en-US", { maximumFractionDigits: 1 })} / ${GRADUATION_SOL} SOL`}
            </span>
          </span>
        </div>

        {/* The footer is three facts about the launch, with the creator's cut
            in the middle of them rather than hidden behind a click. */}
        <div className="mt-auto grid grid-cols-3 gap-2 border-t border-border/40 pt-3">
          <Fact label="Mkt cap" value={fmtUsd(v.marketCapUsd)} />
          <Fact
            label="Creator"
            value={v.creatorBps === 0 ? "None" : fmtPct(v.creatorBps)}
          />
          <Fact
            label="Launched"
            value={v.minutesAgo === 0 ? "Not yet" : ago(v.minutesAgo)}
            align="end"
          />
        </div>
      </div>
    </CardShell>
  )

  if (!href) return body
  return (
    <Link
      href={href}
      className="group block h-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      {body}
    </Link>
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
      className={cn(
        "flex min-w-0 flex-col gap-0.5",
        align === "end" && "items-end text-right"
      )}
    >
      <span className="text-[10px] font-semibold tracking-[0.08em] text-muted-foreground/80 uppercase">
        {label}
      </span>
      <span className="truncate text-[12.5px] font-semibold tabular-nums">
        {value}
      </span>
    </span>
  )
}

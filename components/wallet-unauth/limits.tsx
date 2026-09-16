"use client"

/**
 * Withdrawal limits and security posture.
 *
 * Lives beside the movement history because the two answer the same worry from
 * opposite ends: "why did that withdrawal not go through?" is either a limit
 * or a missing security step, and both are here.
 *
 * (The standalone deposit-address card that used to sit here is gone — the
 * wallet hero's chain picker shows the address for whichever chain you are
 * actually looking at, which is strictly more useful than a static list.)
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Tick02Icon, Cancel01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { CardShell, CardHeader, Eyebrow } from "@/components/ui/system"
import { CARD_HUE } from "@/components/preview/surface"
import { ScoreRing } from "@/components/preview/charts"
import { SECURITY_FLAGS, WITHDRAWAL_LIMIT, formatUSD } from "@/components/wallet-unauth/wallet-data"

export function Limits() {
  const pct = (WITHDRAWAL_LIMIT.used / WITHDRAWAL_LIMIT.total) * 100
  const done = SECURITY_FLAGS.filter((f) => f.done).length
  const score = Math.round((done / SECURITY_FLAGS.length) * 100)

  return (
    <CardShell className={CARD_HUE}>
      <CardHeader title="Limits & security" subtitle="What this wallet may move" link={{ label: "Manage", href: "#" }} />
      <div className="flex flex-1 flex-col gap-5 px-4 pb-4">
        <div className="flex flex-col gap-2">
          <Eyebrow className="text-[11px]">24h withdrawal limit</Eyebrow>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-display text-[24px] font-light tabular-nums">
              {formatUSD(WITHDRAWAL_LIMIT.total - WITHDRAWAL_LIMIT.used, { maxFrac: 0 })}
            </span>
            <span className="text-[12.5px] text-muted-foreground">remaining</span>
          </div>
          <span className="block h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.07]">
            <span
              className="block h-full rounded-full bg-primary/70"
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </span>
          <span className="text-[11.5px] tabular-nums text-muted-foreground">
            {formatUSD(WITHDRAWAL_LIMIT.used, { maxFrac: 0 })} of{" "}
            {formatUSD(WITHDRAWAL_LIMIT.total, { maxFrac: 0 })} used · resets in 9h
          </span>
        </div>

        <div className="flex items-center gap-3">
          <ScoreRing score={score} />
          <div className="flex min-w-0 flex-col">
            <span className="text-[14px] font-semibold">
              {score === 100 ? "Fully hardened" : "One step left"}
            </span>
            <span className="text-[12.5px] text-muted-foreground">
              Verify a whitelist to raise your limit
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          {SECURITY_FLAGS.map((f) => (
            <span key={f.label} className="flex items-center gap-2 text-[12.5px]">
              <span
                // The glyph's colour IS the state, so it opts out of the
                // global two-tone gold treatment.
                className={cn(
                  "ws-icon-mono flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                  f.done ? "bg-foreground/[0.08] text-muted-foreground" : "bg-warning-chip text-warning",
                )}
              >
                <HugeiconsIcon icon={f.done ? Tick02Icon : Cancel01Icon} className="h-2.5 w-2.5" />
              </span>
              <span className={cn("truncate", f.done ? "text-muted-foreground" : "font-medium")}>
                {f.label}
              </span>
              {!f.done && (
                <HugeiconsIcon icon={ArrowRight01Icon} className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
              )}
            </span>
          ))}
        </div>
      </div>
    </CardShell>
  )
}

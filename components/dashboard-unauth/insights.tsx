"use client"

/**
 * Insights — the four "how are things?" readouts. Each answers one question
 * with one figure, so the row scans as a strip rather than four more tables.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Tick02Icon, Cancel01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { CardShell, CardHeader, WeightBar } from "@/components/ui/system"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { CARD_HUE } from "@/components/preview/surface"
import { MiniSpark, MoodGauge, ScoreRing, VolumeBars } from "@/components/preview/charts"
import {
  HOLDINGS,
  HOLDINGS_TOTAL,
  MARKET_MOOD,
  SECURITY_CHECKS,
  SECURITY_SCORE,
  VOLUME_MONTHS,
  formatUSD,
  formatAmount,
} from "@/components/dashboard-unauth/demo-data"

export function Insights() {
  const top = HOLDINGS[0]
  const topShare = (top.value / HOLDINGS_TOTAL) * 100
  const volumeTotal = VOLUME_MONTHS[VOLUME_MONTHS.length - 1].value
  const volumePrev = VOLUME_MONTHS[VOLUME_MONTHS.length - 2].value
  const volumeDelta = ((volumeTotal - volumePrev) / volumePrev) * 100

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {/* ── Top holding ─────────────────────────────────────────────────── */}
      <CardShell className={CARD_HUE}>
        <CardHeader title="Top holding" subtitle="Largest single position" />
        <div className="flex flex-1 flex-col justify-between gap-4 px-4 pb-4">
          <div className="flex items-center gap-3">
            <CoinAvatar symbol={top.symbol} size="lg" />
            <div className="flex min-w-0 flex-col">
              <span className="text-[15px] font-semibold">{top.name}</span>
              <span className="text-[12.5px] tabular-nums text-muted-foreground">
                {formatAmount(top.amount)} {top.symbol}
              </span>
            </div>
            <MiniSpark points={top.points} tone="brand" width={52} height={22} className="ml-auto" />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-display text-[26px] font-light tabular-nums">{formatUSD(top.value)}</span>
              <span
                className={cn(
                  "text-[13px] font-medium tabular-nums",
                  top.changePct >= 0 ? "text-credit" : "text-debit",
                )}
              >
                {top.changePct >= 0 ? "+" : ""}
                {top.changePct.toFixed(2)}%
              </span>
            </div>
            <WeightBar pct={topShare} rank={0} />
            <span className="text-[12px] text-muted-foreground">
              {topShare.toFixed(1)}% of your portfolio
            </span>
          </div>
        </div>
      </CardShell>

      {/* ── Market mood ─────────────────────────────────────────────────── */}
      <CardShell className={CARD_HUE}>
        <CardHeader title="Market mood" subtitle="Fear &amp; Greed index" />
        <div className="flex flex-1 flex-col items-center justify-between gap-3 px-4 pb-4">
          <MoodGauge score={MARKET_MOOD.score} />
          <span className="rounded-full bg-convert-chip px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-primary">
            {MARKET_MOOD.label}
          </span>
          <span className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground/70">
            Source · {MARKET_MOOD.source}
          </span>
        </div>
      </CardShell>

      {/* ── Traded volume ───────────────────────────────────────────────── */}
      <CardShell className={CARD_HUE}>
        <CardHeader title="Traded volume" subtitle="Last five months" />
        <div className="flex flex-1 flex-col gap-3 px-4 pb-4">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[26px] font-light tabular-nums">
              {formatUSD(volumeTotal, { compact: true })}
            </span>
            <span
              className={cn(
                "text-[13px] font-medium tabular-nums",
                volumeDelta >= 0 ? "text-credit" : "text-debit",
              )}
            >
              {volumeDelta >= 0 ? "+" : ""}
              {volumeDelta.toFixed(0)}%
            </span>
          </div>
          {/* A definite height — the bars size themselves as a percentage of it. */}
          <div className="h-[104px]">
            <VolumeBars data={VOLUME_MONTHS} format={(v) => formatUSD(v, { compact: true })} />
          </div>
        </div>
      </CardShell>

      {/* ── Security ────────────────────────────────────────────────────── */}
      <CardShell className={CARD_HUE}>
        <CardHeader title="Security" subtitle="Account hardening" link={{ label: "Manage", href: "#" }} />
        <div className="flex flex-1 flex-col gap-3 px-4 pb-4">
          <div className="flex items-center gap-3">
            <ScoreRing score={SECURITY_SCORE} />
            <div className="flex min-w-0 flex-col">
              <span className="text-[14px] font-semibold">
                {SECURITY_SCORE === 100 ? "Fully hardened" : "Almost there"}
              </span>
              <span className="text-[12.5px] text-muted-foreground">
                {SECURITY_CHECKS.filter((c) => !c.done).length} step left
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            {SECURITY_CHECKS.map((c) => (
              <span key={c.label} className="flex items-center gap-2 text-[12.5px]">
                <span
                  // ws-icon-mono: the glyph's COLOUR is the state here, so it
                  // opts out of the global two-tone gold treatment.
                  className={cn(
                    "ws-icon-mono flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                    c.done ? "bg-foreground/[0.08] text-muted-foreground" : "bg-warning-chip text-warning",
                  )}
                >
                  <HugeiconsIcon icon={c.done ? Tick02Icon : Cancel01Icon} className="h-2.5 w-2.5" />
                </span>
                <span className={cn("truncate", c.done ? "text-muted-foreground" : "font-medium")}>{c.label}</span>
                {!c.done && (
                  <HugeiconsIcon icon={ArrowRight01Icon} className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                )}
              </span>
            ))}
          </div>
        </div>
      </CardShell>
    </div>
  )
}

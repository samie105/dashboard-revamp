"use client"

/**
 * Top movers — Gainers, Losers, Hot.
 *
 * The thing a markets page is for is "what should I look at", and a 30-row
 * table sorted by market cap answers "what is biggest", which is a different
 * question and never changes. Three ranked five-row lists answer it in the
 * space the live page currently spends on four cards reading "—".
 *
 * Every row is a link to the trading screen. On the live page the equivalent
 * column says "Not listed" for a third of its rows.
 */

import * as React from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { ChartUpIcon, ChartDownIcon, FireIcon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { CardShell, CardHeader } from "@/components/ui/system"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { CARD_HUE } from "@/components/preview/surface"
import { MiniSpark } from "@/components/preview/charts"
import {
  GAINERS,
  HOT,
  LOSERS,
  formatCompact,
  formatPrice,
  tradeHref,
  type Market,
} from "@/components/markets-unauth/market-data"

function MoverRow({ m, index, showHeat }: { m: Market; index: number; showHeat?: boolean }) {
  const up = m.changePct >= 0
  return (
    <Link
      href={tradeHref(m)}
      className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/40"
    >
      <span className="w-4 shrink-0 text-[11.5px] font-semibold tabular-nums text-muted-foreground/60">
        {String(index + 1).padStart(2, "0")}
      </span>
      <CoinAvatar symbol={m.base} size="md" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-baseline gap-1 truncate">
          <span className="text-[13px] font-semibold leading-tight">{m.base}</span>
          <span className="text-[10.5px] leading-tight text-muted-foreground">/{m.quote}</span>
        </span>
        <span className="truncate text-[11px] leading-tight text-muted-foreground">
          {showHeat ? `Vol ${formatCompact(m.volumeUsd)}` : m.name}
        </span>
      </span>
      {/* The curve is tone="direction" — it reads the SERIES, which is the
          whole fix for the live page drawing every chart red. */}
      <MiniSpark points={m.series} tone="direction" width={48} height={20} />
      <span className="flex shrink-0 flex-col items-end">
        <span className="whitespace-nowrap text-[12.5px] font-medium tabular-nums">
          {formatPrice(m.price)}
        </span>
        <span
          className={cn(
            "whitespace-nowrap text-[11.5px] font-semibold tabular-nums",
            up ? "text-credit" : "text-debit",
          )}
        >
          {up ? "+" : ""}
          {m.changePct.toFixed(2)}%
        </span>
      </span>
    </Link>
  )
}

function MoverCard({
  title,
  subtitle,
  icon,
  tone,
  rows,
  showHeat,
}: {
  title: string
  subtitle: string
  icon: typeof ChartUpIcon
  tone: "credit" | "debit" | "primary"
  rows: Market[]
  showHeat?: boolean
}) {
  return (
    <CardShell className={CARD_HUE}>
      <CardHeader
        title={title}
        subtitle={subtitle}
        right={
          <span
            // The glyph's colour carries the list's meaning, so it opts out of
            // the global two-tone gold treatment.
            className={cn(
              "ws-icon-mono flex h-7 w-7 items-center justify-center rounded-full",
              tone === "credit" && "bg-credit-chip text-credit",
              tone === "debit" && "bg-debit-chip text-debit",
              tone === "primary" && "bg-convert-chip text-primary",
            )}
          >
            <HugeiconsIcon icon={icon} className="h-4 w-4" />
          </span>
        }
      />
      <div className="flex flex-1 flex-col divide-y divide-border/25 pb-1">
        {rows.map((m, i) => (
          <MoverRow key={m.id} m={m} index={i} showHeat={showHeat} />
        ))}
      </div>
    </CardShell>
  )
}

export function Movers() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <MoverCard
        title="Gainers"
        subtitle="Biggest 7d moves up"
        icon={ChartUpIcon}
        tone="credit"
        rows={GAINERS}
      />
      <MoverCard
        title="Losers"
        subtitle="Biggest 7d moves down"
        icon={ChartDownIcon}
        tone="debit"
        rows={LOSERS}
      />
      <MoverCard
        title="Hot"
        subtitle="Most traded right now"
        icon={FireIcon}
        tone="primary"
        rows={HOT}
        showHeat
      />
    </div>
  )
}

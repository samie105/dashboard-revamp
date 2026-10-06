"use client"

/**
 * The top of the markets page: the heading, the tape, and five stat cards
 * that say what kind of day the market is having before you read a row.
 *
 * Every figure is read off market-data.ts, which derives its totals from the
 * rows below — so the header cannot disagree with the table.
 */

import * as React from "react"
import Link from "next/link"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import {
  CAP_SERIES,
  DOMINANCE_SPLIT,
  SENTIMENT,
  STATS,
  TICKER,
  VOLUME_DAYS,
  formatPrice,
  formatUSD,
  tradeHref,
  type Market,
} from "@/components/markets-unauth/market-data"
import { Panel, Spark } from "@/components/redesign/ui"

/* ── Heading ──────────────────────────────────────────────────────────── */

export function MarketsHeading() {
  return (
    <div className="flex flex-col gap-1.5 px-1">
      <div className="flex items-center gap-2.5">
        <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.03em] text-foreground md:text-[32px]">
          Markets
        </h1>
        <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/80">
          Demo data
        </span>
      </div>
      <p className="text-[14px] text-muted-foreground">
        {STATS.listed} pairs across {STATS.assets} assets. Prices, charts and volumes below are invented and frozen.
      </p>
    </div>
  )
}

/* ── Tape ─────────────────────────────────────────────────────────────── */

function TapeItem({ m }: { m: Market }) {
  const up = m.changePct >= 0
  return (
    <Link
      href={tradeHref(m)}
      className="flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2 transition-colors hover:bg-white/[0.04]"
    >
      <CoinAvatar symbol={m.base} size="md" className="ring-1 ring-white/10" />
      <span className="text-[13px] font-semibold text-foreground">
        {m.base}
        {m.quote !== "USDT" && <span className="font-medium text-muted-foreground">/{m.quote}</span>}
      </span>
      <span className="text-[13px] font-medium tabular-nums text-foreground/80">{formatPrice(m.price)}</span>
      <span className={cn("text-[12.5px] font-semibold tabular-nums", up ? "text-credit" : "text-debit")}>
        {up ? "+" : "−"}
        {Math.abs(m.changePct).toFixed(2)}%
      </span>
    </Link>
  )
}

export function Tape() {
  return (
    <Panel className="dash-fade-x py-2" aria-label="Most traded pairs">
      <div className="dash-marquee flex w-max">
        {/* Two copies, the second hidden from assistive tech — the loop needs
            it, a screen reader does not need every pair read twice. */}
        {[0, 1].map((copy) => (
          <div key={copy} className="flex items-center gap-1 pr-1" aria-hidden={copy === 1 || undefined}>
            {TICKER.map((m) => (
              <TapeItem key={`${copy}-${m.id}`} m={m} />
            ))}
          </div>
        ))}
      </div>
    </Panel>
  )
}

/* ── Stat cards ───────────────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  aside,
  className,
  children,
}: {
  label: string
  value: React.ReactNode
  aside?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <Panel as="article" className={cn("dash-lift flex min-w-0 flex-col justify-between gap-4 p-4 sm:p-5", className)}>
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-display text-[20px] font-semibold leading-none sm:text-[23px] tracking-[-0.03em] tabular-nums text-foreground">
            {value}
          </span>
          {aside}
        </span>
      </div>
      <div className="min-h-[34px]">{children}</div>
    </Panel>
  )
}

const EASE = [0.22, 1, 0.36, 1] as const

export function MarketStats() {
  const volMax = Math.max(...VOLUME_DAYS)
  const capUp = STATS.marketCapChangePct >= 0
  const breadth = STATS.advancing / (STATS.advancing + STATS.declining)

  return (
    // Two up on a phone with the cap curve spanning the top row; six tracks
    // from lg so 5 cards land as 2 + 3 without a ragged hole; five across
    // once there is room.
    <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-6 2xl:grid-cols-5">
      <StatCard
        className="col-span-2 lg:col-span-3 2xl:col-span-1"
        label="Market cap"
        value={formatUSD(STATS.marketCapUsd, { compact: true })}
        aside={
          <span className={cn("text-[13px] font-semibold tabular-nums", capUp ? "text-credit" : "text-debit")}>
            {capUp ? "+" : "−"}
            {Math.abs(STATS.marketCapChangePct).toFixed(2)}%
          </span>
        }
      >
        <Spark points={CAP_SERIES} width={240} height={34} fluid />
      </StatCard>

      <StatCard className="lg:col-span-3 2xl:col-span-1" label="24h volume" value={formatUSD(STATS.volumeUsd, { compact: true })} aside={<span className="text-[12.5px] font-medium text-muted-foreground">7 days</span>}>
        <div className="flex h-[34px] items-end gap-1.5">
          {VOLUME_DAYS.map((v, i) => (
            <motion.span
              key={i}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: v / volMax }}
              transition={{ duration: 0.8, delay: 0.2 + i * 0.05, ease: EASE }}
              className={cn(
                "h-full flex-1 origin-bottom rounded-[4px]",
                i === VOLUME_DAYS.length - 1 ? "bg-gradient-to-t from-primary/70 to-primary shadow-[0_0_12px_rgb(250_204_21/0.35)]" : "bg-white/[0.09]",
              )}
            />
          ))}
        </div>
      </StatCard>

      <StatCard className="lg:col-span-2 2xl:col-span-1" label="BTC dominance" value={`${STATS.btcDominancePct.toFixed(1)}%`}>
        <div className="flex flex-col gap-2.5">
          <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
            {DOMINANCE_SPLIT.map((d, i) => (
              <motion.span
                key={d.label}
                initial={{ width: 0 }}
                animate={{ width: `${d.pct}%` }}
                transition={{ duration: 0.9, delay: 0.25 + i * 0.08, ease: EASE }}
                className={cn("h-full", i === 0 ? "bg-primary" : i === 1 ? "bg-primary/45" : "bg-white/15")}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] font-medium text-muted-foreground">
            {DOMINANCE_SPLIT.map((d, i) => (
              <span key={d.label} className="flex items-center gap-1.5">
                <span className={cn("size-1.5 rounded-full", i === 0 ? "bg-primary" : i === 1 ? "bg-primary/45" : "bg-white/30")} />
                {d.label} <span className="tabular-nums text-foreground/70">{d.pct.toFixed(0)}%</span>
              </span>
            ))}
          </div>
        </div>
      </StatCard>

      <StatCard
        className="lg:col-span-2 2xl:col-span-1"
        label="Fear & Greed"
        value={SENTIMENT.score}
        aside={<span className="rounded-md bg-credit/[0.13] px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.05em] text-credit">{SENTIMENT.label}</span>}
      >
        <div className="flex flex-col gap-2">
          <div className="relative h-2 rounded-full bg-[linear-gradient(90deg,var(--debit),var(--warning)_50%,var(--credit))]">
            <motion.span
              initial={{ left: "0%", opacity: 0 }}
              animate={{ left: `${SENTIMENT.score}%`, opacity: 1 }}
              transition={{ duration: 1.1, delay: 0.3, ease: EASE }}
              className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[#0f0f0f] bg-foreground shadow-[0_0_0_1px_rgb(255_255_255/0.2)]"
            />
          </div>
          <div className="flex justify-between text-[11.5px] font-medium text-muted-foreground">
            <span>Fear</span>
            <span>Greed</span>
          </div>
        </div>
      </StatCard>

      <StatCard
        className="lg:col-span-2 2xl:col-span-1"
        label="Breadth"
        value={
          <>
            <span className="text-credit">{STATS.advancing}</span>
            <span className="mx-1 text-[15px] font-medium text-muted-foreground">up</span>
            <span className="text-debit">{STATS.declining}</span>
            <span className="ml-1 text-[15px] font-medium text-muted-foreground">down</span>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
            <motion.span
              initial={{ width: 0 }}
              animate={{ width: `${breadth * 100}%` }}
              transition={{ duration: 0.9, delay: 0.3, ease: EASE }}
              className="h-full rounded-l-full bg-credit"
            />
            <span className="h-full flex-1 rounded-r-full bg-debit/80" />
          </div>
          <span className="text-[11.5px] font-medium text-muted-foreground">
            <span className="tabular-nums text-foreground/70">{Math.round(breadth * 100)}%</span> of pairs advancing
          </span>
        </div>
      </StatCard>
    </div>
  )
}

"use client"

/**
 * This month at a glance — five cards, every figure summed from the ledger
 * below (tx-data.ts), so the header cannot disagree with the list.
 *
 * The Net card carries the one chart: fourteen days of net flow, green above
 * the line and red below, so "was this a good month for my balance" is
 * answered by shape before anyone reads a number.
 */

import * as React from "react"
import { motion } from "motion/react"
import {
  ArrowDownLeft01Icon,
  ArrowUpRight01Icon,
  ArrowLeftRightIcon,
  CoinsDollarIcon,
  Exchange01Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { NET_USD, SUMMARY, TRANSACTIONS, formatUSD, usdOf } from "@/components/transactions-unauth/tx-data"
import { Figure, Icon, Panel, type IconSvg } from "@/components/redesign/ui"

/** Net flow per day for the last 14 days — settled deposits minus settled
 *  withdrawals. Oldest first. */
const NET_DAYS = Array.from({ length: 14 }, (_, i) => {
  const day = 13 - i
  return TRANSACTIONS.filter((t) => t.dayOffset === day && t.status === "completed").reduce((s, t) => {
    if (t.kind === "deposit") return s + usdOf(t.asset, t.amount)
    if (t.kind === "withdrawal") return s - usdOf(t.asset, t.amount)
    return s
  }, 0)
})
const NET_MAX = Math.max(...NET_DAYS.map(Math.abs), 1)

function Card({
  label,
  icon,
  tone,
  value,
  sub,
  className,
  children,
}: {
  label: string
  icon: IconSvg
  tone: string
  value: React.ReactNode
  sub: React.ReactNode
  className?: string
  children?: React.ReactNode
}) {
  return (
    <Panel as="article" className={cn("dash-lift flex min-w-0 flex-col gap-4 p-4 sm:p-5", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
        <span className={cn("flex size-8 items-center justify-center rounded-[10px] border", tone)}>
          <Icon icon={icon} className="size-4" />
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="truncate font-display text-[20px] font-semibold leading-none tracking-[-0.03em] tabular-nums sm:text-[23px]">{value}</span>
        <span className="truncate text-[12px] text-muted-foreground">{sub}</span>
      </div>
      {children}
    </Panel>
  )
}

export function Summary() {
  const netUp = NET_USD >= 0
  return (
    // Two up on a phone with Net spanning the top row (it carries the chart);
    // six tracks from lg so 5 cards land as 2 + 3; five across once there's room.
    <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-6 2xl:grid-cols-5">
      <Card
        className="col-span-2 lg:col-span-3 2xl:order-3 2xl:col-span-1"
        label="Net flow"
        icon={ArrowLeftRightIcon}
        tone="border-primary/25 bg-primary/[0.08] text-primary"
        value={
          <span className={netUp ? "text-credit" : "text-debit"}>
            <Figure>{`${netUp ? "+" : "−"}${formatUSD(Math.abs(NET_USD))}`}</Figure>
          </span>
        }
        sub="Money in minus money out"
      >
        {/* Centre-baseline bars: up days rise, down days hang. */}
        <div className="relative flex h-9 items-center gap-[3px]" aria-label="Net flow, last 14 days">
          <span aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-white/[0.08]" />
          {NET_DAYS.map((v, i) => {
            const h = Math.max((Math.abs(v) / NET_MAX) * 50, v === 0 ? 0 : 6)
            return (
              <span key={i} className="relative flex h-full flex-1 flex-col justify-center">
                <motion.span
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.7, delay: 0.2 + i * 0.03, ease: [0.22, 1, 0.36, 1] }}
                  className={cn(
                    "absolute inset-x-0 rounded-[2px]",
                    v > 0 ? "bottom-1/2 origin-bottom bg-credit/80" : v < 0 ? "top-1/2 origin-top bg-debit/80" : "top-1/2 h-px bg-white/15",
                  )}
                  style={v !== 0 ? { height: `${h}%` } : undefined}
                />
              </span>
            )
          })}
        </div>
      </Card>
      <Card
        className="lg:col-span-3 2xl:order-1 2xl:col-span-1"
        label="Money in"
        icon={ArrowDownLeft01Icon}
        tone="border-credit/25 bg-credit/[0.08] text-credit"
        value={<span className="text-credit"><Figure>{formatUSD(SUMMARY.inUsd)}</Figure></span>}
        sub={`${SUMMARY.inCount} deposits settled`}
      />
      <Card
        className="lg:col-span-2 2xl:order-2 2xl:col-span-1"
        label="Money out"
        icon={ArrowUpRight01Icon}
        tone="border-debit/25 bg-debit/[0.08] text-debit"
        value={<Figure>{formatUSD(SUMMARY.outUsd)}</Figure>}
        sub={`${SUMMARY.outCount} withdrawals settled`}
      />
      <Card
        className="lg:col-span-2 2xl:order-4 2xl:col-span-1"
        label="Traded"
        icon={Exchange01Icon}
        tone="border-white/[0.08] bg-white/[0.04] text-foreground/80"
        value={<Figure>{formatUSD(SUMMARY.tradedUsd)}</Figure>}
        sub={`${SUMMARY.tradeCount} trades · ${SUMMARY.swapCount} swaps`}
      />
      <Card
        className="lg:col-span-2 2xl:order-5 2xl:col-span-1"
        label="Fees paid"
        icon={CoinsDollarIcon}
        tone="border-white/[0.08] bg-white/[0.04] text-foreground/80"
        value={<Figure>{formatUSD(SUMMARY.feesUsd)}</Figure>}
        sub="Network fees only"
      />
    </div>
  )
}

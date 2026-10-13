"use client"

/**
 * The preview's summary row (components/transactions-unauth/summary.tsx) on
 * the page's real stats.
 *
 * The figures are the previous page's: `stats` from useUnifiedTransactions,
 * summed from the same rows the list renders, with "—" while an asset has no
 * price yet. "Traded" and the Net card's 14 bars are summed from the rows on
 * screen (lib/transactions-view.ts). "Fees paid" keeps its card and shows its
 * real empty state: no record carries a fee yet.
 */

import * as React from "react"
import { motion } from "motion/react"
import { ArrowDownLeft01Icon, ArrowUpRight01Icon, ArrowLeftRightIcon, CoinsDollarIcon, Exchange01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { Figure, Icon, Panel, type IconSvg } from "@/components/dashboard/redesign/ui"
import { fmtAmount, netByDay, tradedSummary } from "@/lib/transactions-view"
import type { TransactionStats, UnifiedTransaction } from "@/types/transactions"

const usd = (n: number) => `$${fmtAmount(n)}`

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
    <Panel as="article" className={cn("ds-lift flex min-w-0 flex-col gap-4 p-4 sm:p-5", className)}>
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

/** Same footprint as a card, before the stats have arrived. */
function CardSkeleton({ className, bars }: { className?: string; bars?: boolean }) {
  return (
    <Panel as="article" className={cn("flex min-w-0 flex-col gap-4 p-4 sm:p-5", className)} aria-hidden>
      <div className="flex items-center justify-between gap-2">
        <span className="skel h-3 w-20 rounded" />
        <span className="skel size-8 rounded-[10px]" />
      </div>
      <div className="flex flex-col gap-2">
        <span className="skel h-6 w-28 rounded" />
        <span className="skel h-3 w-24 rounded" />
      </div>
      {bars && <span className="skel h-9 w-full rounded" />}
    </Panel>
  )
}

/* The preview's grid, unchanged: two up on a phone with Net spanning the top
   row (it carries the chart); six tracks from lg so 5 cards land as 2 + 3;
   five across once there's room. */
const SLOTS = {
  net: "col-span-2 lg:col-span-3 2xl:order-3 2xl:col-span-1",
  in: "lg:col-span-3 2xl:order-1 2xl:col-span-1",
  out: "lg:col-span-2 2xl:order-2 2xl:col-span-1",
  traded: "lg:col-span-2 2xl:order-4 2xl:col-span-1",
  fees: "lg:col-span-2 2xl:order-5 2xl:col-span-1",
}
const GRID = "grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-6 2xl:grid-cols-5"

export function Summary({ stats, transactions }: { stats: TransactionStats | null; transactions: UnifiedTransaction[] }) {
  // The bars are relative to today, which the server cannot know.
  const [now, setNow] = React.useState<Date | null>(null)
  React.useEffect(() => setNow(new Date()), [])
  const days = React.useMemo(() => (now ? netByDay(transactions, now) : null), [transactions, now])
  const zeros = React.useMemo(() => Array.from({ length: 14 }, () => 0), [])

  if (!stats) {
    return (
      <div className={GRID} role="status" aria-label="Loading summary">
        <CardSkeleton className={SLOTS.net} bars />
        <CardSkeleton className={SLOTS.in} />
        <CardSkeleton className={SLOTS.out} />
        <CardSkeleton className={SLOTS.traded} />
        <CardSkeleton className={SLOTS.fees} />
      </div>
    )
  }

  const netKnown = stats.valuationComplete !== false
  const netUp = stats.netVolume >= 0
  const inKnown = !(stats.depositValuationComplete === false && stats.totalDeposits > 0)
  const outKnown = !(stats.withdrawalValuationComplete === false && stats.totalWithdrawals > 0)
  // While a row has no price the figure reads "—"; the bars wait with it
  // rather than drawing a shape the figure can't vouch for.
  const bars = netKnown && days ? days : zeros
  const max = Math.max(...bars.map(Math.abs), 1)
  const traded = tradedSummary(transactions)

  return (
    <div className={GRID}>
      <Card
        className={SLOTS.net}
        label="Net flow"
        icon={ArrowLeftRightIcon}
        tone="border-primary/25 bg-primary/[0.08] text-primary"
        value={
          netKnown ? (
            <span className={netUp ? "text-credit" : "text-debit"}>
              <Figure>{`${netUp ? "+" : "−"}${usd(Math.abs(stats.netVolume))}`}</Figure>
            </span>
          ) : (
            "—"
          )
        }
        sub={netKnown ? "Money in minus money out" : "Waiting for asset prices"}
      >
        {/* Centre-baseline bars: up days rise, down days hang. */}
        <div className="relative flex h-9 items-center gap-[3px]" aria-label="Net flow, last 14 days" role="img">
          <span aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-foreground/[0.08]" />
          {bars.map((v, i) => {
            const h = Math.max((Math.abs(v) / max) * 50, v === 0 ? 0 : 6)
            return (
              <span key={i} className="relative flex h-full flex-1 flex-col justify-center">
                <motion.span
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.7, delay: 0.2 + i * 0.03, ease: [0.22, 1, 0.36, 1] }}
                  className={cn(
                    "absolute inset-x-0 rounded-[2px]",
                    v > 0 ? "bottom-1/2 origin-bottom bg-credit/80" : v < 0 ? "top-1/2 origin-top bg-debit/80" : "top-1/2 h-px bg-foreground/15",
                  )}
                  style={v !== 0 ? { height: `${h}%` } : undefined}
                />
              </span>
            )
          })}
        </div>
      </Card>
      <Card
        className={SLOTS.in}
        label="Money in"
        icon={ArrowDownLeft01Icon}
        tone="border-credit/25 bg-credit/[0.08] text-credit"
        value={inKnown ? <span className="text-credit"><Figure>{usd(stats.depositVolume)}</Figure></span> : "—"}
        sub={`${stats.totalDeposits} deposit${stats.totalDeposits === 1 ? "" : "s"}`}
      />
      <Card
        className={SLOTS.out}
        label="Money out"
        icon={ArrowUpRight01Icon}
        tone="border-debit/25 bg-debit/[0.08] text-debit"
        value={outKnown ? <Figure>{usd(stats.withdrawalVolume)}</Figure> : "—"}
        sub={`${stats.totalWithdrawals} withdrawal${stats.totalWithdrawals === 1 ? "" : "s"}`}
      />
      <Card
        className={SLOTS.traded}
        label="Traded"
        icon={Exchange01Icon}
        tone="border-foreground/[0.08] bg-foreground/[0.04] text-foreground/80"
        value={traded.usd != null ? <Figure>{usd(traded.usd)}</Figure> : "—"}
        sub={`${traded.trades} trade${traded.trades === 1 ? "" : "s"} · ${traded.swaps} swap${traded.swaps === 1 ? "" : "s"}`}
      />
      <Card
        className={SLOTS.fees}
        label="Fees paid"
        icon={CoinsDollarIcon}
        tone="border-foreground/[0.08] bg-foreground/[0.04] text-foreground/80"
        value="—"
        sub="Not recorded yet"
      />
    </div>
  )
}

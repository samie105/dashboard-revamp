"use client"

/**
 * The four balance cards: where the money sits, at a glance.
 *
 * Spot and Futures carry a day change; Available and In Orders are SHARES of
 * spot, so they carry a meter instead — a percentage of what, matters more
 * there than a direction.
 */

import * as React from "react"
import { motion } from "motion/react"
import { Clock01Icon, Invoice03Icon, LeftToRightListBulletIcon, Wallet02Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { formatUSD } from "@/components/dashboard/redesign/format"
import { useDashboardData } from "@/components/dashboard/redesign/data"
import { Figure, Icon, Panel, type IconSvg } from "@/components/dashboard/redesign/ui"

/**
 * Real figures for the preview's four cards:
 *  · Spot / Futures — usePortfolioTotal (what the navbar and /portfolio show).
 *    The preview's per-card day change has no source, so that line is hidden.
 *    Futures closed says so in its place.
 *  · Available / In Orders — the spot account's free and held USDC
 *    (useTradeAccount), each with its share of spot USDC on the meter.
 * A figure is withheld (skeleton) until its account has answered.
 */
type Card = {
  label: string
  value: number
  icon: IconSvg
  settled: boolean
} & ({ kind: "change"; note?: string } | { kind: "share"; share: number; tone: "gold" | "muted" })

function useCards(): Card[] {
  const { portfolio, trade } = useDashboardData()
  const free = trade.balances?.spotUsdc ?? 0
  const held = trade.balances?.spotUsdcHold ?? 0
  const spotUsdc = free + held
  return [
    { label: "Spot Balance", value: portfolio.spot, icon: Wallet02Icon, kind: "change", settled: portfolio.spotSettled },
    {
      label: "Futures Balance",
      value: portfolio.futures,
      icon: Invoice03Icon,
      kind: "change",
      settled: portfolio.futuresSettled,
      note: portfolio.futuresOpen ? undefined : "Futures is closed",
    },
    { label: "Available Balance", value: free, icon: Clock01Icon, kind: "share", share: spotUsdc > 0 ? free / spotUsdc : 0, tone: "gold", settled: portfolio.spotSettled },
    { label: "In Orders", value: held, icon: LeftToRightListBulletIcon, kind: "share", share: spotUsdc > 0 ? held / spotUsdc : 0, tone: "muted", settled: portfolio.spotSettled },
  ]
}

function Meter({ share, tone, delay }: { share: number; tone: "gold" | "muted"; delay: number }) {
  return (
    <span className="flex items-center gap-3">
      <span className="relative h-[6px] flex-1 overflow-hidden rounded-full bg-foreground/[0.07]">
        <motion.span
          initial={{ scaleX: 0 }}
          animate={{ scaleX: share }}
          transition={{ duration: 1.1, delay, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "absolute inset-0 origin-left rounded-full",
            tone === "gold" ? "bg-gradient-to-r from-primary/70 to-primary shadow-[0_0_10px_var(--primary)]" : "bg-foreground/30",
          )}
        />
      </span>
      <span className="text-[12px] font-semibold tabular-nums text-muted-foreground">{(share * 100).toFixed(1)}%</span>
    </span>
  )
}

export function Balances() {
  const CARDS = useCards()
  return (
    <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 md:gap-4 xl:grid-cols-4">
      {CARDS.map((c, i) => (
        <Panel
          key={c.label}
          as="article"
          className="ds-lift group flex items-center gap-3 px-4 py-4 sm:gap-4 sm:px-5 sm:py-5 xl:gap-3.5 xl:px-4 2xl:gap-4 2xl:px-5"
        >
          <span className="relative flex size-10 shrink-0 sm:size-[52px] xl:size-11 2xl:size-[52px] items-center justify-center rounded-full border border-foreground/[0.07] bg-foreground/[0.035] text-foreground/85 transition-colors duration-300 group-hover:border-primary/30 group-hover:text-primary">
            <Icon icon={c.icon} className="size-[22px]" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-[13px] font-medium text-muted-foreground">{c.label}</span>
            <span className="truncate font-display text-[18px] sm:text-[21px] font-semibold leading-tight tracking-[-0.02em] tabular-nums text-foreground">
              {c.settled ? <Figure>{formatUSD(c.value)}</Figure> : <span aria-label="Loading" className="skel block h-[1em] w-24 rounded-md" />}
            </span>
            {c.kind === "change" ? (
              c.note && <span className="text-[13px] font-medium text-muted-foreground">{c.note}</span>
            ) : (
              c.settled && <Meter share={c.share} tone={c.tone} delay={0.3 + i * 0.08} />
            )}
          </span>
        </Panel>
      ))}
    </div>
  )
}

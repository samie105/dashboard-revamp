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
import { AVAILABLE, FUTURES_BALANCE, IN_ORDERS, SPOT_BALANCE, formatUSD, formatPct } from "@/components/dashboard-unauth/demo-data"
import { Figure, Icon, Panel, type IconSvg } from "@/components/redesign/ui"

type Card = {
  label: string
  value: number
  icon: IconSvg
} & ({ kind: "change"; changePct: number } | { kind: "share"; share: number; tone: "gold" | "muted" })

const CARDS: Card[] = [
  { label: "Spot Balance", value: SPOT_BALANCE, icon: Wallet02Icon, kind: "change", changePct: 3.11 },
  { label: "Futures Balance", value: FUTURES_BALANCE, icon: Invoice03Icon, kind: "change", changePct: 6.42 },
  { label: "Available Balance", value: AVAILABLE, icon: Clock01Icon, kind: "share", share: AVAILABLE / SPOT_BALANCE, tone: "gold" },
  { label: "In Orders", value: IN_ORDERS, icon: LeftToRightListBulletIcon, kind: "share", share: IN_ORDERS / SPOT_BALANCE, tone: "muted" },
]

function Meter({ share, tone, delay }: { share: number; tone: "gold" | "muted"; delay: number }) {
  return (
    <span className="flex items-center gap-3">
      <span className="relative h-[6px] flex-1 overflow-hidden rounded-full bg-white/[0.07]">
        <motion.span
          initial={{ scaleX: 0 }}
          animate={{ scaleX: share }}
          transition={{ duration: 1.1, delay, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "absolute inset-0 origin-left rounded-full",
            tone === "gold" ? "bg-gradient-to-r from-primary/70 to-primary shadow-[0_0_10px_var(--primary)]" : "bg-white/30",
          )}
        />
      </span>
      <span className="text-[12px] font-semibold tabular-nums text-muted-foreground">{(share * 100).toFixed(1)}%</span>
    </span>
  )
}

export function Balances() {
  return (
    <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 md:gap-4 xl:grid-cols-4">
      {CARDS.map((c, i) => (
        <Panel
          key={c.label}
          as="article"
          className="dash-lift group flex items-center gap-3 px-4 py-4 sm:gap-4 sm:px-5 sm:py-5 xl:gap-3.5 xl:px-4 2xl:gap-4 2xl:px-5"
        >
          <span className="relative flex size-10 shrink-0 sm:size-[52px] xl:size-11 2xl:size-[52px] items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.035] text-foreground/85 transition-colors duration-300 group-hover:border-primary/30 group-hover:text-primary">
            <Icon icon={c.icon} className="size-[22px]" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-[13px] font-medium text-muted-foreground">{c.label}</span>
            <span className="truncate font-display text-[18px] sm:text-[21px] font-semibold leading-tight tracking-[-0.02em] tabular-nums text-foreground">
              <Figure>{formatUSD(c.value)}</Figure>
            </span>
            {c.kind === "change" ? (
              <span className={cn("text-[13px] font-semibold tabular-nums", c.changePct >= 0 ? "text-credit" : "text-debit")}>
                {formatPct(c.changePct)}
                <span className="ml-1.5 font-medium text-muted-foreground/70">today</span>
              </span>
            ) : (
              <Meter share={c.share} tone={c.tone} delay={0.3 + i * 0.08} />
            )}
          </span>
        </Panel>
      ))}
    </div>
  )
}

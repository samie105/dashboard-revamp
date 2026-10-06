"use client"

/**
 * Top movers — three short lists side by side: what rose, what fell, and
 * what everyone is trading. Each row is a link to trade that pair.
 *
 * Three panels rather than one tabbed panel because they answer three
 * different questions, and a glance should answer all of them at once.
 */

import * as React from "react"
import Link from "next/link"
import { motion } from "motion/react"
import { ChartDecreaseIcon, ChartIncreaseIcon, FireIcon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { GAINERS, HOT, LOSERS, formatCompact, formatPrice, tradeHref, type Market } from "@/components/markets-unauth/market-data"
import { ChangeChip, Icon, Panel, PanelTitle, Spark, type IconSvg } from "@/components/redesign/ui"

const LISTS: { key: string; title: string; hint: string; icon: IconSvg; tone: string; rows: Market[]; meta: "name" | "volume" }[] = [
  { key: "gainers", title: "Top gainers", hint: "Biggest 7d moves up", icon: ChartIncreaseIcon, tone: "text-credit border-credit/25 bg-credit/[0.08]", rows: GAINERS, meta: "name" },
  { key: "losers", title: "Top losers", hint: "Biggest 7d moves down", icon: ChartDecreaseIcon, tone: "text-debit border-debit/25 bg-debit/[0.08]", rows: LOSERS, meta: "name" },
  { key: "hot", title: "Hot right now", hint: "Most traded today", icon: FireIcon, tone: "text-primary border-primary/25 bg-primary/[0.08]", rows: HOT, meta: "volume" },
]

export function Movers() {
  return (
    <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-3">
      {LISTS.map((list, li) => (
        <Panel key={list.key} className="flex flex-col px-3 pb-2 pt-5">
          <div className="flex items-center justify-between gap-3 px-2 pb-3">
            <div className="flex flex-col gap-0.5">
              <PanelTitle className="text-[16px]">{list.title}</PanelTitle>
              <span className="text-[12.5px] text-muted-foreground">{list.hint}</span>
            </div>
            <span className={cn("flex size-10 items-center justify-center rounded-xl border", list.tone)}>
              <Icon icon={list.icon} className="size-[19px]" />
            </span>
          </div>

          <ul>
            {list.rows.map((m, i) => (
              <motion.li
                key={m.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.15 + li * 0.06 + i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                className="border-t border-white/[0.045] first:border-t-0"
              >
                <Link
                  href={tradeHref(m)}
                  className="grid grid-cols-[20px_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-white/[0.03]"
                >
                  <span className="text-[12.5px] font-medium tabular-nums text-muted-foreground/70">{i + 1}</span>
                  <span className="flex min-w-0 items-center gap-3">
                    <CoinAvatar symbol={m.base} size="lg" className="size-9 ring-1 ring-white/10" />
                    <span className="flex min-w-0 flex-col leading-tight">
                      <span className="truncate text-[13.5px] font-semibold text-foreground">
                        {m.base}
                        <span className="font-medium text-muted-foreground">/{m.quote}</span>
                      </span>
                      <span className="truncate text-[12px] text-muted-foreground">
                        {list.meta === "volume" ? `Vol $${formatCompact(m.volumeUsd)}` : m.name}
                      </span>
                    </span>
                  </span>
                  <Spark points={m.series} width={64} height={26} className="hidden sm:block lg:hidden 2xl:block" />
                  <span className="flex flex-col items-end gap-1">
                    <span className="text-[13.5px] font-semibold tabular-nums text-foreground">{formatPrice(m.price)}</span>
                    <ChangeChip value={m.changePct} size="sm" className="h-5 min-w-[58px] text-[11px]" />
                  </span>
                </Link>
              </motion.li>
            ))}
          </ul>
        </Panel>
      ))}
    </div>
  )
}

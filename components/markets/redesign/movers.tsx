"use client"

/**
 * Top movers: the preview's three panels (components/markets-unauth/movers.tsx)
 * on the page's real rankings (lib/markets-view.ts), by the 7-day move each
 * row's curve shows. The third list is the real "Most active" (largest moves
 * either way): the preview's "Hot right now" ranks by volume, which the
 * price feed doesn't carry.
 */

import * as React from "react"
import Link from "next/link"
import { motion } from "motion/react"
import { ChartDecreaseIcon, ChartIncreaseIcon, FireIcon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { ChangeChip, Icon, Panel, PanelTitle, Spark, type IconSvg } from "@/components/dashboard/redesign/ui"
import { MOVERS_SHOWN, formatPrice } from "@/lib/markets-view"
import type { CoinData, FuturesMarket } from "@/lib/actions"

/** One row, already resolved: spot coin or futures contract. */
export type MoverRow = {
  key: string
  symbol: string
  image?: string
  label: string
  sub: string
  price: number
  change: number
  /** 7-day series; undefined while loading, null when the feed has none. */
  points?: number[] | null
  href: string
}

export function coinRow(c: CoinData, change: number, points: number[] | null | undefined): MoverRow {
  return { key: c.id, symbol: c.symbol, image: c.image, label: c.symbol, sub: c.name, price: c.price, change, points, href: `/trade?symbol=${encodeURIComponent(c.symbol)}` }
}

export function futuresRow(m: FuturesMarket): MoverRow {
  return {
    key: m.symbol,
    symbol: m.baseAsset,
    image: m.image,
    label: m.symbol,
    sub: "Perpetual",
    price: m.markPrice,
    change: m.change24h,
    points: null,
    href: `/trade?market=futures&symbol=${encodeURIComponent(m.symbol)}`,
  }
}

type List = { key: string; title: string; hint: string; icon: IconSvg; tone: string; rows: MoverRow[]; empty: string }

/** `window` names the move the lists rank on: 7 days for spot (the curve in
 *  each row), 24 hours for futures (the venue's own figure). */
export function Movers({ gainers, losers, active, window, loading }: { gainers: MoverRow[]; losers: MoverRow[]; active: MoverRow[]; window: "7d" | "24h"; loading: boolean }) {
  const span = window === "7d" ? "7 days" : "24 hours"
  const lists: List[] = [
    { key: "gainers", title: "Top gainers", hint: `Biggest ${window} moves up`, icon: ChartIncreaseIcon, tone: "text-credit border-credit/25 bg-credit/[0.08]", rows: gainers, empty: `Nothing on this list is up over the last ${span}.` },
    { key: "losers", title: "Top losers", hint: `Biggest ${window} moves down`, icon: ChartDecreaseIcon, tone: "text-debit border-debit/25 bg-debit/[0.08]", rows: losers, empty: `Nothing on this list is down over the last ${span}.` },
    { key: "active", title: "Most active", hint: `Largest ${window} moves either way`, icon: FireIcon, tone: "text-primary border-primary/25 bg-primary/[0.08]", rows: active, empty: "Nothing has moved enough to rank yet." },
  ]
  return (
    <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-3">
      {lists.map((list, li) => (
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

          {loading ? (
            <ul aria-hidden>
              {Array.from({ length: MOVERS_SHOWN }, (_, i) => (
                <li key={i} className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-3 border-t border-foreground/[0.045] px-2 py-3 first:border-t-0">
                  <span className="skel h-3 w-3 rounded" />
                  <span className="flex items-center gap-3">
                    <span className="skel size-9 shrink-0 rounded-full" />
                    <span className="flex flex-col gap-1.5">
                      <span className="skel h-3.5 w-16 rounded" />
                      <span className="skel h-3 w-20 rounded" />
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1.5">
                    <span className="skel h-3.5 w-16 rounded" />
                    <span className="skel h-5 w-[58px] rounded-lg" />
                  </span>
                </li>
              ))}
            </ul>
          ) : list.rows.length === 0 ? (
            <p className="flex flex-1 items-center px-2 pb-4 pt-2 text-[12.5px] leading-relaxed text-muted-foreground">{list.empty}</p>
          ) : (
            <ul>
              {list.rows.slice(0, MOVERS_SHOWN).map((m, i) => (
                <motion.li
                  key={m.key}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.15 + li * 0.06 + i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                  className="border-t border-foreground/[0.045] first:border-t-0"
                >
                  <Link
                    href={m.href}
                    className="grid grid-cols-[20px_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-foreground/[0.03]"
                  >
                    <span className="text-[12.5px] font-medium tabular-nums text-muted-foreground/70">{i + 1}</span>
                    <span className="flex min-w-0 items-center gap-3">
                      <CoinAvatar symbol={m.symbol} src={m.image} size="lg" className="size-9 ring-1 ring-foreground/10" />
                      <span className="flex min-w-0 flex-col leading-tight">
                        <span className="truncate text-[13.5px] font-semibold text-foreground">{m.label}</span>
                        <span className="truncate text-[12px] text-muted-foreground">{m.sub}</span>
                      </span>
                    </span>
                    <span className="hidden sm:block lg:hidden 2xl:block">
                      {m.points === undefined ? (
                        <span className="skel block h-[26px] w-16 rounded-sm" />
                      ) : m.points && m.points.length > 1 ? (
                        <Spark points={m.points} width={64} height={26} />
                      ) : (
                        <span className="block w-16" />
                      )}
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <span className="text-[13.5px] font-semibold tabular-nums text-foreground">${formatPrice(m.price)}</span>
                      <ChangeChip value={m.change} size="sm" className="h-5 min-w-[58px] text-[11px]" />
                    </span>
                  </Link>
                </motion.li>
              ))}
            </ul>
          )}
        </Panel>
      ))}
    </div>
  )
}

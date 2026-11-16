"use client"

/** The analytics page's shared pieces: section panel, figure tile, and their skeletons. */

import * as React from "react"

import { cn } from "@/lib/utils"
import { SkeletonBlock } from "@/components/dash"
import { Figure, Icon, Panel, type IconSvg } from "@/components/dashboard/redesign/ui"
import { usd } from "@/components/analytics/charts"
import type { AnalyticsRange, UsdFigure } from "@/lib/analytics-view"

export const RANGE_NOUN: Record<AnalyticsRange, string> = {
  "7d": "the last 7 days",
  "30d": "the last 30 days",
  "90d": "the last 90 days",
  all: "all time",
}

export function SectionPanel({ title, subtitle, action, className, children }: { title: string; subtitle?: React.ReactNode; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <Panel className={cn("flex min-w-0 flex-col gap-5 p-4 sm:p-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
          {subtitle && <p className="text-[12.5px] text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </Panel>
  )
}

export function Tile({ label, icon, tone, value, sub }: { label: string; icon: IconSvg; tone: string; value: React.ReactNode; sub: React.ReactNode }) {
  return (
    <Panel as="article" className="flex min-w-0 flex-col gap-4 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
        <span className={cn("flex size-8 items-center justify-center rounded-[10px] border", tone)}>
          <Icon icon={icon} className="size-4" />
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="truncate font-display text-[20px] font-semibold leading-none tracking-[-0.03em] sm:text-[24px]">{value}</span>
        <span className="text-[12px] leading-snug text-muted-foreground">{sub}</span>
      </div>
    </Panel>
  )
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** A USD figure, or "—" until prices load. Partial sums say what they skipped. */
export function usdTile(f: UsdFigure, pricesReady: boolean, noun: string): { value: React.ReactNode; sub: string } {
  if (!pricesReady) return { value: "—", sub: "Waiting for prices" }
  if (f.count > 0 && f.unpriced === f.count) return { value: "—", sub: `${plural(f.count, noun)}, none priced yet` }
  return {
    value: <Figure>{usd(f.usd)}</Figure>,
    sub: f.unpriced > 0 ? `${plural(f.count, noun)} · ${f.unpriced} not priced` : plural(f.count, noun),
  }
}

export function TilesSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4" role="status" aria-label="Loading figures">
      {Array.from({ length: 4 }, (_, i) => (
        <Panel key={i} as="article" className="flex flex-col gap-4 p-4 sm:p-5" aria-hidden>
          <div className="flex items-center justify-between">
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="size-8 rounded-[10px]" />
          </div>
          <div className="flex flex-col gap-2">
            <SkeletonBlock className="h-6 w-28" />
            <SkeletonBlock className="h-3 w-24" />
          </div>
        </Panel>
      ))}
    </div>
  )
}

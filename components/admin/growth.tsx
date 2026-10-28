"use client"

/**
 * Growth panels for the Users page: where the period's new users drop off
 * (signup → wallet → first deposit → first transaction), and how many of
 * each weekly signup cohort are still active week by week.
 */

import * as React from "react"

import { EmptyPanel, Panel, PanelHeader, SkeletonBlock } from "@/components/dash"
import type { AdminCohort, AdminFunnelStep } from "@/lib/admin/types"
import { formatCount, funnelRows, periodLong, retentionShade } from "@/lib/admin/view"
import type { AdminPeriod } from "@/lib/admin/types"
import { cn } from "@/lib/utils"

const pct = (v: number) => `${v < 10 && v > 0 ? v.toFixed(1) : Math.round(v)}%`

export function FunnelPanel({ steps, period, dim }: { steps?: AdminFunnelStep[]; period: AdminPeriod; dim: boolean }) {
  const rows = steps ? funnelRows(steps) : []
  return (
    <Panel className="flex flex-col gap-4 p-4 md:p-5">
      <PanelHeader title="New user funnel" subtitle={`People who signed up in ${periodLong(period)}, and how far they got`} />
      {!steps ? (
        <div role="status" aria-label="Loading funnel" className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => <SkeletonBlock key={i} className="h-9 w-full rounded-xl" />)}
        </div>
      ) : (rows[0]?.count ?? 0) === 0 ? (
        <EmptyPanel compact title="No signups in this period" description="The funnel fills in as people sign up." />
      ) : (
        <ol className={cn("flex flex-col gap-2.5 transition-opacity", dim && "opacity-55")}>
          {rows.map((r, i) => (
            <li key={r.key} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="truncate font-semibold text-foreground">{i + 1}. {r.label}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  <span className="font-semibold text-foreground">{formatCount(r.count)}</span> · {pct(r.ofSignups)}
                </span>
              </div>
              <div className="relative h-8 overflow-hidden rounded-xl bg-foreground/[0.04]" aria-hidden>
                <div className="h-full rounded-xl bg-primary/70" style={{ width: `${Math.max(r.ofSignups, 0.5)}%` }} />
              </div>
              {r.fromPrevious !== null && (
                <span className="text-[11.5px] text-muted-foreground">
                  {pct(r.fromPrevious)} of the step before{r.fromPrevious < 60 ? " · biggest drop-offs are here" : ""}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}

const weekOf = (at: string) => new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })

export function RetentionPanel({ retention }: { retention?: { weeks: number; cohorts: AdminCohort[] } }) {
  return (
    <Panel className="flex flex-col gap-4 p-4 md:p-5">
      <PanelHeader title="Retention" subtitle="Share of each week's signups still active in the weeks after (not affected by the period)" />
      {!retention ? (
        <SkeletonBlock className="h-56 w-full rounded-xl" />
      ) : retention.cohorts.length === 0 ? (
        <EmptyPanel compact title="No cohorts yet" description="Retention appears once people have been signed up for a week." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-separate border-spacing-1 text-[12px] tabular-nums">
            <caption className="sr-only">Weekly retention: each row is a signup week, each column a week after signing up</caption>
            <thead>
              <tr className="text-muted-foreground">
                <th scope="col" className="px-2 py-1 text-left font-medium">Signed up</th>
                <th scope="col" className="px-2 py-1 text-right font-medium">Users</th>
                {Array.from({ length: retention.weeks }, (_, w) => (
                  <th key={w} scope="col" className="px-2 py-1 text-center font-medium">Wk {w + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {retention.cohorts.map((c) => (
                <tr key={c.weekStart}>
                  <th scope="row" className="whitespace-nowrap px-2 py-1.5 text-left font-medium text-foreground">{weekOf(c.weekStart)}</th>
                  <td className="px-2 py-1.5 text-right text-muted-foreground">{formatCount(c.size)}</td>
                  {Array.from({ length: retention.weeks }, (_, w) => {
                    const share = c.retained[w]
                    return share === undefined ? (
                      <td key={w} className="rounded-md px-2 py-1.5 text-center text-muted-foreground/40" aria-label="Not yet">·</td>
                    ) : (
                      <td key={w} className={cn("rounded-md px-2 py-1.5 text-center font-semibold text-foreground", retentionShade(share))}>{Math.round(share * 100)}%</td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

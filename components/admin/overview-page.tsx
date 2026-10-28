"use client"

/**
 * Admin overview: total users, active users and volume for the chosen
 * period (24h / 7d / 30d / 1y), with the period's volume curve.
 *
 * States (lib/admin/view.ts overviewState): skeleton tiles while loading;
 * the previous period dimmed while a new one loads; one panel instead of the
 * figures for no access, signed out, not connected, failed and an empty
 * platform; tiles plus a "no activity" panel when the period was quiet.
 */

import * as React from "react"

import { DashScope, Panel, PanelHeader, PriceChart, SkeletonBlock } from "@/components/dash"
import { useAdminOverview } from "@/hooks/admin/useAdminData"
import type { AdminPeriod } from "@/lib/admin/types"
import { activeShare, bucketLabel, formatCount, overviewState, periodLong } from "@/lib/admin/view"
import { usd, usdCompact } from "@/lib/num"
import { ADMIN_PAGE, AdminHeader, AdminStatePanel, PeriodTabs, StatTile, blocksFigures } from "@/components/admin/admin-kit"

/** About five evenly spread axis labels. */
function ticksFor(labels: string[]): string[] {
  if (labels.length <= 5) return labels
  const step = (labels.length - 1) / 4
  return Array.from({ length: 5 }, (_, i) => labels[Math.round(i * step)] ?? "")
}

export function AdminOverviewPage() {
  const [period, setPeriod] = React.useState<AdminPeriod>("7d")
  const query = useAdminOverview(period)
  const state = overviewState({ period, data: query.data, error: query.error })
  const data = state.kind === "loading" ? undefined : query.data
  const dim = state.kind === "switching"
  const labels = React.useMemo(() => (data ? data.volume.points.map((p) => bucketLabel(p.at, data.period)) : []), [data])

  return (
    <DashScope className={ADMIN_PAGE}>
      <AdminHeader title="Overview" subtitle={`Users and volume across ${periodLong(period)}.`} action={<PeriodTabs value={period} onChange={setPeriod} />} />

      {blocksFigures(state) ? (
        <Panel>
          <AdminStatePanel state={state} period={period} subject="users" onRetry={() => void query.refetch()} />
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 md:gap-5">
            <StatTile label="Total users" value={data ? formatCount(data.users.total) : null} sub="All time" dim={dim} />
            <StatTile
              label="Active users"
              value={data ? formatCount(data.users.active) : null}
              sub={data ? `${activeShare(data.users.active, data.users.total)} of all users · ${periodLong(data.period)}` : undefined}
              dim={dim}
            />
            <StatTile label="Volume" value={data ? usdCompact(data.volume.totalUsd) : null} sub={data ? `${usd(data.volume.totalUsd, { min: 0, max: 0 })} · ${periodLong(data.period)}` : undefined} dim={dim} />
          </div>

          <Panel className="flex flex-col gap-4 p-5">
            <PanelHeader title="Volume" subtitle={data ? `By ${data.period === "24h" ? "hour" : data.period === "1y" ? "month" : "day"}, in USD` : "In USD"} />
            {state.kind === "no-data" ? (
              <AdminStatePanel state={state} period={period} subject="users" onRetry={() => void query.refetch()} />
            ) : data ? (
              <div className={dim ? "opacity-55 transition-opacity" : "transition-opacity"} aria-busy={dim}>
                <PriceChart
                  points={data.volume.points.map((p) => p.usd)}
                  pointLabels={labels}
                  ticks={ticksFor(labels)}
                  format={(v) => usd(v, { min: 0, max: 0 })}
                  formatAxis={(v) => usdCompact(v)}
                  height={240}
                />
              </div>
            ) : (
              <div role="status" aria-busy="true" aria-label="Loading volume">
                <SkeletonBlock className="h-[240px] w-full rounded-2xl" />
              </div>
            )}
          </Panel>
        </>
      )}
    </DashScope>
  )
}

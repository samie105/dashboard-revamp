"use client"

/**
 * Admin overview (the analytics console): four KPIs with change vs the
 * previous period and their trend; the main chart switching between active
 * users, new users, volume and active wallets; volume by network and by
 * product; wallets by network; and recent platform activity.
 *
 * States (lib/admin/view.ts overviewState): skeletons while loading; the
 * previous period dimmed while a new one loads; one panel instead of the
 * figures for no access, signed out, not connected, failed and an empty
 * platform; a quiet period keeps the KPIs and says so in each section.
 */

import * as React from "react"

import { DataTable, Panel, PanelHeader, StatusBadge, type DataColumn } from "@/components/dash"
import { useAdminOverview } from "@/hooks/admin/useAdminData"
import type { AdminActivity } from "@/lib/admin/types"
import { ACTIVITY_LABEL, activeShare, formatCount, formatCountCompact, overviewState, periodLong, STATUS_TONE, timeAgo } from "@/lib/admin/view"
import { usd, usdCompact } from "@/lib/num"
import { AdminPageHeader, AdminStatePanel, BreakdownPanel, blocksFigures, KpiCard, KpiGrid, MetricChart, useAdminPeriod } from "@/components/admin/admin-kit"

const whole = (v: number) => usd(v, { min: 0, max: 0 })

const ACTIVITY_COLUMNS: DataColumn<AdminActivity>[] = [
  { key: "time", header: "Time", cell: (a) => <span className="tabular-nums text-muted-foreground">{timeAgo(a.at)}</span> },
  { key: "user", header: "User", cell: (a) => <span className="font-medium text-foreground">{a.userLabel}</span> },
  { key: "type", header: "Type", cell: (a) => ACTIVITY_LABEL[a.type] },
  { key: "network", header: "Network", cell: (a) => <span className="text-muted-foreground">{a.networkLabel}</span>, showFrom: "lg" },
  { key: "amount", header: "Amount", align: "right", cell: (a) => <span className="font-semibold tabular-nums text-foreground">{usd(a.amountUsd)}</span> },
  { key: "status", header: "Status", align: "right", cell: (a) => <StatusBadge tone={STATUS_TONE[a.status]} label={a.status} /> },
]

function ActivityCard(a: AdminActivity) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[13.5px] font-semibold text-foreground">{ACTIVITY_LABEL[a.type]} · {usd(a.amountUsd)}</span>
        <span className="truncate text-[12px] text-muted-foreground">{a.userLabel} · {a.networkLabel} · {timeAgo(a.at)}</span>
      </div>
      <StatusBadge tone={STATUS_TONE[a.status]} label={a.status} />
    </div>
  )
}

export function AdminOverviewPage() {
  const [period, setPeriod] = useAdminPeriod()
  const query = useAdminOverview(period)
  const state = overviewState({ period, data: query.data, error: query.error })
  const data = state.kind === "loading" ? undefined : query.data
  const dim = state.kind === "switching"
  const quiet = state.kind === "no-data"
  const retry = () => void query.refetch()

  return (
    <>
      <AdminPageHeader
        title="Overview"
        subtitle={`Everything happening on the crypto dashboard across ${periodLong(period)}.`}
        period={period}
        onPeriod={setPeriod}
        asOf={data?.asOf}
        refreshing={query.isFetching && !query.isPending}
        onRefresh={retry}
      />

      {blocksFigures(state) ? (
        <AdminStatePanel state={state} period={period} subject="users" onRetry={retry} />
      ) : (
        <>
          <KpiGrid>
            <KpiCard label="Total users" kpi={data?.kpis.totalUsers} format={formatCount} period={period} dim={dim} />
            <KpiCard
              label="Active users"
              kpi={data?.kpis.activeUsers}
              format={formatCount}
              period={period}
              dim={dim}
              note={data ? `${activeShare(data.kpis.activeUsers.value, data.kpis.totalUsers.value)} of all users` : undefined}
            />
            <KpiCard label="Volume" kpi={data?.kpis.volumeUsd} format={usdCompact} period={period} dim={dim} note={data ? whole(data.kpis.volumeUsd.value) : undefined} />
            <KpiCard label="Total wallets" kpi={data?.kpis.totalWallets} format={formatCount} period={period} dim={dim} />
          </KpiGrid>

          <MetricChart
            id="admin-overview-chart"
            title="Activity"
            period={data?.period ?? period}
            at={data?.series.map((p) => p.at)}
            quiet={quiet}
            dim={dim}
            metrics={[
              { key: "active", label: "Active users", values: data?.series.map((p) => p.activeUsers) ?? [], format: formatCount, formatAxis: formatCountCompact },
              { key: "volume", label: "Volume", values: data?.series.map((p) => p.volumeUsd) ?? [], format: whole, formatAxis: usdCompact },
              { key: "new", label: "New users", values: data?.series.map((p) => p.newUsers) ?? [], format: formatCount, formatAxis: formatCountCompact },
              { key: "wallets", label: "Active wallets", values: data?.series.map((p) => p.activeWallets) ?? [], format: formatCount, formatAxis: formatCountCompact },
            ]}
          />

          <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-3">
            <BreakdownPanel title="Volume by network" subtitle={periodLong(period)} items={data?.volumeByNetwork} format={usdCompact} dim={dim} emptyText={`No volume in ${periodLong(period)}.`} />
            <BreakdownPanel title="Volume by product" subtitle={periodLong(period)} items={data?.volumeByProduct} format={usdCompact} dim={dim} emptyText={`No volume in ${periodLong(period)}.`} />
            <BreakdownPanel title="Wallets by network" subtitle="All time" items={data?.walletsByNetwork} format={formatCount} dim={dim} emptyText="No wallets yet." />
          </div>

          <Panel className="flex flex-col gap-3 pt-4 md:pt-5">
            <PanelHeader className="px-4 md:px-5" title="Recent activity" subtitle="Latest transactions across the platform" />
            <DataTable
              label="Recent activity"
              rows={data?.recentActivity}
              columns={ACTIVITY_COLUMNS}
              rowKey={(a) => a.id}
              card={ActivityCard}
              loading={!data}
              empty={{ title: quiet ? "No activity in this period" : "No activity yet", description: quiet ? `Nothing happened in ${periodLong(period)}.` : "Transactions will show here as they happen." }}
              skeletonRows={6}
            />
          </Panel>
        </>
      )}
    </>
  )
}

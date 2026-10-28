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
import { ADMIN_ACTIVITY_TYPES, type AdminActivity, type AdminActivityStatus, type AdminActivityType } from "@/lib/admin/types"
import { ACTIVITY_LABEL, activeShare, filterActivity, type ActivityFilter, formatCount, formatCountCompact, overviewState, periodLong, STATUS_TONE, timeAgo, METRIC_DEFINITIONS } from "@/lib/admin/view"
import { usd, usdCompact } from "@/lib/num"
import { ActivitySheet, CsvButton, MiniSelect } from "@/components/admin/details"
import { AdminPageHeader, AdminStatePanel, AttentionPanel, BreakdownPanel, blocksFigures, KpiCard, KpiGrid, MetricChart, useAdminPeriod } from "@/components/admin/admin-kit"

const whole = (v: number) => usd(v, { min: 0, max: 0 })

/** The first cell is a real button, so a keyboard user can open a row too (the row click is for the mouse). */
function activityColumns(open: (a: AdminActivity) => void): DataColumn<AdminActivity>[] {
  return [
    {
      key: "time",
      header: "Time",
      cell: (a) => (
        <button type="button" onClick={(e) => { e.stopPropagation(); open(a) }} className="rounded tabular-nums text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/60" aria-label={`Open ${ACTIVITY_LABEL[a.type]} of ${usd(a.amountUsd)}, ${timeAgo(a.at)}`}>
          {timeAgo(a.at)}
        </button>
      ),
    },
    { key: "user", header: "User", cell: (a) => <span className="font-medium text-foreground">{a.userLabel}</span> },
    { key: "type", header: "Type", cell: (a) => ACTIVITY_LABEL[a.type] },
    { key: "network", header: "Network", cell: (a) => <span className="text-muted-foreground">{a.networkLabel}</span>, showFrom: "lg" },
    { key: "amount", header: "Amount", align: "right", cell: (a) => <span className="font-semibold tabular-nums text-foreground">{usd(a.amountUsd)}</span> },
    { key: "status", header: "Status", align: "right", cell: (a) => <StatusBadge tone={STATUS_TONE[a.status]} label={a.status} /> },
  ]
}

const TYPE_OPTIONS: readonly { key: AdminActivityType | "all"; label: string }[] = [{ key: "all", label: "All" }, ...ADMIN_ACTIVITY_TYPES.map((t) => ({ key: t, label: ACTIVITY_LABEL[t] }))]
const STATUS_OPTIONS: readonly { key: AdminActivityStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "completed", label: "Completed" },
  { key: "pending", label: "Pending" },
  { key: "failed", label: "Failed" },
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
  const [filter, setFilter] = React.useState<ActivityFilter>({ type: "all", status: "all" })
  const [opened, setOpened] = React.useState<AdminActivity | null>(null)
  const columns = React.useMemo(() => activityColumns(setOpened), [])
  const activity = data ? filterActivity(data.recentActivity, filter) : undefined
  const filtering = filter.type !== "all" || filter.status !== "all"

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
          <AttentionPanel attention={data?.attention} dim={dim} />

          <KpiGrid>
            <KpiCard label="Total users" definition={METRIC_DEFINITIONS.totalUsers} compare="absolute" kpi={data?.kpis.totalUsers} format={formatCount} period={period} dim={dim} />
            <KpiCard
              label="Active users" definition={METRIC_DEFINITIONS.activeUsers}
              kpi={data?.kpis.activeUsers}
              format={formatCount}
              period={period}
              dim={dim}
              note={data ? `${activeShare(data.kpis.activeUsers.value, data.kpis.totalUsers.value)} of all users` : undefined}
            />
            <KpiCard label="Volume" definition={METRIC_DEFINITIONS.volumeUsd} kpi={data?.kpis.volumeUsd} format={usdCompact} period={period} dim={dim} note={data ? whole(data.kpis.volumeUsd.value) : undefined} />
            <KpiCard label="Total wallets" definition={METRIC_DEFINITIONS.totalWallets} compare="absolute" kpi={data?.kpis.totalWallets} format={formatCount} period={period} dim={dim} />
          </KpiGrid>

          <MetricChart
            id="admin-overview-chart"
            title="Activity"
            period={data?.period ?? period}
            at={data?.series.map((p) => p.at)}
            quiet={quiet}
            dim={dim}
            metrics={[
              { key: "active", label: "Active users", values: data?.series.map((p) => p.activeUsers) ?? [], previous: data?.previousSeries.map((p) => p.activeUsers), format: formatCount, formatAxis: formatCountCompact },
              { key: "volume", label: "Volume", values: data?.series.map((p) => p.volumeUsd) ?? [], previous: data?.previousSeries.map((p) => p.volumeUsd), format: whole, formatAxis: usdCompact },
              { key: "new", label: "New users", values: data?.series.map((p) => p.newUsers) ?? [], previous: data?.previousSeries.map((p) => p.newUsers), format: formatCount, formatAxis: formatCountCompact },
              { key: "wallets", label: "Active wallets", values: data?.series.map((p) => p.activeWallets) ?? [], previous: data?.previousSeries.map((p) => p.activeWallets), format: formatCount, formatAxis: formatCountCompact },
            ]}
          />

          <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-3">
            <BreakdownPanel title="Volume by network" subtitle={periodLong(period)} items={data?.volumeByNetwork} format={usdCompact} dim={dim} emptyText={`No volume in ${periodLong(period)}.`} />
            <BreakdownPanel title="Volume by product" subtitle={periodLong(period)} items={data?.volumeByProduct} format={usdCompact} dim={dim} emptyText={`No volume in ${periodLong(period)}.`} />
            <BreakdownPanel title="Wallets by network" subtitle="All time" items={data?.walletsByNetwork} format={formatCount} dim={dim} emptyText="No wallets yet." />
          </div>

          <Panel className="flex flex-col gap-3 pt-4 md:pt-5">
            <div className="flex flex-col gap-3 px-4 md:flex-row md:items-start md:justify-between md:px-5">
              <PanelHeader title="Recent activity" subtitle="Latest transactions across the platform. Select one for details." />
              <div className="flex flex-wrap items-center gap-2">
                <MiniSelect label="Type" value={filter.type} options={TYPE_OPTIONS} onChange={(type) => setFilter((f) => ({ ...f, type }))} />
                <MiniSelect label="Status" value={filter.status} options={STATUS_OPTIONS} onChange={(status) => setFilter((f) => ({ ...f, status }))} />
                <CsvButton
                  filename={`worldstreet-activity-${period}-${new Date().toISOString().slice(0, 10)}.csv`}
                  header={["Time (UTC)", "User", "Type", "Network", "Amount (USD)", "Status", "Reference", "Transaction"]}
                  rows={(activity ?? []).map((a) => [a.at, a.userLabel, ACTIVITY_LABEL[a.type], a.networkLabel, a.amountUsd, a.status, a.id, a.txHash ?? null])}
                />
              </div>
            </div>
            <DataTable
              label="Recent activity"
              rows={activity}
              columns={columns}
              rowKey={(a) => a.id}
              card={ActivityCard}
              onRowClick={setOpened}
              loading={!data}
              empty={
                filtering
                  ? { title: "No activity matches", description: "Nothing recent matches these filters. Try All." }
                  : { title: quiet ? "No activity in this period" : "No activity yet", description: quiet ? `Nothing happened in ${periodLong(period)}.` : "Transactions will show here as they happen." }
              }
              skeletonRows={6}
            />
          </Panel>
          <ActivitySheet activity={opened} onClose={() => setOpened(null)} />
        </>
      )}
    </>
  )
}

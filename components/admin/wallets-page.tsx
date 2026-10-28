"use client"

/**
 * Admin wallets: total, active and new wallets with change vs the previous
 * period; active and new wallets over the period; and every network's total
 * and active wallets.
 *
 * States (lib/admin/view.ts walletsState): skeletons while loading; the
 * previous period dimmed while a new one loads; one panel instead of the
 * figures for no access, signed out, not connected, failed and no wallets at
 * all; a quiet period keeps the totals and says so in each section.
 */

import * as React from "react"

import { DataTable, Panel, PanelHeader, type DataColumn } from "@/components/dash"
import { useAdminWallets } from "@/hooks/admin/useAdminData"
import type { AdminNetworkWallets } from "@/lib/admin/types"
import { activeShare, formatCount, formatCountCompact, periodLong, walletsState, METRIC_DEFINITIONS } from "@/lib/admin/view"
import { AdminPageHeader, AdminStatePanel, blocksFigures, KpiCard, KpiGrid, MetricChart, useAdminPeriod } from "@/components/admin/admin-kit"

function columns(period: string): DataColumn<AdminNetworkWallets>[] {
  return [
    { key: "network", header: "Network", cell: (n) => <span className="font-semibold text-foreground">{n.label}</span> },
    { key: "total", header: "Total wallets", align: "right", cell: (n) => <span className="tabular-nums">{formatCount(n.total)}</span> },
    { key: "active", header: `Active · ${period}`, align: "right", cell: (n) => <span className="tabular-nums">{formatCount(n.active)}</span> },
    { key: "share", header: "Active share", align: "right", showFrom: "md", cell: (n) => <span className="tabular-nums text-muted-foreground">{activeShare(n.active, n.total)}</span> },
  ]
}

function NetworkCard(n: AdminNetworkWallets) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-semibold text-foreground">{n.label}</span>
      <span className="text-right text-[12.5px] tabular-nums text-muted-foreground">
        <span className="font-semibold text-foreground">{formatCount(n.total)}</span> total · {formatCount(n.active)} active
      </span>
    </div>
  )
}

export function AdminWalletsPage() {
  const [period, setPeriod] = useAdminPeriod()
  const query = useAdminWallets(period)
  const state = walletsState({ period, data: query.data, error: query.error })
  const data = state.kind === "loading" ? undefined : query.data
  const dim = state.kind === "switching"
  const retry = () => void query.refetch()

  return (
    <>
      <AdminPageHeader
        title="Wallets"
        subtitle={`Wallets created and in use across ${periodLong(period)}.`}
        period={period}
        onPeriod={setPeriod}
        asOf={data?.asOf}
        refreshing={query.isFetching && !query.isPending}
        onRefresh={retry}
      />

      {blocksFigures(state) ? (
        <AdminStatePanel state={state} period={period} subject="wallets" onRetry={retry} />
      ) : (
        <>
          <KpiGrid columns={3}>
            <KpiCard label="Total wallets" definition={METRIC_DEFINITIONS.totalWallets} compare="absolute" kpi={data?.kpis.totalWallets} format={formatCount} period={period} dim={dim} />
            <KpiCard
              label="Active wallets" definition={METRIC_DEFINITIONS.activeWallets}
              kpi={data?.kpis.activeWallets}
              format={formatCount}
              period={period}
              dim={dim}
              note={data ? `${activeShare(data.kpis.activeWallets.value, data.kpis.totalWallets.value)} of all wallets` : undefined}
            />
            <KpiCard label="New wallets" definition={METRIC_DEFINITIONS.newWallets} kpi={data?.kpis.newWallets} format={formatCount} period={period} dim={dim} />
          </KpiGrid>

          <MetricChart
            id="admin-wallets-chart"
            title="Wallet activity"
            period={data?.period ?? period}
            at={data?.series.map((p) => p.at)}
            quiet={state.kind === "no-data"}
            dim={dim}
            metrics={[
              { key: "active", label: "Active wallets", values: data?.series.map((p) => p.activeWallets) ?? [], format: formatCount, formatAxis: formatCountCompact },
              { key: "new", label: "New wallets", values: data?.series.map((p) => p.newWallets) ?? [], format: formatCount, formatAxis: formatCountCompact },
            ]}
          />

          <Panel className="flex flex-col gap-3 pt-4 md:pt-5">
            <PanelHeader className="px-4 md:px-5" title="By network" subtitle={`Total wallets, and those active in ${periodLong(period)}`} />
            <DataTable
              label="Wallets by network"
              rows={data?.byNetwork}
              columns={columns(period)}
              rowKey={(n) => n.key}
              card={NetworkCard}
              loading={!data}
              empty={{ title: "No wallets yet", description: "Networks will show here once wallets exist." }}
              skeletonRows={5}
            />
          </Panel>
        </>
      )}
    </>
  )
}

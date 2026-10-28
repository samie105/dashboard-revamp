"use client"

/**
 * Admin volume: total volume, number of transactions and the average
 * transaction, each with change vs the previous period; volume and
 * transactions over the period; and volume by network and by product.
 *
 * States (lib/admin/view.ts volumeState): skeletons while loading; the
 * previous period dimmed while a new one loads; one panel instead of the
 * figures for no access, signed out, not connected and failed; a quiet
 * period keeps the KPIs and says so in each section.
 */

import * as React from "react"

import { useAdminVolume } from "@/hooks/admin/useAdminData"
import { formatCount, formatCountCompact, periodLong, volumeState, METRIC_DEFINITIONS } from "@/lib/admin/view"
import { usd, usdCompact } from "@/lib/num"
import { AdminPageHeader, AdminStatePanel, BreakdownPanel, blocksFigures, KpiCard, KpiGrid, MetricChart, useAdminPeriod } from "@/components/admin/admin-kit"

const whole = (v: number) => usd(v, { min: 0, max: 0 })

export function AdminVolumePage() {
  const [period, setPeriod] = useAdminPeriod()
  const query = useAdminVolume(period)
  const state = volumeState({ period, data: query.data, error: query.error })
  const data = state.kind === "loading" ? undefined : query.data
  const dim = state.kind === "switching"
  const retry = () => void query.refetch()

  return (
    <>
      <AdminPageHeader
        title="Volume"
        subtitle={`Money moved through the crypto dashboard across ${periodLong(period)}.`}
        period={period}
        onPeriod={setPeriod}
        asOf={data?.asOf}
        refreshing={query.isFetching && !query.isPending}
        onRefresh={retry}
      />

      {blocksFigures(state) ? (
        <AdminStatePanel state={state} period={period} subject="volume" onRetry={retry} />
      ) : (
        <>
          <KpiGrid columns={3}>
            <KpiCard label="Volume" definition={METRIC_DEFINITIONS.volumeUsd} kpi={data?.kpis.volumeUsd} format={usdCompact} period={period} dim={dim} note={data ? whole(data.kpis.volumeUsd.value) : undefined} />
            <KpiCard label="Transactions" definition={METRIC_DEFINITIONS.transactions} kpi={data?.kpis.transactions} format={formatCount} period={period} dim={dim} />
            <KpiCard label="Average transaction" definition={METRIC_DEFINITIONS.averageUsd} kpi={data?.kpis.averageUsd} format={(v) => usd(v)} period={period} dim={dim} />
          </KpiGrid>

          <MetricChart
            id="admin-volume-chart"
            title="Volume over time"
            period={data?.period ?? period}
            at={data?.series.map((p) => p.at)}
            quiet={state.kind === "no-data"}
            dim={dim}
            metrics={[
              { key: "volume", label: "Volume", values: data?.series.map((p) => p.volumeUsd) ?? [], previous: data?.previousSeries.map((p) => p.volumeUsd), format: whole, formatAxis: usdCompact },
              { key: "transactions", label: "Transactions", values: data?.series.map((p) => p.transactions) ?? [], previous: data?.previousSeries.map((p) => p.transactions), format: formatCount, formatAxis: formatCountCompact },
            ]}
          />

          <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-2">
            <BreakdownPanel title="By network" subtitle={periodLong(period)} items={data?.byNetwork} format={usdCompact} dim={dim} emptyText={`No volume in ${periodLong(period)}.`} />
            <BreakdownPanel title="By product" subtitle={periodLong(period)} items={data?.byProduct} format={usdCompact} dim={dim} emptyText={`No volume in ${periodLong(period)}.`} />
          </div>
        </>
      )}
    </>
  )
}

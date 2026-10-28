"use client"

/**
 * Admin fiat: money in (buy with local currency) and out (sell to a bank
 * account). Buy and sell volume, orders, payout success and payout time,
 * each with change vs the previous period; buy/sell/orders over time; orders
 * by status and volume by currency; and every payout provider's numbers.
 *
 * States (lib/admin/view.ts fiatState): skeletons while loading; the
 * previous period dimmed while a new one loads; one panel instead of the
 * figures for no access, signed out, not connected and failed; a quiet
 * period keeps the KPIs and says so in each section. Provider names are
 * fine here: this is an internal admin screen, not user-facing copy.
 */

import * as React from "react"

import { DataTable, Panel, PanelHeader, type DataColumn } from "@/components/dash"
import { useAdminFiat } from "@/hooks/admin/useAdminData"
import type { AdminPayoutProvider } from "@/lib/admin/types"
import { fiatState, formatCount, formatCountCompact, METRIC_DEFINITIONS, periodLong } from "@/lib/admin/view"
import { usd, usdCompact } from "@/lib/num"
import { AdminPageHeader, AdminStatePanel, BreakdownPanel, blocksFigures, KpiCard, KpiGrid, MetricChart, useAdminPeriod } from "@/components/admin/admin-kit"

const whole = (v: number) => usd(v, { min: 0, max: 0 })
const percent = (v: number) => `${v.toFixed(1)}%`
const minutes = (v: number) => `${v.toFixed(1)} min`

const PROVIDER_COLUMNS: DataColumn<AdminPayoutProvider>[] = [
  { key: "provider", header: "Provider", cell: (p) => <span className="font-semibold text-foreground">{p.label}</span> },
  { key: "payouts", header: "Payouts", align: "right", cell: (p) => <span className="tabular-nums">{formatCount(p.payouts)}</span> },
  { key: "success", header: "Success", align: "right", cell: (p) => <span className="tabular-nums">{(p.successRate * 100).toFixed(1)}%</span> },
  { key: "time", header: "Avg time", align: "right", showFrom: "md", cell: (p) => <span className="tabular-nums text-muted-foreground">{p.averageMinutes === null ? "—" : minutes(p.averageMinutes)}</span> },
]

function ProviderCard(p: AdminPayoutProvider) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-semibold text-foreground">{p.label}</span>
      <span className="text-right text-[12.5px] tabular-nums text-muted-foreground">
        <span className="font-semibold text-foreground">{formatCount(p.payouts)}</span> · {(p.successRate * 100).toFixed(1)}% ok
      </span>
    </div>
  )
}

export function AdminFiatPage() {
  const [period, setPeriod] = useAdminPeriod()
  const query = useAdminFiat(period)
  const state = fiatState({ period, data: query.data, error: query.error })
  const data = state.kind === "loading" ? undefined : query.data
  const dim = state.kind === "switching"
  const retry = () => void query.refetch()

  return (
    <>
      <AdminPageHeader
        title="Fiat"
        subtitle={`Buying crypto with local money and selling it to bank accounts, across ${periodLong(period)}.`}
        period={period}
        onPeriod={setPeriod}
        asOf={data?.asOf}
        refreshing={query.isFetching && !query.isPending}
        onRefresh={retry}
      />

      {blocksFigures(state) ? (
        <AdminStatePanel state={state} period={period} subject="fiat orders" onRetry={retry} />
      ) : (
        <>
          <KpiGrid>
            <KpiCard label="Bought with fiat" definition={METRIC_DEFINITIONS.buyVolumeUsd} kpi={data?.kpis.buyVolumeUsd} format={usdCompact} period={period} dim={dim} />
            <KpiCard label="Sold to bank" definition={METRIC_DEFINITIONS.sellVolumeUsd} kpi={data?.kpis.sellVolumeUsd} format={usdCompact} period={period} dim={dim} />
            <KpiCard label="Payout success" definition={METRIC_DEFINITIONS.payoutSuccessPct} compare="absolute" kpi={data?.kpis.payoutSuccessPct} format={percent} period={period} dim={dim} />
            <KpiCard label="Avg payout time" definition={METRIC_DEFINITIONS.averagePayoutMinutes} compare="absolute" lowerIsBetter kpi={data?.kpis.averagePayoutMinutes} format={minutes} period={period} dim={dim} note={data ? `${formatCount(data.kpis.orders.value)} orders` : undefined} />
          </KpiGrid>

          <MetricChart
            id="admin-fiat-chart"
            title="Fiat activity"
            period={data?.period ?? period}
            at={data?.series.map((p) => p.at)}
            quiet={state.kind === "no-data"}
            dim={dim}
            metrics={[
              { key: "buy", label: "Bought", values: data?.series.map((p) => p.buyUsd) ?? [], previous: data?.previousSeries.map((p) => p.buyUsd), format: whole, formatAxis: usdCompact },
              { key: "sell", label: "Sold", values: data?.series.map((p) => p.sellUsd) ?? [], previous: data?.previousSeries.map((p) => p.sellUsd), format: whole, formatAxis: usdCompact },
              { key: "orders", label: "Orders", values: data?.series.map((p) => p.orders) ?? [], previous: data?.previousSeries.map((p) => p.orders), format: formatCount, formatAxis: formatCountCompact },
            ]}
          />

          <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-2">
            <BreakdownPanel title="Orders by status" subtitle={periodLong(period)} items={data?.ordersByStatus} format={formatCount} dim={dim} emptyText={`No fiat orders in ${periodLong(period)}.`} />
            <BreakdownPanel title="Volume by currency" subtitle={periodLong(period)} items={data?.volumeByCurrency} format={usdCompact} dim={dim} emptyText={`No fiat volume in ${periodLong(period)}.`} />
          </div>

          <Panel className="flex flex-col gap-3 pt-4 md:pt-5">
            <PanelHeader className="px-4 md:px-5" title="Payout providers" subtitle={`Bank payouts by provider, ${periodLong(period)}`} />
            <DataTable
              label="Payout providers"
              rows={data?.payoutProviders}
              columns={PROVIDER_COLUMNS}
              rowKey={(p) => p.key}
              card={ProviderCard}
              loading={!data}
              empty={{ title: "No payouts in this period", description: `No bank payouts were made in ${periodLong(period)}.` }}
              skeletonRows={4}
            />
          </Panel>
        </>
      )}
    </>
  )
}

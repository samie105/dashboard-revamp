"use client"

/**
 * Admin wallets: total wallets and wallets active in the chosen period.
 *
 * States (lib/admin/view.ts walletsState): skeleton tiles while loading; the
 * previous period dimmed while a new one loads; one panel instead of the
 * figures for no access, signed out, not connected, failed and no wallets at
 * all; the tiles plus a "no activity" panel when the period was quiet.
 */

import * as React from "react"

import { DashScope, Panel } from "@/components/dash"
import { useAdminWallets } from "@/hooks/admin/useAdminData"
import type { AdminPeriod } from "@/lib/admin/types"
import { activeShare, formatCount, periodLong, walletsState } from "@/lib/admin/view"
import { ADMIN_PAGE, AdminHeader, AdminStatePanel, PeriodTabs, StatTile, blocksFigures } from "@/components/admin/admin-kit"

export function AdminWalletsPage() {
  const [period, setPeriod] = React.useState<AdminPeriod>("7d")
  const query = useAdminWallets(period)
  const state = walletsState({ period, data: query.data, error: query.error })
  const data = state.kind === "loading" ? undefined : query.data
  const dim = state.kind === "switching"

  return (
    <DashScope className={ADMIN_PAGE}>
      <AdminHeader title="Wallets" subtitle={`Wallets created and in use across ${periodLong(period)}.`} action={<PeriodTabs value={period} onChange={setPeriod} />} />

      {blocksFigures(state) ? (
        <Panel>
          <AdminStatePanel state={state} period={period} subject="wallets" onRetry={() => void query.refetch()} />
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5">
            <StatTile label="Total wallets" value={data ? formatCount(data.total) : null} sub="All time" dim={dim} />
            <StatTile
              label="Active wallets"
              value={data ? formatCount(data.active) : null}
              sub={data ? `${activeShare(data.active, data.total)} of all wallets · ${periodLong(data.period)}` : undefined}
              dim={dim}
            />
          </div>
          {state.kind === "no-data" && (
            <Panel>
              <AdminStatePanel state={state} period={period} subject="wallets" onRetry={() => void query.refetch()} />
            </Panel>
          )}
        </>
      )}
    </DashScope>
  )
}

"use client"

/**
 * Admin users: total, active and new users with change vs the previous
 * period; active and new users over the period; and a searchable, paged
 * list of users (labels are masked by the backend; the frontend never sees
 * a full email).
 *
 * States (lib/admin/view.ts usersState): skeletons while loading; the
 * previous period dimmed while a new one loads; the old rows dimmed while a
 * new search or page loads; one panel instead of the figures for no access,
 * signed out, not connected, failed and no users at all; "no matches" for a
 * search that finds nobody; a quiet period keeps the totals and says so.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon, ArrowRight01Icon, Search01Icon } from "@hugeicons/core-free-icons"

import { DataTable, NeutralButton, Panel, PanelHeader, StatusBadge, type DataColumn } from "@/components/dash"
import { useAdminUsers } from "@/hooks/admin/useAdminData"
import type { AdminUserRow, AdminUserSort } from "@/lib/admin/types"
import { activeShare, formatCount, formatCountCompact, periodLong, timeAgo, usersState, METRIC_DEFINITIONS } from "@/lib/admin/view"
import { usd, usdCompact } from "@/lib/num"
import { cn } from "@/lib/utils"
import { CsvButton, MiniSelect, UserSheet } from "@/components/admin/details"
import { AdminPageHeader, AdminStatePanel, blocksFigures, KpiCard, KpiGrid, MetricChart, useAdminPeriod } from "@/components/admin/admin-kit"

const PAGE_SIZE = 20

const joined = (at: string) => new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })

/** The first cell is a real button, so a keyboard user can open a row too. */
function userColumns(open: (u: AdminUserRow) => void): DataColumn<AdminUserRow>[] {
  return [
    {
      key: "user",
      header: "User",
      cell: (u) => (
        <button type="button" onClick={(e) => { e.stopPropagation(); open(u) }} className="rounded font-medium text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/60">
          {u.userLabel}
        </button>
      ),
    },
    { key: "joined", header: "Joined", showFrom: "md", cell: (u) => <span className="tabular-nums text-muted-foreground">{joined(u.joinedAt)}</span> },
    { key: "active", header: "Last active", cell: (u) => <span className="tabular-nums text-muted-foreground">{timeAgo(u.lastActiveAt)}</span> },
    { key: "wallets", header: "Wallets", align: "right", showFrom: "lg", cell: (u) => <span className="tabular-nums">{u.wallets}</span> },
    { key: "volume", header: "Volume", align: "right", cell: (u) => <span className="font-semibold tabular-nums text-foreground">{usdCompact(u.volumeUsd)}</span> },
    { key: "status", header: "Status", align: "right", cell: (u) => <StatusBadge tone={u.status === "active" ? "success" : "neutral"} label={u.status} /> },
  ]
}

const SORT_OPTIONS: readonly { key: AdminUserSort; label: string }[] = [
  { key: "joined", label: "Newest" },
  { key: "lastActive", label: "Recently active" },
  { key: "volume", label: "Highest volume" },
]

function UserCard(u: AdminUserRow) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[13.5px] font-semibold text-foreground">{u.userLabel}</span>
        <span className="truncate text-[12px] text-muted-foreground">Joined {joined(u.joinedAt)} · active {timeAgo(u.lastActiveAt)} · {usd(u.volumeUsd, { min: 0, max: 0 })}</span>
      </div>
      <StatusBadge tone={u.status === "active" ? "success" : "neutral"} label={u.status} />
    </div>
  )
}

/** Typing settles for 300ms before a search request goes out. */
function useDebounced<T>(value: T, ms = 300): T {
  const [settled, setSettled] = React.useState(value)
  React.useEffect(() => {
    const id = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return settled
}

export function AdminUsersPage() {
  const [period, setPeriod] = useAdminPeriod()
  const [searchText, setSearchText] = React.useState("")
  const search = useDebounced(searchText.trim())
  const [page, setPage] = React.useState(1)
  const [sort, setSort] = React.useState<AdminUserSort>("joined")
  const [opened, setOpened] = React.useState<AdminUserRow | null>(null)
  const columns = React.useMemo(() => userColumns(setOpened), [])
  // A new search or period starts from the first page.
  React.useEffect(() => setPage(1), [search, period, sort])

  const query = useAdminUsers(period, { search, page, pageSize: PAGE_SIZE, sort })
  const state = usersState({ period, data: query.data, error: query.error })
  const data = state.kind === "loading" ? undefined : query.data
  const dim = state.kind === "switching"
  const rowsStale = dim || query.isPlaceholderData
  const retry = () => void query.refetch()
  const list = data?.users
  const pages = list ? Math.max(1, Math.ceil(list.totalMatching / list.pageSize)) : 1

  return (
    <>
      <AdminPageHeader
        title="Users"
        subtitle={`Who signed up and who was active across ${periodLong(period)}.`}
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
          <KpiGrid columns={3}>
            <KpiCard label="Total users" definition={METRIC_DEFINITIONS.totalUsers} compare="absolute" kpi={data?.kpis.totalUsers} format={formatCount} period={period} dim={dim} />
            <KpiCard
              label="Active users" definition={METRIC_DEFINITIONS.activeUsers}
              kpi={data?.kpis.activeUsers}
              format={formatCount}
              period={period}
              dim={dim}
              note={data ? `${activeShare(data.kpis.activeUsers.value, data.kpis.totalUsers.value)} of all users` : undefined}
            />
            <KpiCard label="New users" definition={METRIC_DEFINITIONS.newUsers} kpi={data?.kpis.newUsers} format={formatCount} period={period} dim={dim} />
          </KpiGrid>

          <MetricChart
            id="admin-users-chart"
            title="User activity"
            period={data?.period ?? period}
            at={data?.series.map((p) => p.at)}
            quiet={state.kind === "no-data"}
            dim={dim}
            metrics={[
              { key: "active", label: "Active users", values: data?.series.map((p) => p.activeUsers) ?? [], previous: data?.previousSeries.map((p) => p.activeUsers), format: formatCount, formatAxis: formatCountCompact },
              { key: "new", label: "New users", values: data?.series.map((p) => p.newUsers) ?? [], previous: data?.previousSeries.map((p) => p.newUsers), format: formatCount, formatAxis: formatCountCompact },
            ]}
          />

          <Panel className="flex flex-col gap-3 pt-4 md:pt-5">
            <div className="flex flex-col gap-3 px-4 md:flex-row md:items-start md:justify-between md:px-5">
              <PanelHeader title="All users" subtitle={list ? `${formatCount(list.totalMatching)} ${list.search ? "matching" : "users"} · active means active in ${periodLong(period)}` : "Loading users"} />
              <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">
              <MiniSelect label="Sort" value={sort} options={SORT_OPTIONS} onChange={setSort} />
              <CsvButton
                label="Export page"
                filename={`worldstreet-users-${period}-page${list?.page ?? 1}-${new Date().toISOString().slice(0, 10)}.csv`}
                header={["User ID", "User", "Joined (UTC)", "Last active (UTC)", "Wallets", "Volume (USD)", `Status (${period})`]}
                rows={(list?.rows ?? []).map((u) => [u.id, u.userLabel, u.joinedAt, u.lastActiveAt, u.wallets, u.volumeUsd, u.status])}
              />
              <label className="flex h-9 w-full items-center gap-2 rounded-full border border-foreground/[0.08] bg-foreground/[0.025] px-3 focus-within:ring-2 focus-within:ring-primary/60 md:w-72">
                <HugeiconsIcon icon={Search01Icon} className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                <span className="sr-only">Search users</span>
                <input
                  type="search"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search by email or user ID"
                  maxLength={100}
                  className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/70"
                />
              </label>
              </div>
            </div>
            <div className={cn("transition-opacity", rowsStale && list && "opacity-55")} aria-busy={rowsStale}>
              <DataTable
                label="Users"
                rows={list?.rows}
                columns={columns}
                onRowClick={setOpened}
                rowKey={(u) => u.id}
                card={UserCard}
                loading={!list}
                empty={list?.search ? { title: "No users match", description: `Nobody matches “${list.search}”. Check the spelling or search by user ID.` } : { title: "No users yet", description: "Users will show here once people sign up." }}
                skeletonRows={8}
              />
            </div>
            {list && list.totalMatching > list.pageSize && (
              <div className="flex items-center justify-between gap-3 border-t border-foreground/[0.06] px-4 py-3 md:px-5">
                <span className="text-[12.5px] tabular-nums text-muted-foreground">
                  Page {list.page} of {pages}
                </span>
                <div className="flex items-center gap-2">
                  <NeutralButton onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={list.page <= 1 || query.isFetching} aria-label="Previous page">
                    <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" strokeWidth={1.8} />
                  </NeutralButton>
                  <NeutralButton onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={list.page >= pages || query.isFetching} aria-label="Next page">
                    <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" strokeWidth={1.8} />
                  </NeutralButton>
                </div>
              </div>
            )}
          </Panel>
          <UserSheet user={opened} periodText={periodLong(period)} onClose={() => setOpened(null)} />
        </>
      )}
    </>
  )
}

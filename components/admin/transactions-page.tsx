"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"

import { DataTable, NeutralButton, Panel, PanelHeader, StatusBadge, type DataColumn } from "@/components/dash"
import { useAdminTransactions, useReconcileAdminTransaction } from "@/hooks/admin/useAdminData"
import type { AdminTransactionRow, AdminTransactionStatus } from "@/lib/admin/types"
import { adminErrorState, timeAgo } from "@/lib/admin/view"
import { usd } from "@/lib/num"
import { AdminPageHeader, AdminStatePanel, useAdminPeriod } from "@/components/admin/admin-kit"
import { MiniSelect } from "@/components/admin/details"

const PAGE_SIZE = 25
const STATUS_OPTIONS: readonly { key: AdminTransactionStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "submitted", label: "Submitted" },
  { key: "unknown", label: "Unknown" },
  { key: "confirmed", label: "Confirmed" },
  { key: "failed", label: "Failed" },
]

function statusTone(status: AdminTransactionStatus): "success" | "info" | "danger" | "warning" {
  if (status === "confirmed") return "success"
  if (status === "failed") return "danger"
  if (status === "unknown") return "warning"
  return "info"
}

function ReconcileAction({ row, onDone }: { row: AdminTransactionRow; onDone: (message: string) => void }) {
  const reconcile = useReconcileAdminTransaction()
  if (row.status !== "submitted" && row.status !== "unknown") return null
  return <NeutralButton size="md" busy={reconcile.isPending} onClick={() => reconcile.mutate(row.id, { onSuccess: (result) => onDone(`${row.id}: ${result.providerStatus} (${result.status})`), onError: () => onDone(`${row.id}: reconciliation failed`) })}>Reconcile</NeutralButton>
}

function amountLabel(row: AdminTransactionRow) {
  const usdLabel = usd(row.amountUsd)
  if (!row.amountDisplay) return usdLabel
  return <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap"><span>{row.amountDisplay}</span>{row.amountUsd !== null && <span className="text-[11px] text-muted-foreground">({usdLabel})</span>}</span>
}

export function AdminTransactionsPage() {
  const [period, setPeriod] = useAdminPeriod()
  const [status, setStatus] = React.useState<AdminTransactionStatus | "all">("all")
  const [page, setPage] = React.useState(1)
  const [message, setMessage] = React.useState<string | null>(null)
  React.useEffect(() => setPage(1), [period, status])
  const query = useAdminTransactions({ period, status: status === "all" ? undefined : status, page, pageSize: PAGE_SIZE })
  const data = query.data
  const failed = !data && query.error ? adminErrorState(query.error) : null
  const pages = data ? Math.max(1, Math.ceil(data.totalMatching / data.pageSize)) : 1
  const columns = React.useMemo<DataColumn<AdminTransactionRow>[]>(() => [
    { key: "when", header: "When (UTC)", cell: (row) => <span className="whitespace-nowrap tabular-nums text-muted-foreground" title={row.at}>{timeAgo(row.at)}</span> },
    { key: "user", header: "User", cell: (row) => <span className="font-medium text-foreground">{row.userLabel}</span> },
    { key: "action", header: "Action", cell: (row) => row.action },
    { key: "network", header: "Network", cell: (row) => <span className="text-muted-foreground">{row.networkLabel}</span>, showFrom: "md" },
    { key: "amount", header: "Amount", align: "right", cell: (row) => <span className="tabular-nums">{amountLabel(row)}</span> },
    { key: "status", header: "Status", align: "right", cell: (row) => <StatusBadge tone={statusTone(row.status)} label={row.status} /> },
  ], [])
  const card = React.useCallback((row: AdminTransactionRow) => (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[13.5px] font-semibold text-foreground">{row.action} · {row.networkLabel}</span>
        <span className="truncate text-[12px] text-muted-foreground">{row.userLabel} · {row.amountDisplay ?? usd(row.amountUsd)} · {timeAgo(row.at)}</span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2"><StatusBadge tone={statusTone(row.status)} label={row.status} /><ReconcileAction row={row} onDone={setMessage} /></div>
    </div>
  ), [])

  return (
    <>
      <AdminPageHeader title="Transactions" subtitle={`Broadcast transaction records across ${period}.`} period={period} onPeriod={setPeriod} asOf={data?.asOf} refreshing={query.isFetching && !query.isPending} onRefresh={() => void query.refetch()} />
      {failed ? <AdminStatePanel state={failed} period={period} subject="transactions" onRetry={() => void query.refetch()} /> : (
        <Panel className="flex flex-col gap-3 pt-4 md:pt-5">
          {message && <p role="status" className="mx-4 rounded-xl border border-warning/30 bg-warning/[0.08] px-3 py-2 text-[12.5px] font-semibold md:mx-5">{message}</p>}
          {data?.warnings?.[0] && <p className="mx-4 rounded-xl border border-warning/20 bg-warning/[0.05] px-3 py-2 text-[12px] text-muted-foreground md:mx-5">{data.warnings[0]}</p>}
          <div className="flex flex-col gap-3 px-4 md:flex-row md:items-start md:justify-between md:px-5">
            <PanelHeader title="Records" subtitle={data ? `${data.totalMatching.toLocaleString("en-US")} matching` : "Loading records"} />
            <MiniSelect label="Status" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
          </div>
          <DataTable label="Transactions" rows={data?.rows} columns={columns} rowKey={(row) => row.id} card={card} loading={!data} empty={{ title: "No transaction records", description: "Broadcast records will appear here." }} skeletonRows={8} />
          {data && data.totalMatching > data.pageSize && <div className="flex items-center justify-between gap-3 border-t border-foreground/[0.06] px-4 py-3 md:px-5"><span className="text-[12.5px] tabular-nums text-muted-foreground">Page {data.page} of {pages}</span><div className="flex items-center gap-2"><NeutralButton onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={data.page <= 1 || query.isFetching} aria-label="Previous page"><HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" strokeWidth={1.8} /></NeutralButton><NeutralButton onClick={() => setPage((value) => Math.min(pages, value + 1))} disabled={data.page >= pages || query.isFetching} aria-label="Next page"><HugeiconsIcon icon={ArrowRight01Icon} className="size-4" strokeWidth={1.8} /></NeutralButton></div></div>}
        </Panel>
      )}
    </>
  )
}

"use client"

/**
 * Admin audit log: who did what in the console, newest first, filterable by
 * action and paged. Page views and sign-ins are recorded by the backend as it
 * serves them; CSV exports (built in the browser) are reported by
 * CsvButton through adminData.recordEvent.
 *
 * States: skeleton rows while loading; old rows dimmed while another page or
 * filter loads; one panel for no access, signed out, not connected and
 * failed; "nothing recorded" / "no entries match" when empty.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"

import { DataTable, NeutralButton, Panel, PanelHeader, StatusBadge, type DataColumn } from "@/components/dash"
import { useAdminAuditLog } from "@/hooks/admin/useAdminData"
import { ADMIN_AUDIT_ACTIONS, type AdminAuditAction, type AdminAuditEntry } from "@/lib/admin/types"
import { adminErrorState, AUDIT_ACTION_LABEL, auditActionChanges, timeAgo } from "@/lib/admin/view"
import { cn } from "@/lib/utils"
import { MiniSelect } from "@/components/admin/details"
import { AdminPageHeader, AdminStatePanel } from "@/components/admin/admin-kit"

const PAGE_SIZE = 25

const at = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })

const COLUMNS: DataColumn<AdminAuditEntry>[] = [
  { key: "when", header: "When (UTC)", cell: (e) => <span className="whitespace-nowrap tabular-nums text-muted-foreground" title={timeAgo(e.at)}>{at(e.at)}</span> },
  { key: "who", header: "Admin", cell: (e) => <span className="font-medium text-foreground">{e.actorLabel}</span> },
  { key: "action", header: "Action", cell: (e) => <StatusBadge tone={auditActionChanges(e.action) ? "warning" : "neutral"} label={AUDIT_ACTION_LABEL[e.action]} /> },
  { key: "target", header: "On", cell: (e) => <span className="text-foreground">{e.target}</span> },
  { key: "ip", header: "IP", showFrom: "lg", align: "right", cell: (e) => <span className="font-mono text-[12px] text-muted-foreground">{e.ipLabel}</span> },
]

function EntryCard(e: AdminAuditEntry) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[13.5px] font-semibold text-foreground">{AUDIT_ACTION_LABEL[e.action]} · {e.target}</span>
        <span className="truncate text-[12px] text-muted-foreground">{e.actorLabel} · {timeAgo(e.at)}</span>
      </div>
      {auditActionChanges(e.action) && <StatusBadge tone="warning" label="Change" />}
    </div>
  )
}

const ACTION_OPTIONS: readonly { key: AdminAuditAction | "all"; label: string }[] = [{ key: "all", label: "All" }, ...ADMIN_AUDIT_ACTIONS.map((a) => ({ key: a, label: AUDIT_ACTION_LABEL[a] }))]

export function AdminAuditPage() {
  const [action, setAction] = React.useState<AdminAuditAction | "all">("all")
  const [page, setPage] = React.useState(1)
  React.useEffect(() => setPage(1), [action])
  const query = useAdminAuditLog({ action: action === "all" ? undefined : action, page, pageSize: PAGE_SIZE })
  const data = query.data
  const failed = !data && query.error ? adminErrorState(query.error) : null
  const stale = query.isPlaceholderData
  const pages = data ? Math.max(1, Math.ceil(data.totalMatching / data.pageSize)) : 1
  const retry = () => void query.refetch()

  return (
    <>
      <AdminPageHeader title="Audit log" subtitle="Who did what in the admin console, newest first." asOf={data?.asOf} refreshing={query.isFetching && !query.isPending} onRefresh={retry} />
      {failed ? (
        <AdminStatePanel state={failed} period="7d" subject="audit entries" onRetry={retry} />
      ) : (
        <Panel className="flex flex-col gap-3 pt-4 md:pt-5">
          <div className="flex flex-col gap-3 px-4 md:flex-row md:items-start md:justify-between md:px-5">
            <PanelHeader title="Entries" subtitle={data ? `${data.totalMatching.toLocaleString("en-US")} ${data.action ? "matching" : "recorded"}` : "Loading entries"} />
            <MiniSelect label="Action" value={action} options={ACTION_OPTIONS} onChange={setAction} />
          </div>
          <div className={cn("transition-opacity", stale && "opacity-55")} aria-busy={stale}>
            <DataTable
              label="Audit log"
              rows={data?.rows}
              columns={COLUMNS}
              rowKey={(e) => e.id}
              card={EntryCard}
              loading={!data}
              empty={data?.action ? { title: "No entries match", description: "Nothing recorded for this action. Try All." } : { title: "Nothing recorded yet", description: "Admin actions will be listed here as they happen." }}
              skeletonRows={8}
            />
          </div>
          {data && data.totalMatching > data.pageSize && (
            <div className="flex items-center justify-between gap-3 border-t border-foreground/[0.06] px-4 py-3 md:px-5">
              <span className="text-[12.5px] tabular-nums text-muted-foreground">Page {data.page} of {pages}</span>
              <div className="flex items-center gap-2">
                <NeutralButton onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={data.page <= 1 || query.isFetching} aria-label="Previous page">
                  <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" strokeWidth={1.8} />
                </NeutralButton>
                <NeutralButton onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={data.page >= pages || query.isFetching} aria-label="Next page">
                  <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" strokeWidth={1.8} />
                </NeutralButton>
              </div>
            </div>
          )}
        </Panel>
      )}
    </>
  )
}

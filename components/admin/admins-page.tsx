"use client"

import * as React from "react"

import { GoldButton, NeutralButton, Panel, PanelHeader, StatusBadge } from "@/components/dash"
import { useAdminMembers, useInviteAdmin, useRevokeAdminMember, useUpdateAdminMember } from "@/hooks/admin/useAdminData"
import { ADMIN_ROLES, type AdminAccountStatus, type AdminMember, type AdminRole } from "@/lib/admin/types"
import { AdminPageHeader } from "@/components/admin/admin-kit"

const ROLE_OPTIONS: readonly { value: AdminRole; label: string }[] = [
  { value: "viewer", label: "Viewer" },
  { value: "operations", label: "Operations" },
  { value: "finance", label: "Finance" },
  { value: "super_admin", label: "Super admin" },
]

function statusTone(status: AdminAccountStatus): "success" | "warning" | "danger" | "neutral" {
  if (status === "active") return "success"
  if (status === "invited") return "warning"
  if (status === "suspended") return "danger"
  return "neutral"
}

function displayDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "—"
}

function roleLabel(role: AdminRole): string {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role
}

export function AdminMembersPage() {
  const query = useAdminMembers()
  const invite = useInviteAdmin()
  const update = useUpdateAdminMember()
  const revoke = useRevokeAdminMember()
  const [email, setEmail] = React.useState("")
  const [displayName, setDisplayName] = React.useState("")
  const [role, setRole] = React.useState<AdminRole>("viewer")
  const [message, setMessage] = React.useState<string | null>(null)

  const submitInvite = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)
    invite.mutate({ email, displayName: displayName || undefined, role }, {
      onSuccess: () => {
        setEmail("")
        setDisplayName("")
        setMessage("Invitation sent. The admin can open the one-time link from their email.")
      },
      onError: (error) => setMessage(error instanceof Error ? error.message : "The invitation could not be sent."),
    })
  }

  const changeRole = (admin: AdminMember, nextRole: AdminRole) => {
    if (nextRole === admin.role) return
    update.mutate({ adminId: admin.id, role: nextRole }, { onError: (error) => setMessage(error instanceof Error ? error.message : "The role could not be changed.") })
  }

  const toggleSuspension = (admin: AdminMember) => {
    update.mutate({ adminId: admin.id, status: admin.status === "suspended" ? "active" : "suspended" }, { onError: (error) => setMessage(error instanceof Error ? error.message : "The admin account could not be updated.") })
  }

  return (
    <>
      <AdminPageHeader title="Admins" subtitle="Invite and manage the separate WorldStreet operations identities." asOf={query.data?.asOf} refreshing={query.isFetching && !query.isPending} onRefresh={() => void query.refetch()} />
      {message && <p role="status" className="rounded-xl border border-warning/30 bg-warning/[0.08] px-4 py-3 text-[13px] font-semibold text-foreground">{message}</p>}

      <Panel className="flex flex-col gap-4 p-4 md:p-5">
        <PanelHeader title="Invite an admin" subtitle="The recipient does not need a WorldStreet customer account or Clerk identity." />
        <form onSubmit={submitInvite} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_auto] md:items-end">
          <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-muted-foreground">Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-10 rounded-xl border border-foreground/[0.09] bg-background px-3 text-[13px] font-normal text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/60" placeholder="admin@example.com" /></label>
          <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-muted-foreground">Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="h-10 rounded-xl border border-foreground/[0.09] bg-background px-3 text-[13px] font-normal text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/60" placeholder="Operations lead" /></label>
          <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-muted-foreground">Role<select value={role} onChange={(event) => setRole(event.target.value as AdminRole)} className="h-10 rounded-xl border border-foreground/[0.09] bg-background px-3 text-[13px] font-normal text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/60">{ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <GoldButton type="submit" busy={invite.isPending}>Send invite</GoldButton>
        </form>
      </Panel>

      <Panel className="flex flex-col gap-3 p-4 md:p-5">
        <PanelHeader title="Admin accounts" subtitle={query.data ? `${query.data.admins.length} configured account${query.data.admins.length === 1 ? "" : "s"}` : "Loading accounts"} />
        {query.isError ? <p className="rounded-xl border border-debit/20 bg-debit/[0.06] px-4 py-3 text-sm text-foreground">The admin directory could not be loaded. Refresh and try again.</p> : (
          <div className="divide-y divide-foreground/[0.06] rounded-2xl border border-foreground/[0.08]">
            {(query.data?.admins ?? []).map((admin) => (
              <article key={admin.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-semibold text-foreground">{admin.displayName || admin.email}</p>
                  <p className="truncate text-[12px] text-muted-foreground">{admin.email} · joined {displayDate(admin.createdAt)} · last sign-in {displayDate(admin.lastLoginAt)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={statusTone(admin.status)} label={admin.status} />
                  <select aria-label={`Role for ${admin.email}`} value={admin.role} disabled={admin.status === "revoked" || update.isPending} onChange={(event) => changeRole(admin, event.target.value as AdminRole)} className="h-9 rounded-xl border border-foreground/[0.09] bg-background px-2 text-[12px] font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-60">
                    {ADMIN_ROLES.map((value) => <option key={value} value={value}>{roleLabel(value)}</option>)}
                  </select>
                  {admin.status !== "revoked" && <NeutralButton size="md" busy={update.isPending} onClick={() => toggleSuspension(admin)}>{admin.status === "suspended" ? "Restore" : "Suspend"}</NeutralButton>}
                  {admin.status !== "revoked" && <NeutralButton size="md" busy={revoke.isPending} onClick={() => { if (window.confirm(`Revoke ${admin.email}?`)) revoke.mutate(admin.id, { onError: (error) => setMessage(error instanceof Error ? error.message : "The admin could not be revoked.") }) }}>Revoke</NeutralButton>}
                </div>
              </article>
            ))}
            {!query.isPending && (query.data?.admins.length ?? 0) === 0 && <p className="p-5 text-sm text-muted-foreground">No admin accounts have been configured yet. Use the bootstrap email flow first.</p>}
          </div>
        )}
      </Panel>
    </>
  )
}


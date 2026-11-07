"use client"

import * as React from "react"

import { GoldButton, NeutralButton, Panel, PanelHeader, StatusBadge } from "@/components/dash"
import { useAdminControls, useReconcileAdminTransaction, useUpdateAdminControl } from "@/hooks/admin/useAdminData"
import { AdminDataError, type AdminControl, type AdminControlKey } from "@/lib/admin/types"
import { adminErrorState, timeAgo } from "@/lib/admin/view"
import { AdminPageHeader, AdminStatePanel, useAdminPeriod } from "@/components/admin/admin-kit"

const LABELS: Record<AdminControlKey, { label: string; description: string }> = {
  wallet_operations: { label: "Wallet operations", description: "Stops new wallet transaction intents and submissions while leaving read-only views available." },
  launchpad_solana: { label: "Solana launchpad", description: "Pauses new Solana launchpad actions without changing existing records." },
  launchpad_ethereum: { label: "Ethereum launchpad", description: "This lane is not implemented yet and remains unavailable." },
  launchpad_intertrain: { label: "Intertrain launchpad", description: "This lane is not implemented yet and remains unavailable." },
}

function tone(control: AdminControl): "success" | "warning" | "neutral" {
  if (control.state === "soon") return "neutral"
  return control.effectivePaused ? "warning" : "success"
}

function stateLabel(control: AdminControl): string {
  if (control.state === "soon") return "Soon"
  if (control.effectivePaused) return "Paused"
  return "Live"
}

export function AdminOperationsPage() {
  const [period] = useAdminPeriod()
  const query = useAdminControls()
  const update = useUpdateAdminControl()
  const reconcile = useReconcileAdminTransaction()
  const [reasons, setReasons] = React.useState<Record<string, string>>({})
  const [transactionId, setTransactionId] = React.useState("")
  const [message, setMessage] = React.useState<string | null>(null)
  const failed = !query.data && query.error ? adminErrorState(query.error) : null

  const setReason = (key: string, value: string) => setReasons((current) => ({ ...current, [key]: value }))
  const save = (control: AdminControl) => {
    const reason = (reasons[control.key] ?? "").trim()
    if (!reason) {
      setMessage("Add a reason before changing an operational control.")
      return
    }
    setMessage(null)
    update.mutate({ key: control.key, paused: !control.effectivePaused, reason, expectedVersion: control.version }, {
      onSuccess: () => setReason(control.key, ""),
      onError: (error) => setMessage(error instanceof AdminDataError && error.kind === "forbidden" ? "Your admin role can view controls but cannot change them." : "The control changed or could not be updated. Refresh and try again."),
    })
  }

  const runReconcile = () => {
    const id = transactionId.trim()
    if (!id) {
      setMessage("Enter a transaction record ID first.")
      return
    }
    setMessage(null)
    reconcile.mutate(id, {
      onSuccess: (result) => setMessage(`Provider status: ${result.providerStatus}. Record status: ${result.status}.`),
      onError: () => setMessage("The transaction could not be reconciled. Check the record ID and try again."),
    })
  }

  return (
    <>
      <AdminPageHeader title="Operations" subtitle="Safely pause product lanes and reconcile a broadcast transaction." asOf={query.data?.asOf} refreshing={query.isFetching && !query.isPending} onRefresh={() => void query.refetch()} />
      {failed ? (
        <AdminStatePanel state={failed} period={period} subject="operational controls" onRetry={() => void query.refetch()} />
      ) : (
        <>
          {message && <p role="status" className="rounded-xl border border-warning/30 bg-warning/[0.08] px-4 py-3 text-[13px] font-semibold text-foreground">{message}</p>}
          <Panel className="flex flex-col gap-4 p-4 md:p-5">
            <PanelHeader title="Operational controls" subtitle="Every change requires a reason and the version currently shown on screen." />
            <div className="grid gap-3 md:grid-cols-2">
              {query.data?.controls.map((control) => {
                const info = LABELS[control.key]
                const disabled = control.state === "soon" || control.configuredByEnv || update.isPending
                return (
                  <article key={control.key} className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="font-display text-[16px] font-semibold text-foreground">{info.label}</h2>
                        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{info.description}</p>
                      </div>
                      <StatusBadge tone={tone(control)} label={stateLabel(control)} />
                    </div>
                    {control.configuredByEnv && <p className="mt-3 text-[12px] font-semibold text-warning">Locked by the server environment. Change the backend environment and restart it to alter this state.</p>}
                    {control.updatedAt && <p className="mt-3 text-[11.5px] text-muted-foreground">Version {control.version} · updated {timeAgo(control.updatedAt)}</p>}
                    <label className="mt-3 flex flex-col gap-1.5 text-[12px] font-semibold text-muted-foreground">
                      Reason
                      <input value={reasons[control.key] ?? ""} onChange={(event) => setReason(control.key, event.target.value)} disabled={disabled} maxLength={500} placeholder={control.effectivePaused ? "Why are you resuming it?" : "Why are you pausing it?"} className="h-10 rounded-xl border border-foreground/[0.09] bg-background px-3 text-[13px] font-normal text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-60" />
                    </label>
                    <div className="mt-3 flex justify-end">
                      <GoldButton onClick={() => save(control)} disabled={disabled} busy={update.isPending}>{control.effectivePaused ? "Resume" : "Pause"} {info.label}</GoldButton>
                    </div>
                  </article>
                )
              }) ?? <p className="text-[13px] text-muted-foreground">Loading controls…</p>}
            </div>
          </Panel>

          <Panel className="flex flex-col gap-4 p-4 md:p-5">
            <PanelHeader title="Transaction reconciliation" subtitle="Re-checks provider status for an existing broadcast. It never broadcasts or changes immutable transaction facts." />
            <div className="flex flex-col gap-2 sm:flex-row">
              <input value={transactionId} onChange={(event) => setTransactionId(event.target.value)} placeholder="Transaction record ID" className="h-11 min-w-0 flex-1 rounded-xl border border-foreground/[0.09] bg-background px-3 text-[13px] font-mono text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/60" />
              <div className="flex gap-2">
                <NeutralButton onClick={() => setTransactionId("")} disabled={!transactionId || reconcile.isPending}>Clear</NeutralButton>
                <GoldButton onClick={runReconcile} busy={reconcile.isPending}>Reconcile</GoldButton>
              </div>
            </div>
          </Panel>
        </>
      )}
    </>
  )
}


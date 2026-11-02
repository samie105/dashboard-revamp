"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { CardShell } from "@/components/ui/system"
import { FlowCta, InlineNotice } from "@/components/ui/flow"
import { DEFAULT_GRANT_FORM, describeGrant, type GrantForm } from "@/lib/copy-trading/forms"
import type { Delegation } from "@/lib/copy-trading/types"
import { Field, KindToggles, StatusChip } from "./parts"

export type AccessStage = "idle" | "prepare" | "grant" | "venue" | "activate" | "done"

const STAGE_TEXT: Record<AccessStage, string> = {
  idle: "",
  prepare: "Creating a trade-only key…",
  grant: "Signing your limits with your wallet…",
  venue: "Approving the key on Hyperliquid (trade only)…",
  activate: "Confirming with Hyperliquid…",
  done: "Trading access is on.",
}

export function AccessPanel({ delegations, loading, blocker, stage, onCreate, onRevoke }: {
  delegations: Delegation[]
  loading: boolean
  blocker: string | null
  stage: AccessStage
  onCreate: (form: GrantForm) => void
  onRevoke: (d: Delegation) => void
}) {
  const [form, setForm] = React.useState<GrantForm>(DEFAULT_GRANT_FORM)
  const [now] = React.useState(() => Date.now())
  const set = (patch: Partial<GrantForm>) => setForm((f) => ({ ...f, ...patch }))
  const busy = stage !== "idle" && stage !== "done"
  const visible = delegations.filter((d) => d.status !== "pending")

  return (
    <div className="flex flex-col gap-5">
      <CardShell className="flex flex-col gap-4 p-4">
        <div>
          <h2 className="text-[15px] font-semibold">Set up trading access</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            You sign a message listing exactly what copy trading may do. It can place and cancel trades inside these limits. It can never withdraw or transfer funds.
          </p>
        </div>
        <KindToggles spot={form.spot} perp={form.perp} onChange={set} disabled={busy} />
        <Field label="Only these markets (optional)" hint="Comma separated, e.g. BTC, ETH. Empty means all markets of the types above.">
          <Input value={form.symbols} onChange={(e) => set({ symbols: e.target.value })} placeholder="All markets" disabled={busy} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Max per order ($)"><Input inputMode="numeric" value={form.maxOrderUsd} onChange={(e) => set({ maxOrderUsd: e.target.value })} disabled={busy} /></Field>
          <Field label="Max per day ($)"><Input inputMode="numeric" value={form.maxDailyNotionalUsd} onChange={(e) => set({ maxDailyNotionalUsd: e.target.value })} disabled={busy} /></Field>
          <Field label="Max leverage (x)"><Input inputMode="numeric" value={form.maxLeverage} onChange={(e) => set({ maxLeverage: e.target.value })} disabled={busy} /></Field>
          <Field label="Access lasts (days)"><Input inputMode="numeric" value={form.expiresInDays} onChange={(e) => set({ expiresInDays: e.target.value })} disabled={busy} /></Field>
        </div>
        {stage !== "idle" && <div className="rounded-xl bg-surface-sunken/70 px-3.5 py-2.5 text-[13px] text-muted-foreground" aria-live="polite">{STAGE_TEXT[stage]}</div>}
        <FlowCta
          label={busy ? "Setting up…" : blocker ?? "Sign and turn on trading access"}
          onClick={() => onCreate(form)}
          disabled={Boolean(blocker) || busy}
          busy={busy}
          control={{ target: "copy-trading-grant", describe: "Sign trade-only copy trading access", guarded: true }}
        />
      </CardShell>

      <div className="flex flex-col gap-2">
        <h2 className="text-[15px] font-semibold">Your access</h2>
        {loading ? <p className="text-[13px] text-muted-foreground">Loading…</p>
          : visible.length === 0 ? <p className="text-[13px] text-muted-foreground">No trading access yet.</p>
          : visible.map((d) => {
              const expired = d.status === "active" && d.grant.expiresAt * 1000 <= now
              return (
                <CardShell key={d.ref} className="flex flex-col gap-2 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <StatusChip tone={d.status === "active" && !expired ? "good" : "muted"}>{expired ? "expired" : d.status}</StatusChip>
                    <span className="text-[12px] text-muted-foreground">until {new Date(d.grant.expiresAt * 1000).toLocaleDateString()}</span>
                  </div>
                  <p className="text-[13px] leading-relaxed">{describeGrant(d.grant)}</p>
                  {d.status === "active" && !expired && (
                    <>
                      <button type="button" onClick={() => onRevoke(d)} disabled={Boolean(blocker)} className="self-start rounded-full bg-debit-chip px-3.5 py-1.5 text-[13px] font-semibold text-debit disabled:opacity-40">
                        Revoke access
                      </button>
                      <p className="text-[12px] text-muted-foreground">Revoking stops all copying with this access immediately. Open copied positions are not closed for you.</p>
                    </>
                  )}
                </CardShell>
              )
            })}
        {blocker === null && stage === "idle" && visible.some((d) => d.status === "active") && (
          <InlineNotice>Access expires on its date. Renew it before then, or copying stops and open positions stay open.</InlineNotice>
        )}
      </div>
    </div>
  )
}

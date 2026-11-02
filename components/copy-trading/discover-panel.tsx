"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { CardShell } from "@/components/ui/system"
import { FlowCta, InlineNotice } from "@/components/ui/flow"
import { copyTradingApi } from "@/lib/copy-trading/api"
import { buildSubscriptionInput, describeGrant, followDefaults, type FollowForm } from "@/lib/copy-trading/forms"
import type { Delegation, Leader } from "@/lib/copy-trading/types"
import { Field, KindToggles, StatusChip } from "./parts"

export function DiscoverPanel({ leaders, delegations, following, onNeedAccess, onSubscribed }: {
  leaders: Leader[]
  delegations: Delegation[]
  following: string[]
  onNeedAccess: () => void
  onSubscribed: () => void
}) {
  const [openId, setOpenId] = React.useState<string | null>(null)
  return (
    <div className="flex flex-col gap-2">
      {delegations.length === 0 && (
        <InlineNotice>
          To copy anyone you first set up trade-only access.{" "}
          <button type="button" onClick={onNeedAccess} className="font-semibold underline">Set it up</button>
        </InlineNotice>
      )}
      {leaders.map((l) => (
        <CardShell key={l.id} className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold">{l.displayName}</div>
              <div className="text-[12.5px] text-muted-foreground capitalize">{l.venue}</div>
            </div>
            {following.includes(l.id) ? <StatusChip tone="good">following</StatusChip> : (
              <button type="button" disabled={delegations.length === 0} onClick={() => setOpenId(openId === l.id ? null : l.id)} className="rounded-full bg-primary px-4 py-2 text-[13px] font-bold text-primary-foreground disabled:opacity-40">
                {openId === l.id ? "Close" : "Copy"}
              </button>
            )}
          </div>
          {openId === l.id && <FollowForm leader={l} delegations={delegations} onDone={onSubscribed} />}
        </CardShell>
      ))}
    </div>
  )
}

function FollowForm({ leader, delegations, onDone }: { leader: Leader; delegations: Delegation[]; onDone: () => void }) {
  const [delegationId, setDelegationId] = React.useState(delegations[0].ref)
  const delegation = delegations.find((d) => d.ref === delegationId) ?? delegations[0]
  const [form, setForm] = React.useState<FollowForm>(() => followDefaults(delegation))
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const set = (patch: Partial<FollowForm>) => setForm((f) => ({ ...f, ...patch }))

  async function submit() {
    const built = buildSubscriptionInput(form, leader.id, delegation)
    if (!built.ok) return setError(built.error)
    setBusy(true); setError(null)
    try { await copyTradingApi.subscribe(built.value); onDone() }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't start copying.") }
    finally { setBusy(false) }
  }

  return (
    <div className="flex flex-col gap-4 border-t border-border/60 pt-4">
      {delegations.length > 1 && (
        <Field label="Trading access">
          <select className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm" value={delegationId} onChange={(e) => { setDelegationId(e.target.value); setForm(followDefaults(delegations.find((d) => d.ref === e.target.value)!)) }}>
            {delegations.map((d) => <option key={d.ref} value={d.ref}>{describeGrant(d.grant)}</option>)}
          </select>
        </Field>
      )}
      <Field label="Amount to allocate ($)" hint="The most this trader can use of your money."><Input inputMode="decimal" value={form.allocationUsd} onChange={(e) => set({ allocationUsd: e.target.value })} /></Field>
      <div className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-medium text-muted-foreground">Trade size</span>
        <div className="flex gap-2">
          {(["proportional", "fixed"] as const).map((m) => (
            <button key={m} type="button" aria-pressed={form.sizing === m} onClick={() => set({ sizing: m })} className={`rounded-full px-4 py-2 text-[13px] font-semibold ${form.sizing === m ? "bg-card text-foreground shadow-sm ring-1 ring-foreground/[0.08] dark:bg-accent" : "bg-surface-sunken text-muted-foreground"}`}>
              {m === "proportional" ? "Match their share" : "Fixed amount"}
            </button>
          ))}
        </div>
        {form.sizing === "fixed" && <Input inputMode="decimal" value={form.usdPerTrade} onChange={(e) => set({ usdPerTrade: e.target.value })} aria-label="Dollars per trade" />}
        <span className="text-[12px] text-muted-foreground">{form.sizing === "proportional" ? "Each trade is scaled by your allocation compared with the trader's account size." : "Every new position uses this many dollars."}</span>
      </div>
      <KindToggles spot={form.spot} perp={form.perp} onChange={set} />
      <Field label="Only these markets (optional)" hint={delegation.grant.symbols.length ? `Your access covers: ${delegation.grant.symbols.join(", ")}` : "Empty means everything the trader trades."}>
        <Input value={form.symbols} onChange={(e) => set({ symbols: e.target.value })} placeholder="All markets" />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Max leverage"><Input inputMode="numeric" value={form.maxLeverage} onChange={(e) => set({ maxLeverage: e.target.value })} /></Field>
        <Field label="Max order ($)"><Input inputMode="decimal" value={form.maxOrderUsd} onChange={(e) => set({ maxOrderUsd: e.target.value })} /></Field>
        <Field label="Slippage (%)"><Input inputMode="decimal" value={form.maxSlippagePct} onChange={(e) => set({ maxSlippagePct: e.target.value })} /></Field>
      </div>
      {error && <InlineNotice tone="error">{error}</InlineNotice>}
      <FlowCta label={busy ? "Starting…" : `Start copying ${leader.displayName}`} onClick={() => void submit()} busy={busy} disabled={busy} control={{ target: "copy-trading-follow", describe: `Start copying ${leader.displayName} with your allocation`, guarded: true }} />
    </div>
  )
}

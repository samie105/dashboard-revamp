"use client"

import type { CryptoTransactionIntent, SponsorshipOperation } from "@/lib/crypto-backend"

export function TransactionReview({ intent, sponsorship, onSimulate, onSubmit, simulating, submitting }: {
  intent: CryptoTransactionIntent
  sponsorship?: SponsorshipOperation
  onSimulate: () => void
  onSubmit: () => void
  simulating: boolean
  submitting: boolean
}) {
  const summary = intent.normalizedSummary
  const simulation = intent.simulationResult
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div>
        <h2 className="font-semibold">Review {sponsorship ? "sponsored " : ""}transaction</h2>
        <p className="text-xs text-muted-foreground">The backend intent is authoritative. Review it before approving local signing.</p>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-muted-foreground">Network</dt><dd>{summary?.networkId ?? intent.networkId}</dd>
        <dt className="text-muted-foreground">From</dt><dd className="truncate">{summary?.from}</dd>
        <dt className="text-muted-foreground">To</dt><dd className="truncate">{summary?.to}</dd>
        <dt className="text-muted-foreground">Amount</dt><dd>{summary?.amount} {summary?.asset?.identifier}</dd>
        <dt className="text-muted-foreground">Expires</dt><dd>{intent.expiresAt ? new Date(intent.expiresAt).toLocaleString() : "Backend controlled"}</dd>
      </dl>
      {sponsorship ? <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">
        <p className="font-medium">Network fee sponsored</p>
        <p className="text-xs text-muted-foreground">Estimated sponsor cost: {sponsorship.estimatedCostUsd === undefined ? "provider supplied" : `$${sponsorship.estimatedCostUsd.toFixed(4)}`}</p>
        <p className="text-xs text-muted-foreground">Status: {sponsorship.status}</p>
      </div> : null}
      {simulation?.error ? <p className="text-sm text-destructive">Simulation failed: {simulation.error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onSimulate} disabled={simulating || submitting} className="rounded-md border px-3 py-2 text-sm disabled:opacity-50">
          {simulating ? "Simulating…" : "Refresh simulation"}
        </button>
        <button type="button" onClick={onSubmit} disabled={submitting || simulating || simulation?.ok === false} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50">
          {submitting ? "Signing and submitting…" : sponsorship ? "Approve and submit (sponsored)" : "Approve and sign locally"}
        </button>
      </div>
    </section>
  )
}

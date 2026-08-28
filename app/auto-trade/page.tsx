"use client"

/**
 * Auto Trading — the web equivalent of mobile's AutoTradeScreen. Enable or
 * disable the autonomous agent and see its caps. The agent trades only when
 * both agentEnabled and agentSignerGranted are set (service-side rule).
 */

import * as React from "react"
import Link from "next/link"
import {
  fetchAgentStatus,
  enableAgent,
  disableAgent,
  CryptoApiError,
  type AgentStatus,
} from "@/lib/crypto-api"

export default function AutoTradePage() {
  const [status, setStatus] = React.useState<AgentStatus | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    try {
      setStatus(await fetchAgentStatus())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { load() }, [load])

  async function toggle() {
    if (!status) return
    setBusy(true)
    setError(null)
    try {
      if (status.agentEnabled) await disableAgent()
      else await enableAgent()
      await load()
    } catch (e) {
      setError(e instanceof CryptoApiError ? e.message : "Something went wrong.")
    } finally {
      setBusy(false)
    }
  }

  const cfg = status?.agentConfig

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-xl font-bold">Auto Trading</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Let the WorldStreet agent trade your trading account within the caps below.
      </p>

      {loading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
      ) : !status ? (
        <p className="mt-6 text-sm text-red-500">{error ?? "Failed to load"}</p>
      ) : !status.tradingWalletReady ? (
        <div className="mt-6 rounded-2xl border border-border/30 bg-card p-5">
          <p className="text-sm font-semibold">Trading account not set up</p>
          <p className="mt-1 text-xs text-muted-foreground">Set up and fund your trading account first.</p>
          <Link href="/fund" className="mt-4 block rounded-xl bg-primary py-3 text-center text-sm font-bold text-white hover:bg-primary/90">
            Set up in Fund
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-6 flex items-center justify-between rounded-2xl border border-border/30 bg-card px-5 py-4">
            <div>
              <p className="text-sm font-semibold">{status.agentEnabled ? "Agent is ON" : "Agent is OFF"}</p>
              <p className="text-xs text-muted-foreground">
                {status.agentEnabled
                  ? status.agentSignerGranted
                    ? "Trading within your caps."
                    : "Waiting for signer grant — not trading yet."
                  : "Enable to let the agent trade for you."}
              </p>
            </div>
            <button
              onClick={toggle}
              disabled={busy}
              className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-colors disabled:opacity-40 ${status.agentEnabled ? "bg-red-500 hover:bg-red-600" : "bg-primary hover:bg-primary/90"}`}
            >
              {busy ? "…" : status.agentEnabled ? "Disable" : "Enable"}
            </button>
          </div>

          {cfg && (
            <div className="mt-4 space-y-2 rounded-2xl border border-border/30 bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Caps</p>
              <Row label="Max spot order" value={`$${cfg.maxSpotOrderUsdc.toLocaleString()}`} />
              <Row label="Max futures position" value={`$${cfg.maxFuturesPositionUsdc.toLocaleString()}`} />
              <Row label="Max leverage" value={`${cfg.maxFuturesLeverage}×`} />
              <Row label="Spot trading" value={cfg.spotEnabled ? "On" : "Off"} />
              <Row label="Futures trading" value={cfg.futuresEnabled ? "On" : "Off"} />
            </div>
          )}
          {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
        </>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
}

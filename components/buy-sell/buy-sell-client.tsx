"use client"

/**
 * Buy / Sell USDT against the Dollar Account — the web equivalent of mobile's
 * BuyScreen and SellScreen, same state machine: initiate → 200 means done,
 * 202 means poll the reference until a terminal status.
 *
 * Buy: USD hold → treasury disburses USDT on-chain to the user's wallet.
 * Sell: user's wallet sends USDT to treasury → USD credited on confirmation.
 */

import * as React from "react"
import Link from "next/link"
import {
  fetchBuyAvailability,
  fetchSellInfo,
  fetchDollarBalances,
  initiateBuy,
  initiateSell,
  fetchBuy,
  fetchSell,
  CryptoApiError,
  type Buy,
  type Sell,
  type BuyNetwork,
  type SellNetwork,
} from "@/lib/crypto-api"

const NETWORK_LABELS: Record<string, string> = {
  tron: "Tron",
  solana: "Solana",
  ethereum: "Ethereum",
}
// Tron leads — it's the network most USDT is bought on (same order as mobile).
const NETWORK_ORDER = ["tron", "solana", "ethereum"] as const

const BUY_TERMINAL = ["completed", "delivery_failed", "cancelled"]
const SELL_TERMINAL = ["completed", "failed"]

type Mode = "buy" | "sell"

export function BuySellClient({ mode }: { mode: Mode }) {
  const isBuy = mode === "buy"

  const [amount, setAmount] = React.useState("")
  const [network, setNetwork] = React.useState<string>("tron")
  const [enabled, setEnabled] = React.useState<string[]>([])
  const [limits, setLimits] = React.useState({ min: 1, max: 5000, feePercent: 0 })
  const [cashUsd, setCashUsd] = React.useState<number | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<Buy | Sell | null>(null)

  // Availability + Dollar Account balance
  React.useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        if (isBuy) {
          const a = await fetchBuyAvailability()
          if (cancelled) return
          setLimits({ min: a.minUsdt, max: a.maxUsdt, feePercent: a.feePercent })
          setEnabled(NETWORK_ORDER.filter((n) => a.chains[n as BuyNetwork]?.enabled))
        } else {
          const s = await fetchSellInfo()
          if (cancelled) return
          setLimits({ min: s.minUsdt, max: s.maxUsdt, feePercent: s.feePercent })
          setEnabled(NETWORK_ORDER.filter((n) => s.networks[n as SellNetwork]?.enabled))
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load")
      } finally {
        if (!cancelled) setLoading(false)
      }
      try {
        const b = await fetchDollarBalances()
        if (!cancelled) setCashUsd(b.balances.USD.available)
      } catch {
        /* cash row is best-effort */
      }
    }
    load()
    return () => { cancelled = true }
  }, [isBuy])

  // Keep the selected network valid as availability loads.
  React.useEffect(() => {
    if (enabled.length && !enabled.includes(network)) setNetwork(enabled[0])
  }, [enabled, network])

  // Poll a non-terminal result. fetchSell also advances the flow server-side.
  React.useEffect(() => {
    if (!result) return
    const terminal = isBuy ? BUY_TERMINAL : SELL_TERMINAL
    if (terminal.includes(result.status)) return
    const id = setInterval(async () => {
      try {
        const next = isBuy ? await fetchBuy(result.reference) : await fetchSell(result.reference)
        setResult(next)
      } catch { /* keep polling */ }
    }, 4000)
    return () => clearInterval(id)
  }, [result, isBuy])

  const amt = parseFloat(amount) || 0
  const usdSide = isBuy ? amt * (1 + limits.feePercent / 100) : amt * (1 - limits.feePercent / 100)
  const insufficientCash = isBuy && cashUsd !== null && usdSide > cashUsd
  const canSubmit =
    !submitting && enabled.length > 0 && amt >= limits.min && amt <= limits.max && !insufficientCash

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      const res = isBuy
        ? await initiateBuy({ usdtAmount: amt, network: network as BuyNetwork })
        : await initiateSell({ usdtAmount: amt, network: network as SellNetwork })
      setResult(res)
    } catch (e) {
      setError(e instanceof CryptoApiError ? e.message : "Something went wrong. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  // ── Result view ───────────────────────────────────────────────────────────
  if (result) {
    const terminal = isBuy ? BUY_TERMINAL : SELL_TERMINAL
    const done = result.status === "completed"
    const failed = terminal.includes(result.status) && !done
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="rounded-2xl border border-border/30 bg-card p-6 text-center">
          <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${done ? "bg-emerald-500/10" : failed ? "bg-red-500/10" : "bg-primary/10"}`}>
            <span className="text-2xl">{done ? "✓" : failed ? "✕" : "…"}</span>
          </div>
          <p className="text-base font-semibold">
            {done
              ? `${isBuy ? "Bought" : "Sold"} ${result.usdtAmount} USDT`
              : failed
                ? `${isBuy ? "Buy" : "Sell"} failed`
                : `${isBuy ? "Delivering USDT" : "Confirming transfer"}…`}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {done && isBuy && `$${(result as Buy).usdCharged.toFixed(2)} charged to your Dollar Account`}
            {done && !isBuy && `$${(result as Sell).usdProceeds.toFixed(2)} credited to your Dollar Account`}
            {failed && (("deliveryError" in result && result.deliveryError) || ("error" in result && result.error) || "Nothing was charged.")}
            {!done && !failed && `Status: ${result.status.replace(/_/g, " ")}`}
          </p>
          {result.txHash && (
            <p className="mt-2 break-all text-[11px] text-muted-foreground">tx: {result.txHash}</p>
          )}
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => { setResult(null); setAmount("") }}
              className="rounded-xl border border-border/50 px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              {isBuy ? "Buy more" : "Sell more"}
            </button>
            <Link href="/transactions" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90">
              View history
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-xl font-bold">{isBuy ? "Buy USDT" : "Sell USDT"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {isBuy
          ? "Pay from your Dollar Account — USDT lands in your wallet."
          : "USDT leaves your wallet — dollars land in your Dollar Account."}
      </p>

      {cashUsd !== null && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-border/30 bg-card px-4 py-3">
          <span className="text-sm text-muted-foreground">Dollar Account</span>
          <span className="text-sm font-semibold tabular-nums">${cashUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
      ) : enabled.length === 0 ? (
        <p className="mt-6 text-sm text-amber-500">
          {isBuy ? "Buying" : "Selling"} is temporarily unavailable. Try again later.
        </p>
      ) : (
        <>
          <div className="mt-6">
            <label className="text-xs font-medium text-muted-foreground">Network</label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {enabled.map((n) => (
                <button
                  key={n}
                  onClick={() => setNetwork(n)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${network === n ? "border-primary bg-primary/10 text-primary" : "border-border/50 hover:bg-accent"}`}
                >
                  {NETWORK_LABELS[n]}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <label className="text-xs font-medium text-muted-foreground">
              Amount (USDT) — {limits.min} to {limits.max.toLocaleString()}
            </label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              placeholder="0.00"
              className="mt-2 w-full rounded-xl border border-border/50 bg-background px-4 py-3 text-lg font-semibold tabular-nums outline-none focus:border-primary"
            />
          </div>

          {amt > 0 && (
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {isBuy ? "You pay" : "You receive"}
                {limits.feePercent > 0 && ` (incl. ${limits.feePercent}% fee)`}
              </span>
              <span className="font-semibold tabular-nums">${usdSide.toFixed(2)}</span>
            </div>
          )}

          {insufficientCash && (
            <p className="mt-2 text-xs text-amber-500">
              Not enough in your Dollar Account. Top it up on the Worldstreet home.
            </p>
          )}
          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

          <button
            onClick={submit}
            disabled={!canSubmit}
            className="mt-6 w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Working…" : isBuy ? `Buy ${amt > 0 ? `${amt} ` : ""}USDT` : `Sell ${amt > 0 ? `${amt} ` : ""}USDT`}
          </button>
        </>
      )}
    </div>
  )
}

"use client"

/**
 * Fund / withdraw the Hyperliquid trading account against the Dollar Account —
 * the web equivalent of mobile's FundScreen and WithdrawScreen.
 *
 * Fund: USD hold → treasury USDC on Arbitrum → HL bridge → Spot/Perps.
 * Withdraw: HL → treasury → USD credited to the Dollar Account.
 * Both: initiate then poll the reference until a terminal status.
 */

import * as React from "react"
import Link from "next/link"
import {
  fetchFundAvailability,
  fetchTradingWithdrawInfo,
  fetchDollarBalances,
  fetchHlAccount,
  initiateFund,
  initiateTradingWithdraw,
  fetchFund,
  fetchTradingWithdraw,
  setupTradingWallet,
  fetchTradingWalletStatus,
  CryptoApiError,
  FUND_TERMINAL,
  TRADING_WITHDRAW_TERMINAL,
  type Fund,
  type TradingWithdraw,
  type FundDestination,
} from "@/lib/crypto-api"

type Mode = "fund" | "withdraw"

export function FundClient({ mode }: { mode: Mode }) {
  const isFund = mode === "fund"

  const [amount, setAmount] = React.useState("")
  const [side, setSide] = React.useState<FundDestination>("spot")
  const [limits, setLimits] = React.useState({ min: 5, max: 5000, feePercent: 0, enabled: true, reason: "" })
  const [cashUsd, setCashUsd] = React.useState<number | null>(null)
  const [hl, setHl] = React.useState<{ spot: number; perps: number } | null>(null)
  const [walletReady, setWalletReady] = React.useState<boolean | null>(null)
  const [settingUp, setSettingUp] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<Fund | TradingWithdraw | null>(null)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const status = await fetchTradingWalletStatus()
        if (cancelled) return
        setWalletReady(status.initialized)
        if (isFund) {
          const a = await fetchFundAvailability()
          if (cancelled) return
          setLimits({ min: a.minUsdc, max: a.maxUsdc, feePercent: a.feePercent, enabled: a.enabled, reason: a.reason ?? "" })
        } else {
          const i = await fetchTradingWithdrawInfo()
          if (cancelled) return
          setLimits({ min: i.minUsdc, max: i.maxUsdc, feePercent: i.feePercent, enabled: i.enabled, reason: "" })
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load")
      } finally {
        if (!cancelled) setLoading(false)
      }
      // Balances are best-effort context, not gates.
      try {
        const b = await fetchDollarBalances()
        if (!cancelled) setCashUsd(b.balances.USD.available)
      } catch { /* ignore */ }
      try {
        const acct = await fetchHlAccount()
        if (!cancelled && acct.balances) {
          setHl({ spot: acct.balances.spotUsdc, perps: acct.balances.perpsWithdrawableUsdc })
        }
      } catch { /* ignore */ }
    }
    load()
    return () => { cancelled = true }
  }, [isFund])

  // Poll a non-terminal result.
  React.useEffect(() => {
    if (!result) return
    const terminal: string[] = isFund ? FUND_TERMINAL : TRADING_WITHDRAW_TERMINAL
    if (terminal.includes(result.status)) return
    const id = setInterval(async () => {
      try {
        const next = isFund
          ? await fetchFund(result.reference)
          : await fetchTradingWithdraw(result.reference)
        setResult(next)
      } catch { /* keep polling */ }
    }, 4000)
    return () => clearInterval(id)
  }, [result, isFund])

  const amt = parseFloat(amount) || 0
  const insufficient = isFund
    ? cashUsd !== null && amt * (1 + limits.feePercent / 100) > cashUsd
    : hl !== null && amt > (side === "spot" ? hl.spot : hl.perps)
  const canSubmit = !submitting && limits.enabled && walletReady === true && amt >= limits.min && amt <= limits.max && !insufficient

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      const res = isFund
        ? await initiateFund({ amountUsdc: amt, destination: side })
        : await initiateTradingWithdraw({ amountUsdc: amt, source: side })
      setResult(res)
    } catch (e) {
      setError(e instanceof CryptoApiError ? e.message : "Something went wrong. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSetup() {
    setSettingUp(true)
    setError(null)
    try {
      await setupTradingWallet()
      setWalletReady(true)
    } catch (e) {
      setError(e instanceof CryptoApiError ? e.message : "Setup failed. Try again.")
    } finally {
      setSettingUp(false)
    }
  }

  if (result) {
    const terminal: string[] = isFund ? FUND_TERMINAL : TRADING_WITHDRAW_TERMINAL
    const done = result.status === "completed"
    const failed = result.status === "failed"
    const inFlight = !terminal.includes(result.status)
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="rounded-2xl bg-card p-6 text-center">
          <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${done ? "bg-credit-chip" : failed ? "bg-debit-chip" : "bg-primary/10"}`}>
            <span className="text-2xl">{done ? "✓" : failed ? "✕" : "…"}</span>
          </div>
          <p className="text-base font-semibold">
            {done
              ? `${result.amountUsdc} USDC ${isFund ? "delivered" : "withdrawn"}`
              : failed
                ? `${isFund ? "Funding" : "Withdrawal"} failed`
                : `${isFund ? "Funding" : "Withdrawing"}…`}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {result.message ?? (inFlight ? `Status: ${result.status.replace(/_/g, " ")}` : "")}
          </p>
          {"partial" in result && result.partial && (
            <p className="mt-2 text-xs text-warning">
              Funds arrived but not where requested — contact support if they don&apos;t appear.
            </p>
          )}
          <div className="mt-6 flex justify-center gap-3">
            <button onClick={() => { setResult(null); setAmount("") }} className="rounded-xl border border-border/50 px-4 py-2 text-sm font-medium hover:bg-accent">
              Done
            </button>
            <Link href="/trade" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90">
              Go trade
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="font-display text-2xl font-bold tracking-[-0.01em]">{isFund ? "Fund trading account" : "Withdraw trading balance"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {isFund
          ? "Pay from your Dollar Account — funds land in your Hyperliquid balance ready to trade."
          : "Move funds from Hyperliquid back to your Dollar Account."}
      </p>

      <div className="mt-4 space-y-2">
        {cashUsd !== null && (
          <div className="flex items-center justify-between rounded-xl bg-card px-4 py-3">
            <span className="text-sm text-muted-foreground">Dollar Account</span>
            <span className="text-sm font-semibold tabular-nums">${cashUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        )}
        {hl && (
          <div className="flex items-center justify-between rounded-xl bg-card px-4 py-3">
            <span className="text-sm text-muted-foreground">Trading balance</span>
            <span className="text-sm font-semibold tabular-nums">
              Spot ${hl.spot.toFixed(2)} · Futures ${hl.perps.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
      ) : walletReady === false ? (
        <div className="mt-6 rounded-2xl bg-card p-5">
          <p className="text-sm font-semibold">Set up your trading account</p>
          <p className="mt-1 text-xs text-muted-foreground">
            One-time step — designates your wallet for Hyperliquid trading.
          </p>
          <button onClick={handleSetup} disabled={settingUp} className="mt-4 w-full rounded-xl bg-primary py-3 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-40">
            {settingUp ? "Setting up…" : "Set up trading account"}
          </button>
          {error && <p className="mt-2 text-xs text-debit">{error}</p>}
        </div>
      ) : !limits.enabled ? (
        <p className="mt-6 text-sm text-warning">
          {limits.reason || `${isFund ? "Funding" : "Withdrawing"} is temporarily unavailable.`}
        </p>
      ) : (
        <>
          <div className="mt-6">
            <label className="text-xs font-medium text-muted-foreground">{isFund ? "Destination" : "From"}</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["spot", "perps"] as const).map((s) => (
                <button key={s} onClick={() => setSide(s)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${side === s ? "border-primary bg-primary/10 text-primary" : "border-border/50 hover:bg-accent"}`}>
                  {s === "spot" ? "Spot" : "Futures"}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <label className="text-xs font-medium text-muted-foreground">
              Amount (USDC) — {limits.min} to {limits.max.toLocaleString()}
            </label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              placeholder="0.00"
              className="mt-2 w-full rounded-xl border border-border/50 bg-background px-4 py-3 text-lg font-semibold tabular-nums outline-none focus:border-primary"
            />
          </div>

          {insufficient && (
            <p className="mt-2 text-xs text-warning">
              {isFund ? "Not enough in your Dollar Account." : "Not enough in that trading balance."}
            </p>
          )}
          {error && <p className="mt-2 text-xs text-debit">{error}</p>}

          <button onClick={submit} disabled={!canSubmit}
            className="mt-6 w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40">
            {submitting ? "Working…" : isFund ? "Fund account" : "Withdraw"}
          </button>
        </>
      )}
    </div>
  )
}

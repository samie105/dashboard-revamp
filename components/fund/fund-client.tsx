"use client"

/**
 * Fund / withdraw the Hyperliquid trading account against the Dollar Account —
 * same poll-driven state machine as before, rebuilt on the flow kit.
 *
 * Fund: USD hold → treasury USDC on Arbitrum → HL bridge → Spot/Perps.
 * Withdraw: HL → treasury → USD credited to the Dollar Account.
 */

import * as React from "react"
import { Eyebrow, PageHeader, illustrations } from "@/components/ui/system"
import {
  FlowShell,
  ContextPanel,
  AmountField,
  ChoiceRow,
  DetailPanel,
  InlineNotice,
  FlowCta,
  StatusScreen,
  UnavailablePanel,
  FlowSkeleton,
  type Stage,
} from "@/components/ui/flow"
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

/**
 * The service's fine-grained statuses collapse onto a four-step story the
 * user can actually follow (mobile FundScreen's checklist).
 */
const FUND_STAGES: Stage[] = [
  { key: "charge", label: "Charging your Dollar Account" },
  { key: "send", label: "Sending USDC on Arbitrum" },
  { key: "bridge", label: "Bridging into Hyperliquid" },
  { key: "land", label: "Landing in your trading balance" },
]
const FUND_STAGE_INDEX: Record<string, number> = {
  pending: 0,
  usd_held: 1,
  disbursing: 1,
  usdc_arrived: 2,
  bridging: 2,
  transferring: 3,
  completed: 4,
}

const WITHDRAW_STAGES: Stage[] = [
  { key: "request", label: "Requesting the withdrawal" },
  { key: "leave", label: "Leaving Hyperliquid" },
  { key: "credit", label: "Crediting your Dollar Account" },
]
const WITHDRAW_STAGE_INDEX: Record<string, number> = {
  pending: 0,
  hl_withdrawing: 1,
  completed: 3,
}

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
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)
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
        setLoadError(null)
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "We couldn't load this screen.")
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
  const sourceBalance = isFund ? cashUsd : hl ? (side === "spot" ? hl.spot : hl.perps) : null
  const costUsd = isFund ? amt * (1 + limits.feePercent / 100) : amt
  const shortBy = sourceBalance !== null ? costUsd - sourceBalance : 0
  const insufficient = sourceBalance !== null && costUsd > sourceBalance
  const maxSpend = sourceBalance !== null
    ? Math.min(limits.max, isFund ? sourceBalance / (1 + limits.feePercent / 100) : sourceBalance)
    : null

  const blocker =
    amt <= 0 ? "Enter an amount"
    : amt < limits.min ? `Minimum is ${limits.min} USDC`
    : amt > limits.max ? `Maximum is ${limits.max.toLocaleString()} USDC`
    : insufficient ? (isFund ? "Not enough in your Dollar Account" : "Not enough in that balance")
    : null
  const ctaLabel = submitting
    ? isFund ? "Starting the transfer…" : "Requesting withdrawal…"
    : blocker ?? (isFund ? `Fund ${side === "spot" ? "Spot" : "Futures"} with ${amt.toLocaleString()} USDC` : `Withdraw ${amt.toLocaleString()} USDC`)

  const amountProblem =
    amt > 0 && amt < limits.min ? `The minimum is ${limits.min} USDC.`
    : amt > limits.max ? `The maximum is ${limits.max.toLocaleString()} USDC per transfer.`
    : insufficient
      ? isFund
        ? `You need $${shortBy.toFixed(2)} more in your Dollar Account for this transfer.`
        : `Your ${side === "spot" ? "Spot" : "Futures"} balance only has $${(sourceBalance ?? 0).toFixed(2)} available.`
      : null

  async function submit() {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = isFund
        ? await initiateFund({ amountUsdc: amt, destination: side })
        : await initiateTradingWithdraw({ amountUsdc: amt, source: side })
      setResult(res)
    } catch (e) {
      setSubmitError(e instanceof CryptoApiError ? e.message : "Something went wrong before anything moved — it's safe to try again.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSetup() {
    setSettingUp(true)
    setSubmitError(null)
    try {
      await setupTradingWallet()
      setWalletReady(true)
    } catch (e) {
      setSubmitError(e instanceof CryptoApiError ? e.message : "Setup didn't complete — try again.")
    } finally {
      setSettingUp(false)
    }
  }

  /* ── Status screen ──────────────────────────────────────────────────── */
  if (result) {
    const done = result.status === "completed"
    const failed = result.status === "failed"
    const stages = isFund ? FUND_STAGES : WITHDRAW_STAGES
    const index = done
      ? stages.length
      : (isFund ? FUND_STAGE_INDEX : WITHDRAW_STAGE_INDEX)[result.status] ?? 0
    const eta = !isFund && "expectedSeconds" in result && result.expectedSeconds > 0
      ? Math.max(1, Math.round(result.expectedSeconds / 60))
      : null

    return (
      <FlowShell>
        <StatusScreen
          state={done ? "success" : failed ? "failure" : "processing"}
          headline={
            done
              ? `${result.amountUsdc.toLocaleString()} USDC ${isFund ? "delivered" : "withdrawn"}`
              : failed
                ? isFund ? "Funding didn't complete" : "Withdrawal didn't complete"
                : isFund ? "Funding your trading account" : "Withdrawing to your Dollar Account"
          }
          caption={
            done
              ? isFund
                ? `Your ${side === "spot" ? "Spot" : "Futures"} balance is topped up and ready to trade.`
                : `$${("creditUsd" in result ? result.creditUsd : result.amountUsdc).toFixed(2)} was credited to your Dollar Account.`
              : failed
                ? result.message ??
                  (isFund
                    ? "The transfer stopped before completing. Anything already charged will be returned automatically — support has been notified."
                    : "The withdrawal stopped before completing. Your trading balance is untouched — it's safe to try again.")
                : eta
                  ? `Usually takes about ${eta} minute${eta > 1 ? "s" : ""}.`
                  : "This can take a couple of minutes."
          }
          illustration={done ? "cryptoTrade" : undefined}
          stages={!failed ? stages : undefined}
          activeIndex={index}
          notice={
            "partial" in result && result.partial
              ? "Funds arrived but not exactly where requested — contact support if they don't show up in a few minutes."
              : undefined
          }
          primary={
            done
              ? { label: "Go trade", href: "/trade" }
              : failed
                ? { label: "Start over", onClick: () => { setResult(null); setAmount("") } }
                : undefined
          }
          secondary={
            done
              ? { label: "Done", onClick: () => { setResult(null); setAmount("") } }
              : failed
                ? { label: "View history", href: "/transactions" }
                : undefined
          }
        />
      </FlowShell>
    )
  }

  /* ── Form ───────────────────────────────────────────────────────────── */
  return (
    <FlowShell>
      <PageHeader
        title={isFund ? "Fund trading account" : "Withdraw trading balance"}
        subtitle={
          isFund
            ? "Pay from your Dollar Account — funds land in Hyperliquid ready to trade."
            : "Move funds from Hyperliquid back to your Dollar Account."
        }
        className="mb-5"
      />

      {loading ? (
        <FlowSkeleton />
      ) : loadError ? (
        <UnavailablePanel title="We couldn't load this screen" reason={`${loadError} — refresh to try again.`} />
      ) : walletReady === false ? (
        /* One-time setup gate — a real screen with a single clear action. */
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-card px-6 py-8 text-center">
          <img src={illustrations.cryptoTrade} alt="" className="h-24 w-24 object-contain" />
          <p className="text-[15px] font-semibold">Set up your trading account</p>
          <p className="mx-auto max-w-xs text-[13px] leading-relaxed text-muted-foreground">
            A one-time step that designates your wallet for Hyperliquid trading. Takes a few seconds.
          </p>
          {submitError && <InlineNotice tone="error" className="w-full text-left">{submitError}</InlineNotice>}
          <button
            onClick={handleSetup}
            disabled={settingUp}
            className="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
          >
            {settingUp && <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />}
            {settingUp ? "Setting up…" : "Set up trading account"}
          </button>
        </div>
      ) : !limits.enabled ? (
        <UnavailablePanel
          title={isFund ? "Funding is paused right now" : "Withdrawals are paused right now"}
          reason={limits.reason || undefined}
          illustration="cryptoTrade"
        />
      ) : (
        <div className="flex flex-col gap-4">
          <ContextPanel
            rows={[
              ...(cashUsd !== null
                ? [{ label: "Dollar Account", value: `$${cashUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}` }]
                : []),
              ...(hl
                ? [{ label: "Trading balance", value: `Spot $${hl.spot.toFixed(2)} · Futures $${hl.perps.toFixed(2)}` }]
                : []),
            ]}
          />

          <div className="rounded-2xl bg-card px-4 py-5">
            <AmountField
              value={amount}
              onChange={setAmount}
              unit="USDC"
              hint={`Min ${limits.min} · Max ${limits.max.toLocaleString()}`}
              problem={amountProblem}
              maxSpend={maxSpend}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Eyebrow>{isFund ? "Destination" : "Withdraw from"}</Eyebrow>
            <ChoiceRow
              columns={2}
              options={[
                { key: "spot" as const, label: "Spot", sub: hl ? `$${hl.spot.toFixed(2)}` : undefined },
                { key: "perps" as const, label: "Futures", sub: hl ? `$${hl.perps.toFixed(2)}` : undefined },
              ]}
              value={side}
              onChange={setSide}
            />
          </div>

          {amt > 0 && (
            <DetailPanel
              rows={[
                { label: isFund ? "To your trading balance" : "From your trading balance", value: `${amt.toLocaleString()} USDC` },
                ...(limits.feePercent > 0 ? [{ label: "Fee", value: `${limits.feePercent}%` }] : []),
                {
                  label: isFund ? "Charged to Dollar Account" : "Credited to Dollar Account",
                  value: `$${costUsd.toFixed(2)}`,
                  strong: true,
                },
              ]}
            />
          )}

          {submitError && <InlineNotice tone="error">{submitError}</InlineNotice>}

          <FlowCta label={ctaLabel} onClick={submit} disabled={!!blocker} busy={submitting} />
        </div>
      )}
    </FlowShell>
  )
}

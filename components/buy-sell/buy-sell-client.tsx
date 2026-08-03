"use client"

/**
 * Buy / Sell USDT against the Dollar Account — same state machine as before
 * (initiate → 200 done, 202 poll the reference until terminal), rebuilt on
 * the flow kit: hero amount, raised-fill network choice, review breakdown,
 * a CTA that states its blocker, and a staged status screen instead of a
 * spinner and a shrug.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Clock01Icon } from "@hugeicons/core-free-icons"
import { Eyebrow, PageHeader } from "@/components/ui/system"
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

// Tron leads — it's the network most USDT is bought on (same order as mobile).
const NETWORKS = [
  { key: "tron", label: "Tron", icon: "https://coin-images.coingecko.com/coins/images/1094/small/tron-logo.png" },
  { key: "solana", label: "Solana", icon: "https://coin-images.coingecko.com/coins/images/4128/small/solana.png" },
  { key: "ethereum", label: "Ethereum", icon: "https://coin-images.coingecko.com/coins/images/279/small/ethereum.png" },
] as const

const BUY_TERMINAL = ["completed", "delivery_failed", "cancelled"]
const SELL_TERMINAL = ["completed", "failed"]

/** The checklist the poll advances. Status → stage index. */
const BUY_STAGES: Stage[] = [
  { key: "pending", label: "Charging your Dollar Account" },
  { key: "payment_confirmed", label: "Payment confirmed" },
  { key: "sending_usdt", label: "Sending USDT to your wallet" },
  { key: "completed", label: "Delivered" },
]
const SELL_STAGES: Stage[] = [
  { key: "pending", label: "Starting the transfer" },
  { key: "usdt_sent", label: "USDT sent to treasury" },
  { key: "tx_verified", label: "Transfer verified on-chain" },
  { key: "completed", label: "Dollars credited" },
]

function stageIndex(stages: Stage[], status: string) {
  const i = stages.findIndex((s) => s.key === status)
  return i === -1 ? 0 : i
}

type Mode = "buy" | "sell"

export function BuySellClient({ mode }: { mode: Mode }) {
  const isBuy = mode === "buy"

  const [amount, setAmount] = React.useState("")
  const [network, setNetwork] = React.useState<string>("tron")
  const [enabled, setEnabled] = React.useState<string[]>([])
  const [limits, setLimits] = React.useState({ min: 1, max: 5000, feePercent: 0 })
  const [cashUsd, setCashUsd] = React.useState<number | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)
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
          setEnabled(NETWORKS.map((n) => n.key).filter((n) => a.chains[n as BuyNetwork]?.enabled))
        } else {
          const s = await fetchSellInfo()
          if (cancelled) return
          setLimits({ min: s.minUsdt, max: s.maxUsdt, feePercent: s.feePercent })
          setEnabled(NETWORKS.map((n) => n.key).filter((n) => s.networks[n as SellNetwork]?.enabled))
        }
        setLoadError(null)
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "We couldn't load this screen.")
      } finally {
        if (!cancelled) setLoading(false)
      }
      try {
        const b = await fetchDollarBalances()
        if (!cancelled) setCashUsd(b.balances.USD.available)
      } catch { /* cash row is best-effort context */ }
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
  const shortBy = isBuy && cashUsd !== null ? usdSide - cashUsd : 0
  const insufficientCash = isBuy && cashUsd !== null && usdSide > cashUsd
  // Max the user can actually buy, fee included — drives the 25/50/75/Max chips.
  const maxSpendUsdt = isBuy && cashUsd !== null
    ? Math.min(limits.max, cashUsd / (1 + limits.feePercent / 100))
    : null

  /* The blocker ladder — the CTA always says WHY it can't proceed. */
  const blocker =
    amt <= 0 ? "Enter an amount"
    : amt < limits.min ? `Minimum is ${limits.min} USDT`
    : amt > limits.max ? `Maximum is ${limits.max.toLocaleString()} USDT`
    : insufficientCash ? "Not enough in your Dollar Account"
    : null
  const ctaLabel = submitting
    ? isBuy ? "Placing your order…" : "Starting the transfer…"
    : blocker ?? (isBuy ? `Buy ${amt.toLocaleString()} USDT` : `Sell ${amt.toLocaleString()} USDT`)

  /* Amount-line validation, phrased as help rather than a scold. */
  const amountProblem =
    amt > 0 && amt < limits.min ? `The minimum is ${limits.min} USDT.`
    : amt > limits.max ? `The maximum is ${limits.max.toLocaleString()} USDT per order.`
    : insufficientCash ? `You need $${shortBy.toFixed(2)} more in your Dollar Account for this ${isBuy ? "buy" : "order"}.`
    : null

  async function submit() {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = isBuy
        ? await initiateBuy({ usdtAmount: amt, network: network as BuyNetwork })
        : await initiateSell({ usdtAmount: amt, network: network as SellNetwork })
      setResult(res)
    } catch (e) {
      setSubmitError(e instanceof CryptoApiError ? e.message : "Something went wrong before anything was charged — it's safe to try again.")
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Status screen — the poll's progress report ─────────────────────── */
  if (result) {
    const stages = isBuy ? BUY_STAGES : SELL_STAGES
    const done = result.status === "completed"
    const terminal = isBuy ? BUY_TERMINAL : SELL_TERMINAL
    const failed = terminal.includes(result.status) && !done
    const cancelled = result.status === "cancelled"

    const failureCaption = isBuy
      ? cancelled
        ? "This order was cancelled. Nothing was charged to your Dollar Account."
        : ("deliveryError" in result && result.deliveryError) ||
          "Your payment went through but delivery didn't complete — support has been notified and will retry or refund automatically."
      : ("error" in result && result.error) ||
        "The transfer couldn't be completed. Your USDT hasn't left — it's safe to try again."

    return (
      <FlowShell>
        <StatusScreen
          state={done ? "success" : failed ? "failure" : "processing"}
          headline={
            done
              ? isBuy ? `Bought ${result.usdtAmount} USDT` : `Sold ${result.usdtAmount} USDT`
              : failed
                ? cancelled ? "Order cancelled" : isBuy ? "Delivery didn't complete" : "Transfer didn't complete"
                : isBuy ? "Buying your USDT" : "Selling your USDT"
          }
          caption={
            done
              ? isBuy
                ? `$${(result as Buy).usdCharged.toFixed(2)} was charged to your Dollar Account. The USDT is in your ${NETWORKS.find((n) => n.key === result.network)?.label} wallet.`
                : `$${(result as Sell).usdProceeds.toFixed(2)} was credited to your Dollar Account.`
              : failed
                ? failureCaption
                : "This usually takes under a minute."
          }
          stages={!failed ? stages : undefined}
          activeIndex={done ? stages.length : stageIndex(stages, result.status)}
          txHash={result.txHash}
          primary={
            done
              ? { label: "View history", href: "/transactions" }
              : failed
                ? { label: "Start over", onClick: () => { setResult(null); setAmount("") } }
                : undefined
          }
          secondary={
            done
              ? { label: isBuy ? "Buy more" : "Sell more", onClick: () => { setResult(null); setAmount("") } }
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
        title={isBuy ? "Deposit USDT" : "Withdraw USDT"}
        subtitle={
          isBuy
            ? "Pay from your Dollar Account — USDT lands in your wallet."
            : "USDT leaves your wallet — dollars land in your Dollar Account."
        }
        className="mb-5"
      />

      {loading ? (
        <FlowSkeleton />
      ) : loadError ? (
        <UnavailablePanel
          title="We couldn't load this screen"
          reason={`${loadError} — refresh to try again.`}
          tone="muted"
        />
      ) : enabled.length === 0 ? (
        <UnavailablePanel
          title={isBuy ? "Buying is paused right now" : "Selling is paused right now"}
          reason="The treasury is topping up. This is usually brief — check back in a few minutes."
          icon={Clock01Icon}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <ContextPanel
            rows={[
              ...(cashUsd !== null
                ? [{ label: "Dollar Account", value: `$${cashUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}` }]
                : []),
            ]}
          />

          <div className="rounded-2xl bg-card px-4 py-5">
            <AmountField
              value={amount}
              onChange={setAmount}
              unit="USDT"
              hint={`Min ${limits.min} · Max ${limits.max.toLocaleString()}`}
              problem={amountProblem}
              maxSpend={maxSpendUsdt}
              presets={!maxSpendUsdt ? [10, 50, 100, 500].filter((p) => p >= limits.min && p <= limits.max) : undefined}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Eyebrow>{isBuy ? "Receive on" : "Send from"}</Eyebrow>
            <ChoiceRow
              options={NETWORKS.filter((n) => enabled.includes(n.key)).map((n) => ({ key: n.key, label: n.label, icon: n.icon }))}
              value={network}
              onChange={setNetwork}
            />
          </div>

          {amt > 0 && (
            <DetailPanel
              rows={[
                { label: isBuy ? "You receive" : "You sell", value: `${amt.toLocaleString()} USDT` },
                ...(limits.feePercent > 0 ? [{ label: "Fee", value: `${limits.feePercent}%` }] : []),
                {
                  label: isBuy ? "You pay" : "You receive",
                  value: `$${usdSide.toFixed(2)}`,
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

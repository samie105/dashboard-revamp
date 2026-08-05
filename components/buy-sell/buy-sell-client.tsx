"use client"

/**
 * Buy / Sell USDT against the Dollar Account — same state machine as before
 * (initiate → 200 done, 202 poll the reference until terminal), rebuilt on
 * the flow kit: hero amount, raised-fill network choice, review breakdown,
 * a CTA that states its blocker, and a staged status screen instead of a
 * spinner and a shrug.
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import { Eyebrow, PageHeader, Segmented } from "@/components/ui/system"
import { ReceivePanel } from "@/components/ui/receive-panel"
import { useWallet, type WalletAddresses } from "@/components/wallet-provider"
import {
  FlowShell,
  AnnouncementBanner,
  ErrorDetail,
  ContextPanel,
  AmountField,
  ChoiceRow,
  DetailPanel,
  FlowCta,
  StatusScreen,
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

/**
 * Poll cadence, by how long the order has been in flight. Most finish inside a
 * minute; the steps back off so an order the backend has lost doesn't get
 * hammered for as long as the tab stays open.
 */
const POLL_STEPS = [
  { until: 60_000, every: 4_000 },
  { until: 300_000, every: 10_000 },
  { until: Infinity, every: 30_000 },
]
/** Say something once "under a minute" has stopped being true. */
const POLL_SLOW_AFTER_MS = 120_000
/** Stop polling. The order is still open — it just isn't finishing here. */
const POLL_GIVE_UP_MS = 900_000

function pollDelayFor(waitedMs: number): number {
  return POLL_STEPS.find((s) => waitedMs < s.until)!.every
}

/** Amounts are USDT: whole where it's whole, never more than 2dp. */
function fmtUsdt(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

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

/**
 * Backend and chain errors arrive as raw payloads (Privy validation blobs,
 * RPC 429s). Map the ones we can recognise onto something actionable; the
 * original is still available behind the Details toggle.
 */
function humanError(raw: string): string {
  const s = raw.toLowerCase()
  if (s.includes("429") || s.includes("too many requests") || s.includes("capacity limit"))
    return "Our node provider is rate-limited right now, so we can't read that chain. Try another network, or give it a few minutes."
  if (s.includes("unrecognized key") || s.includes("invalid_data"))
    return "That network's transfer service is misconfigured on our side — we've been notified. Try another network in the meantime."
  if (s.includes("insufficient"))
    return "There isn't enough balance to cover this, including fees."
  // The TRX gas pre-flight already phrases its error for humans — pass it
  // through rather than flattening it into the generic fallback.
  if (s.includes("trx")) return raw
  if (s.includes("wallet found") || s.includes("create your wallets"))
    return "Your wallet on that network isn't set up yet. Try another network, or reload the page to finish setting it up."
  // "…is temporarily unavailable for purchase" — the treasury is short on that
  // chain. Deliberately not a bare "available": "Availability check failed" is
  // a different failure with different advice.
  if (s.includes("unavailable"))
    return "That network doesn't have enough USDT to fill this right now. Try a smaller amount, or another network."
  if (s.includes("timeout") || s.includes("fetch failed") || s.includes("unreachable"))
    return "We couldn't reach the service. Your funds are untouched — try again shortly."
  if (s.includes("unauthorized") || s.includes("expired token"))
    return "Your session expired. Refresh the page and sign in again."
  return "Something went wrong and nothing was charged. Try again, or pick another network."
}

type Mode = "buy" | "sell"

/** The modal variant's column — same children as FlowShell, none of the page
 *  margins (the modal/drawer shell already frames it). */
function ModalBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("p-4 sm:p-5", className)}>{children}</div>
}

export function BuySellClient({
  mode,
  variant = "page",
  onInFlightChange,
}: {
  mode: Mode
  /** "page" = the /buy and /sell routes (FlowShell + PageHeader — deep links
   *  and redirects keep working). "modal" = the same flow inside the
   *  money-flow modal/drawer, with a compact header instead. */
  variant?: "page" | "modal"
  /** Reports when dismissing would abandon an in-flight order — mid-submit,
   *  or a processing (non-terminal) status screen. The modal shell uses this
   *  to ignore backdrop clicks and Escape at exactly those moments. */
  onInFlightChange?: (inFlight: boolean) => void
}) {
  const isBuy = mode === "buy"
  const isModal = variant === "modal"
  const Shell = isModal ? ModalBody : FlowShell

  const { addresses, isLoading: walletsLoading, refreshWallets } = useWallet()

  const [amount, setAmount] = React.useState("")
  const [network, setNetwork] = React.useState<string>("tron")
  const [enabled, setEnabled] = React.useState<string[]>([])
  // How much USDT the treasury can actually disburse per chain. Buy only —
  // selling sends the user's own USDT, so the treasury isn't the constraint.
  const [chainAvailable, setChainAvailable] = React.useState<Record<string, number | undefined>>({})
  const [limits, setLimits] = React.useState({ min: 1, max: 5000, feePercent: 0 })
  const [cashUsd, setCashUsd] = React.useState<number | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<Buy | Sell | null>(null)
  // Deposit has two halves: buy with your Dollar Account (needs the treasury)
  // and receive from an external wallet (only needs your own address). The
  // second keeps working when the first is paused.
  const [tab, setTab] = React.useState<"buy" | "receive">("buy")

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
          setChainAvailable(
            Object.fromEntries(NETWORKS.map((n) => [n.key, a.chains[n.key as BuyNetwork]?.available])),
          )
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
  // Each attempt schedules the next one, so the gap can widen as the wait does
  // — and stop entirely, rather than polling into an empty room forever.
  const pollStartedAt = React.useRef<number | null>(null)
  const [waitedMs, setWaitedMs] = React.useState(0)

  React.useEffect(() => {
    if (!result) return
    const terminal = isBuy ? BUY_TERMINAL : SELL_TERMINAL
    if (terminal.includes(result.status)) return
    if (pollStartedAt.current === null) pollStartedAt.current = Date.now()
    if (waitedMs >= POLL_GIVE_UP_MS) return

    const id = setTimeout(async () => {
      try {
        const next = isBuy ? await fetchBuy(result.reference) : await fetchSell(result.reference)
        setResult(next)
      } catch { /* a poll that fails isn't an order that failed — try again */ }
      setWaitedMs(Date.now() - (pollStartedAt.current ?? Date.now()))
    }, pollDelayFor(waitedMs))
    return () => clearTimeout(id)
  }, [result, waitedMs, isBuy])

  /* In flight = money is (or may be) moving and the UI is its only witness:
     the initiate call is awaiting, or the status screen is still non-terminal.
     Success/failure screens are safe to dismiss. */
  const terminalStatuses = isBuy ? BUY_TERMINAL : SELL_TERMINAL
  const inFlight = submitting || (!!result && !terminalStatuses.includes(result.status))
  React.useEffect(() => {
    onInFlightChange?.(inFlight)
  }, [inFlight, onInFlightChange])

  /** Back to the form, with the poll clock wound back. */
  function resetFlow() {
    pollStartedAt.current = null
    setWaitedMs(0)
    setResult(null)
    setAmount("")
  }

  /** Resume after giving up, at the backed-off cadence rather than from zero. */
  function resumePolling() {
    pollStartedAt.current = Date.now() - POLL_SLOW_AFTER_MS
    setWaitedMs(POLL_SLOW_AFTER_MS)
  }

  const networkLabel = NETWORKS.find((n) => n.key === network)?.label ?? network

  /* The wallet the USDT is delivered to (buy) or sent from (sell). The service
     404s without one; knowing here means saying so before the CTA, not after. */
  const walletAddress = addresses?.[network as keyof WalletAddresses] ?? ""
  const missingWallet = !walletsLoading && !walletAddress

  /* An order can't exceed what the treasury holds on that chain. The service
     re-checks at submit and 409s — this just moves the news earlier. */
  const treasuryMax = isBuy ? chainAvailable[network] : undefined
  const effectiveMax = treasuryMax != null ? Math.min(limits.max, treasuryMax) : limits.max
  const treasuryCapped = effectiveMax < limits.max

  const amt = parseFloat(amount) || 0
  const usdSide = isBuy ? amt * (1 + limits.feePercent / 100) : amt * (1 - limits.feePercent / 100)
  const shortBy = isBuy && cashUsd !== null ? usdSide - cashUsd : 0
  const insufficientCash = isBuy && cashUsd !== null && usdSide > cashUsd
  // Max the user can actually buy, fee included — drives the 25/50/75/Max chips.
  const maxSpendUsdt = isBuy && cashUsd !== null
    ? Math.min(effectiveMax, cashUsd / (1 + limits.feePercent / 100))
    : null

  /* Paused or failed-to-load: the form stays visible but inert. */
  const inert = !!loadError || enabled.length === 0

  /* The blocker ladder — the CTA always says WHY it can't proceed. */
  const blocker =
    inert ? (isBuy ? "Buying unavailable right now" : "Selling unavailable right now")
    : walletsLoading ? "Checking your wallet…"
    : missingWallet ? `No ${networkLabel} wallet yet`
    : effectiveMax <= 0 ? `No USDT available on ${networkLabel} right now`
    :
    amt <= 0 ? "Enter an amount"
    : amt < limits.min ? `Minimum is ${limits.min} USDT`
    : amt > effectiveMax
      ? treasuryCapped
        ? `Only ${fmtUsdt(effectiveMax)} USDT available on ${networkLabel}`
        : `Maximum is ${limits.max.toLocaleString()} USDT`
    : insufficientCash ? "Not enough in your Dollar Account"
    : null
  const ctaLabel = submitting
    ? isBuy ? "Placing your order…" : "Starting the transfer…"
    : blocker ?? (isBuy ? `Buy ${amt.toLocaleString()} USDT` : `Sell ${amt.toLocaleString()} USDT`)

  /* Amount-line validation, phrased as help rather than a scold. */
  const amountProblem =
    amt > 0 && amt < limits.min ? `The minimum is ${limits.min} USDT.`
    : amt > effectiveMax
      ? treasuryCapped
        ? `Only ${fmtUsdt(effectiveMax)} USDT is available on ${networkLabel} right now — try a smaller amount, or another network.`
        : `The maximum is ${limits.max.toLocaleString()} USDT per order.`
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

    /* Still running, long past "under a minute". Say so rather than let the
       spinner keep making a promise the flow has already broken. */
    const stalled = !done && !failed && waitedMs >= POLL_GIVE_UP_MS
    const slow = !done && !failed && !stalled && waitedMs >= POLL_SLOW_AFTER_MS

    return (
      <Shell>
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
                : stalled || slow
                  ? "Your order is still open — this is taking longer than it usually does."
                  : "This usually takes under a minute."
          }
          stages={!failed ? stages : undefined}
          activeIndex={done ? stages.length : stageIndex(stages, result.status)}
          txHash={result.txHash}
          autoUpdating={!stalled}
          notice={
            stalled
              ? `We've stopped checking automatically. Nothing is lost — reference ${result.reference}. Check again, or find it in your history.`
              : slow
                ? "You can leave this page. The order carries on either way, and history will show how it ends."
                : undefined
          }
          primary={
            done
              ? { label: "View history", href: "/transactions" }
              : failed
                ? { label: "Start over", onClick: resetFlow }
                : stalled
                  ? { label: "Check again", onClick: resumePolling }
                  : undefined
          }
          secondary={
            done
              ? { label: isBuy ? "Buy more" : "Sell more", onClick: resetFlow }
              : failed || stalled
                ? { label: "View history", href: "/transactions" }
                : undefined
          }
        />
      </Shell>
    )
  }

  /* ── Form ───────────────────────────────────────────────────────────── */
  const title = isBuy ? "Deposit USDT" : "Withdraw USDT"
  const subtitle = isBuy
    ? "Pay from your Dollar Account — USDT lands in your wallet."
    : "USDT leaves your wallet — dollars land in your Dollar Account."

  return (
    <Shell>
      {isModal ? (
        /* Compact header — sits left of the shell's close button (pr-10
           keeps the title clear of it). */
        <div className="mb-4 flex flex-col gap-0.5 pr-10">
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      ) : (
        <PageHeader title={title} subtitle={subtitle} back="/" className="mb-5" />
      )}

      {isBuy && (
        <div className="mb-4">
          <Segmented
            options={[
              { key: "buy" as const, label: "Buy with cash" },
              { key: "receive" as const, label: "Receive" },
            ]}
            value={tab}
            onChange={setTab}
          />
        </div>
      )}

      {isBuy && tab === "receive" ? (
        <ReceivePanel only={["tron", "solana", "ethereum"]} asset="USDT" />
      ) : loading ? (
        <FlowSkeleton />
      ) : (
        <div className="flex flex-col gap-4">
          {loadError && (
            <AnnouncementBanner
              title="We couldn't load live limits"
              detail={`${humanError(loadError)} You can still see the form, but orders are disabled until this recovers.`}
              tone="error"
            />
          )}
          {!loadError && enabled.length === 0 && (
            <AnnouncementBanner
              title={isBuy ? "Buying is paused right now" : "Selling is paused right now"}
              detail="The treasury is topping up. This is usually brief — everything below is disabled until it's back."
              action={
                isBuy
                  ? { label: "Receive from another wallet instead", onClick: () => setTab("receive") }
                  : undefined
              }
            />
          )}
          {!inert && missingWallet && (
            <AnnouncementBanner
              title={`Your ${networkLabel} wallet isn't ready`}
              detail={
                isBuy
                  ? `We create a wallet per network, and this one hasn't finished. Pick another network, or try again — the USDT needs somewhere to land.`
                  : `We create a wallet per network, and this one hasn't finished. Pick another network, or try again.`
              }
              action={{ label: "Try again", onClick: () => { void refreshWallets() } }}
            />
          )}
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
              hint={
                treasuryCapped
                  ? `Min ${limits.min} · Up to ${fmtUsdt(effectiveMax)} on ${networkLabel} right now`
                  : `Min ${limits.min} · Max ${limits.max.toLocaleString()}`
              }
              problem={amountProblem}
              maxSpend={maxSpendUsdt}
              presets={!maxSpendUsdt ? [10, 50, 100, 500].filter((p) => p >= limits.min && p <= effectiveMax) : undefined}
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

          {submitError && <ErrorDetail message={humanError(submitError)} raw={submitError} />}

          <FlowCta label={ctaLabel} onClick={submit} disabled={!!blocker || inert} busy={submitting} />
        </div>
      )}
    </Shell>
  )
}

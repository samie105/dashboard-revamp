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
  RouteStrip,
  AmountField,
  ChoiceRow,
  DetailPanel,
  FlowCta,
  StatusScreen,
  FlowSkeleton,
  useStageProgress,
  type Stage,
} from "@/components/ui/flow"
import { FlowTerminal, OptionRows } from "@/components/flows/flow-terminal"
import { useOnline } from "@/hooks/useOnline"
import {
  savePendingFlow,
  readPendingFlow,
  clearPendingFlow,
} from "@/lib/pending-flow"
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
  // Fills the fixed-height shell so the sticky CTA settles at the bottom on
  // short screens instead of floating mid-modal above dead space.
  return <div className={cn("flex flex-1 flex-col p-4 sm:p-5", className)}>{children}</div>
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
  /* Set the moment the CTA is pressed, cleared when the flow resets. Its
     presence is what puts the status screen on screen BEFORE the service has
     answered — see the status block below. */
  const [submittedAt, setSubmittedAt] = React.useState<number | null>(null)
  /* True only while a remembered order is being looked up, so a recovering
     flow shows a skeleton instead of flashing the empty form first. */
  const [recovering, setRecovering] = React.useState(false)
  const online = useOnline()
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

  /* Pick up an order this browser started and never saw finish. The modal
     lives in a portal that unmounts on close and the X stays live mid-transfer,
     so the reference used to exist only in React state — closing at the wrong
     moment left a charge in progress and nothing to quote. The service is the
     authority on how it ended; this only asks. */
  React.useEffect(() => {
    const kind = isBuy ? "buy" : "sell"
    const pending = readPendingFlow(kind)
    if (!pending) return
    let cancelled = false
    setRecovering(true)
    ;(isBuy ? fetchBuy(pending.reference) : fetchSell(pending.reference))
      .then((r) => {
        if (cancelled) return
        const terminal = isBuy ? BUY_TERMINAL : SELL_TERMINAL
        if (terminal.includes(r.status)) {
          // Finished while we weren't looking. History has it; don't hijack
          // the form to announce old news.
          clearPendingFlow(kind)
        } else {
          pollStartedAt.current = pending.startedAt
          setWaitedMs(Date.now() - pending.startedAt)
          setSubmittedAt(pending.startedAt)
          setResult(r)
        }
      })
      .catch(() => {
        // A reference the service won't acknowledge is worse than none — it
        // would strand the user on a status screen that can never advance.
        if (!cancelled) clearPendingFlow(kind)
      })
      .finally(() => {
        if (!cancelled) setRecovering(false)
      })
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
  const isTerminal = !!result && terminalStatuses.includes(result.status)
  const inFlight = submitting || (!!result && !isTerminal)

  /* Once an order reaches a terminal state there is nothing left to recover,
     and a stale entry would greet the next visit with a lookup for an order
     that finished last week. */
  React.useEffect(() => {
    if (isTerminal) clearPendingFlow(isBuy ? "buy" : "sell")
  }, [isTerminal, isBuy])
  React.useEffect(() => {
    onInFlightChange?.(inFlight)
  }, [inFlight, onInFlightChange])

  /** Back to the form, with the poll clock wound back. */
  function resetFlow() {
    clearPendingFlow(isBuy ? "buy" : "sell")
    pollStartedAt.current = null
    setWaitedMs(0)
    setResult(null)
    setSubmittedAt(null)
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
    !online ? "You're offline"
    : inert ? (isBuy ? "Buying unavailable right now" : "Selling unavailable right now")
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
    const startedAt = Date.now()
    setSubmitting(true)
    setSubmittedAt(startedAt)
    setSubmitError(null)
    try {
      // The field already caps decimals; this guards the arithmetic path
      // (percentage chips divide a balance and can land on a long tail).
      const usdtAmount = Math.round(amt * 100) / 100
      const res = isBuy
        ? await initiateBuy({ usdtAmount, network: network as BuyNetwork })
        : await initiateSell({ usdtAmount, network: network as SellNetwork })
      // Written down BEFORE it reaches React state: from here on the order
      // survives a close, a refresh, or the tab being killed outright.
      savePendingFlow(isBuy ? "buy" : "sell", res.reference, startedAt)
      pollStartedAt.current = startedAt
      setResult(res)
    } catch (e) {
      setSubmittedAt(null)
      setSubmitError(e instanceof CryptoApiError ? e.message : "Something went wrong before anything was charged — it's safe to try again.")
    } finally {
      setSubmitting(false)
    }
  }

  /* The checklist's position, kept monotonic and timestamped. Computed before
     the early return so the hook runs on every render, form included. */
  const activeStages = isBuy ? BUY_STAGES : SELL_STAGES
  const rawStageIndex =
    result?.status === "completed"
      ? activeStages.length
      : Math.max(0, activeStages.findIndex((st) => st.key === (result?.status ?? "pending")))
  const stageProgress = useStageProgress(rawStageIndex, submittedAt)

  /* ── Status screen — the poll's progress report ─────────────────────── */
  /* Rendered from the moment the CTA is pressed, not from the moment the
     service answers. Initiating a buy charges a real account and can take a
     handful of seconds; leaving the user on a greyed-out button for those
     seconds is the least reassuring possible response to "I just spent money".
     The checklist opens on stage one and the service catches up to it. */
  if (result || submittedAt !== null) {
    const stages = activeStages
    const status = result?.status ?? "pending"
    const done = status === "completed"
    const terminal = isBuy ? BUY_TERMINAL : SELL_TERMINAL
    const failed = !!result && terminal.includes(status) && !done
    const cancelled = status === "cancelled"
    const activeIndex = done ? stages.length : stageProgress.index

    const failureCaption = isBuy
      ? cancelled
        ? "This order was cancelled. Nothing was charged to your Dollar Account."
        : (result && "deliveryError" in result && result.deliveryError) ||
          "Your payment went through but delivery didn't complete — support has been notified and will retry or refund automatically."
      : (result && "error" in result && result.error) ||
        "The transfer couldn't be completed. Your USDT hasn't left — it's safe to try again."

    /* Still running, long past "under a minute". Say so rather than let the
       spinner keep making a promise the flow has already broken. */
    const stalled = !done && !failed && waitedMs >= POLL_GIVE_UP_MS
    const slow = !done && !failed && !stalled && waitedMs >= POLL_SLOW_AFTER_MS
    /* Offline is a different stall with different advice: nothing is wrong
       with the order, we simply can't see it. Saying "updates automatically"
       here would be a promise the browser can't keep. */
    const blind = !done && !failed && !online

    return (
      <Shell>
        <StatusScreen
          direction={isBuy ? "in" : "out"}
          state={done ? "success" : failed ? "failure" : "processing"}
          headline={
            done
              ? isBuy ? `Bought ${result!.usdtAmount} USDT` : `Sold ${result!.usdtAmount} USDT`
              : failed
                ? cancelled ? "Order cancelled" : isBuy ? "Delivery didn't complete" : "Transfer didn't complete"
                : isBuy ? "Buying your USDT" : "Selling your USDT"
          }
          caption={
            done
              ? isBuy
                ? `$${(result as Buy).usdCharged.toFixed(2)} was charged to your Dollar Account. The USDT is in your ${NETWORKS.find((nw) => nw.key === result!.network)?.label} wallet.`
                : `$${(result as Sell).usdProceeds.toFixed(2)} was credited to your Dollar Account.`
              : failed
                ? failureCaption
                : blind
                  ? "You're offline, so we can't check on this right now. The order carries on without you."
                  : stalled || slow
                    ? "Your order is still open — this is taking longer than it usually does."
                    : !result
                      ? "Placing your order…"
                      : "This usually takes under a minute."
          }
          stages={!failed ? stages : undefined}
          activeIndex={activeIndex}
          stageStartedAt={stageProgress.since}
          reference={result?.reference}
          txHash={result?.txHash}
          autoUpdating={!stalled && !blind}
          notice={
            blind
              ? "We'll pick up where we left off as soon as you're back online."
              : stalled
                ? `We've stopped checking automatically. Nothing is lost — the reference below identifies this order. Check again, or find it in your history.`
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

  /* Everything below is shared verbatim by both presentations — the modal's
     terminal layout and the page's single column — so the two can never
     drift apart on copy, math or gating. */
  const banners = (
    <>
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
      {!online && (
        <AnnouncementBanner
          title="You're offline"
          detail="We can't reach the service or read live limits. Nothing here will submit until you're back."
          tone="error"
        />
      )}
      {online && !inert && cashUsd === null && !loading && (
        /* Silence here used to read as "no constraint": with cashUsd null
           the insufficient-funds check is skipped entirely and the CTA
           happily offers to spend money we never confirmed was there. */
        <AnnouncementBanner
          title="We couldn't read your Dollar Account balance"
          detail="You can still place an order, but we can't warn you in advance if there isn't enough — the service will decline it if so."
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
    </>
  )

  /* The route's endpoints — the wallet side tracks the network picker,
     address included: the strongest "this is real" detail the form has. */
  const dollarSide = {
    label: "Dollar Account",
    sub:
      cashUsd !== null
        ? `$${cashUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })} available`
        : undefined,
  }
  const walletSide = {
    label: `${networkLabel} wallet`,
    sub: walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : "USDT",
  }

  const approxLine =
    amt > 0
      ? isBuy
        ? `≈ $${usdSide.toFixed(2)} charged to your Dollar Account`
        : `≈ $${usdSide.toFixed(2)} to your Dollar Account`
      : undefined
  const hintLine = treasuryCapped
    ? `Min ${limits.min} · Up to ${fmtUsdt(effectiveMax)} on ${networkLabel} right now`
    : `Min ${limits.min} · Max ${limits.max.toLocaleString()}`
  const presetsList = !maxSpendUsdt
    ? [10, 50, 100, 500].filter((p) => p >= limits.min && p <= effectiveMax)
    : undefined

  /* The receipt — every choice the order will be placed with, itemised,
     with the fee in dollars rather than a bare percent. */
  const receiptRows =
    amt > 0
      ? [
          { label: isBuy ? "You receive" : "You sell", value: `${amt.toLocaleString()} USDT` },
          { label: "Network", value: networkLabel },
          ...(limits.feePercent > 0
            ? [{ label: `Fee (${limits.feePercent}%)`, value: `$${Math.abs(usdSide - amt).toFixed(2)}` }]
            : []),
          {
            label: isBuy ? "Charged to Dollar Account" : "Credited to Dollar Account",
            value: `$${usdSide.toFixed(2)}`,
            strong: true,
          },
          /* What the account holds AFTER the move — the number a person
             actually checks before committing. Skipped when it would be
             negative (the blocker already says there isn't enough). */
          ...(cashUsd !== null && !(isBuy && insufficientCash)
            ? [
                {
                  label: "Dollar Account after",
                  value: `$${(isBuy ? cashUsd - usdSide : cashUsd + usdSide).toFixed(2)}`,
                },
              ]
            : []),
        ]
      : null

  /* Each network row carries its real wallet address — the strongest "this
     is where it lands" detail the picker can show. */
  const networkOptions = NETWORKS.filter((n) => enabled.includes(n.key)).map((n) => {
    const addr = addresses?.[n.key as keyof WalletAddresses]
    return {
      key: n.key as string,
      label: n.label,
      icon: n.icon,
      sub: addr ? `${addr.slice(0, 8)}…${addr.slice(-6)}` : walletsLoading ? "Checking wallet…" : "Wallet not ready",
    }
  })

  /* ── Modal presentation: the terminal ─────────────────────────────────── */
  if (isModal) {
    const tabs = isBuy ? (
      <div className="ws-casc ws-casc-1">
        <Segmented
          options={[
            { key: "buy" as const, label: "Buy with cash" },
            { key: "receive" as const, label: "Receive" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>
    ) : null

    if (isBuy && tab === "receive") {
      return (
        <ModalBody>
          <div className="mb-4">{tabs}</div>
          <ReceivePanel only={["tron", "solana", "ethereum"]} asset="USDT" />
        </ModalBody>
      )
    }
    if (loading || recovering) {
      return (
        <ModalBody>
          {tabs && <div className="mb-4">{tabs}</div>}
          <FlowSkeleton />
        </ModalBody>
      )
    }
    return (
      <FlowTerminal
        direction={isBuy ? "in" : "out"}
        title={title}
        amount={amount}
        onAmountChange={setAmount}
        unit="USDT"
        approx={approxLine}
        problem={amountProblem}
        hint={hintLine}
        maxSpend={maxSpendUsdt}
        presets={presetsList}
        route={{ from: isBuy ? dollarSide : walletSide, to: isBuy ? walletSide : dollarSide }}
        topSlot={tabs}
        banners={banners}
        picker={
          <div className="flex flex-col gap-2">
            <Eyebrow>{isBuy ? "Receive on" : "Send from"}</Eyebrow>
            <OptionRows options={networkOptions} value={network} onChange={setNetwork} disabled={inert} />
          </div>
        }
        receipt={receiptRows}
        errorSlot={submitError ? <ErrorDetail message={humanError(submitError)} raw={submitError} /> : undefined}
        cta={<FlowCta label={ctaLabel} onClick={submit} disabled={!!blocker || inert} busy={submitting} />}
        disabled={inert}
      />
    )
  }

  /* ── Page presentation (/buy, /sell): the single column ──────────────── */
  return (
    <FlowShell>
      <PageHeader title={title} subtitle={subtitle} back="/" className="mb-5" />

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
      ) : loading || recovering ? (
        <FlowSkeleton />
      ) : (
        <div className="flex flex-1 flex-col gap-4">
          {banners}

          <RouteStrip
            direction={isBuy ? "in" : "out"}
            from={isBuy ? dollarSide : walletSide}
            to={isBuy ? walletSide : dollarSide}
          />

          {/* The hero figure stays unboxed — a borderless amount breathing on
              the surface, per the house rule. */}
          <div className="py-1">
            <AmountField
              value={amount}
              onChange={setAmount}
              unit="USDT"
              hint={hintLine}
              problem={amountProblem}
              approx={approxLine}
              maxSpend={maxSpendUsdt}
              presets={presetsList}
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

          {receiptRows && <DetailPanel rows={receiptRows} />}

          {submitError && <ErrorDetail message={humanError(submitError)} raw={submitError} />}

          <FlowCta label={ctaLabel} onClick={submit} disabled={!!blocker || inert} busy={submitting} />
        </div>
      )}
    </FlowShell>
  )
}

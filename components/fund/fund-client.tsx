"use client"

/**
 * Fund / withdraw the Hyperliquid trading account against the Dollar Account —
 * same poll-driven state machine as before, rebuilt on the flow kit.
 *
 * Fund: USD hold → treasury USDC on Arbitrum → HL bridge → Spot/Perps.
 * Withdraw: HL → treasury → USD credited to the Dollar Account.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Clock01Icon, Wallet01Icon } from "@hugeicons/core-free-icons"
import { Eyebrow, PageHeader } from "@/components/ui/system"
import {
  FlowShell,
  AnnouncementBanner,
  ErrorDetail,
  RouteStrip,
  AmountField,
  ChoiceRow,
  DetailPanel,
  InlineNotice,
  FlowCta,
  StatusScreen,
  UnavailablePanel,
  FlowSkeleton,
  useStageProgress,
  type Stage,
} from "@/components/ui/flow"
import { useOnline } from "@/hooks/useOnline"
import {
  savePendingFlow,
  readPendingFlow,
  clearPendingFlow,
} from "@/lib/pending-flow"
import { FlowTerminal, OptionRows } from "@/components/flows/flow-terminal"
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

/**
 * Poll cadence, by how long the transfer has been in flight — the same policy
 * buy/sell has used all along. This flow previously held a flat 4-second
 * setInterval with no ceiling: a transfer the bridge had lost was re-queried
 * every four seconds for as long as the tab stayed open, and the UI never once
 * admitted that something had gone quiet.
 */
const POLL_STEPS = [
  { until: 60_000, every: 4_000 },
  { until: 300_000, every: 10_000 },
  { until: Infinity, every: 30_000 },
]
/** Bridging genuinely takes minutes, so "slow" starts later here than on a
 *  same-ledger buy. */
const POLL_SLOW_AFTER_MS = 240_000
const POLL_GIVE_UP_MS = 1_200_000

function pollDelayFor(waitedMs: number): number {
  return POLL_STEPS.find((s) => waitedMs < s.until)!.every
}

type Mode = "fund" | "withdraw"

/** The modal variant's column — same children, none of the page margins
 *  (the modal/drawer shell already frames it). Mirrors BuySellClient. */
function ModalBody({ children }: { children: React.ReactNode }) {
  // Fills the fixed-height shell so the sticky CTA settles at the bottom on
  // short screens instead of floating mid-modal above dead space.
  return <div className="flex flex-1 flex-col p-4 sm:p-5">{children}</div>
}

export function FundClient({
  mode,
  variant = "page",
  onInFlightChange,
  onCompactChange,
  onDismiss,
}: {
  mode: Mode
  /** "page" = the /fund and /trading-withdraw routes. "modal" = the same flow
   *  inside the money-flow modal/drawer, with a compact header. */
  variant?: "page" | "modal"
  /** Reports when dismissing would abandon an in-flight transfer, so the modal
   *  shell can ignore backdrop clicks and Escape at exactly those moments. */
  onInFlightChange?: (inFlight: boolean) => void
  /** Reports when this panel is showing a single-column screen (status,
   *  setup gate, load error) rather than the two-pane terminal — the modal
   *  shell narrows its frame to match. */
  onCompactChange?: (compact: boolean) => void
  /** Closes the containing modal. Dead-end screens use it instead of a link so
   *  they don't navigate away from whatever the modal opened over. */
  onDismiss?: () => void
}) {
  const isFund = mode === "fund"
  const isModal = variant === "modal"
  const Shell = isModal ? ModalBody : FlowShell

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
  const [submittedAt, setSubmittedAt] = React.useState<number | null>(null)
  const [recovering, setRecovering] = React.useState(false)
  const online = useOnline()



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

  /* Pick up a transfer this browser started and never saw finish — the modal
     unmounts on close and the X stays live mid-transfer, so the reference used
     to exist only in React state. The service is the authority on how it
     ended; this only asks. */
  React.useEffect(() => {
    const kind = isFund ? "fund" : "trading-withdraw"
    const pending = readPendingFlow(kind)
    if (!pending) return
    let cancelled = false
    setRecovering(true)
    ;(isFund ? fetchFund(pending.reference) : fetchTradingWithdraw(pending.reference))
      .then((r) => {
        if (cancelled) return
        const terminal: string[] = isFund ? FUND_TERMINAL : TRADING_WITHDRAW_TERMINAL
        if (terminal.includes(r.status)) {
          clearPendingFlow(kind)
        } else {
          pollStartedAt.current = pending.startedAt
          setWaitedMs(Date.now() - pending.startedAt)
          setSubmittedAt(pending.startedAt)
          setResult(r)
        }
      })
      // A reference the service won't acknowledge would strand the user on a
      // status screen that can never advance.
      .catch(() => { if (!cancelled) clearPendingFlow(kind) })
      .finally(() => { if (!cancelled) setRecovering(false) })
    return () => { cancelled = true }
  }, [isFund])

  /* Poll a non-terminal result. Each attempt schedules the next, so the gap
     widens as the wait does — and stops, rather than polling into an empty
     room for as long as the tab lives. */
  const pollStartedAt = React.useRef<number | null>(null)
  const [waitedMs, setWaitedMs] = React.useState(0)

  React.useEffect(() => {
    if (!result) return
    const terminal: string[] = isFund ? FUND_TERMINAL : TRADING_WITHDRAW_TERMINAL
    if (terminal.includes(result.status)) return
    if (pollStartedAt.current === null) pollStartedAt.current = Date.now()
    if (waitedMs >= POLL_GIVE_UP_MS) return

    const id = setTimeout(async () => {
      try {
        const next = isFund
          ? await fetchFund(result.reference)
          : await fetchTradingWithdraw(result.reference)
        setResult(next)
      } catch { /* a poll that fails isn't a transfer that failed */ }
      setWaitedMs(Date.now() - (pollStartedAt.current ?? Date.now()))
    }, pollDelayFor(waitedMs))
    return () => clearTimeout(id)
  }, [result, waitedMs, isFund])

  /** Resume after giving up, at the backed-off cadence rather than from zero. */
  function resumePolling() {
    pollStartedAt.current = Date.now() - POLL_SLOW_AFTER_MS
    setWaitedMs(POLL_SLOW_AFTER_MS)
  }

  /** Back to the form, with the clock wound back and nothing left to recover. */
  function resetFlow() {
    clearPendingFlow(isFund ? "fund" : "trading-withdraw")
    pollStartedAt.current = null
    setWaitedMs(0)
    setResult(null)
    setSubmittedAt(null)
    setAmount("")
  }

  // Dismissing mid-transfer is the one unforgivable accident — tell the modal
  // shell when a submit is in the air or a status screen is still moving.
  const terminalNow = result
    ? (isFund ? (FUND_TERMINAL as readonly string[]) : (TRADING_WITHDRAW_TERMINAL as readonly string[])).includes(result.status)
    : false
  const inFlight = submitting || (!!result && !terminalNow)
  React.useEffect(() => {
    onInFlightChange?.(inFlight)
  }, [inFlight, onInFlightChange])

  /* Status, the setup gate and the load-error screen are single columns —
     ask the shell for the narrow frame while they're up. */
  const statusVisible = !!result || submittedAt !== null
  React.useEffect(() => {
    onCompactChange?.(statusVisible || !!loadError || walletReady === false)
  }, [statusVisible, loadError, walletReady, onCompactChange])

  React.useEffect(() => {
    if (terminalNow) clearPendingFlow(isFund ? "fund" : "trading-withdraw")
  }, [terminalNow, isFund])

  const amt = parseFloat(amount) || 0
  const sourceBalance = isFund ? cashUsd : hl ? (side === "spot" ? hl.spot : hl.perps) : null
  const costUsd = isFund ? amt * (1 + limits.feePercent / 100) : amt
  const shortBy = sourceBalance !== null ? costUsd - sourceBalance : 0
  const insufficient = sourceBalance !== null && costUsd > sourceBalance
  const maxSpend = sourceBalance !== null
    ? Math.min(limits.max, isFund ? sourceBalance / (1 + limits.feePercent / 100) : sourceBalance)
    : null

  const inert = !limits.enabled
  const blocker =
    !online ? "You're offline"
    : inert ? (isFund ? "Funding unavailable right now" : "Withdrawals unavailable right now")
    : amt <= 0 ? "Enter an amount"
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
    const startedAt = Date.now()
    setSubmitting(true)
    setSubmittedAt(startedAt)
    setSubmitError(null)
    try {
      // The field caps decimals; this guards the percentage chips, which divide
      // a balance and can land on a long floating-point tail.
      const amountUsdc = Math.round(amt * 100) / 100
      const res = isFund
        ? await initiateFund({ amountUsdc, destination: side })
        : await initiateTradingWithdraw({ amountUsdc, source: side })
      // Written down before it reaches React state: from here the transfer
      // survives a close, a refresh, or the tab being killed outright.
      savePendingFlow(isFund ? "fund" : "trading-withdraw", res.reference, startedAt)
      pollStartedAt.current = startedAt
      setResult(res)
    } catch (e) {
      setSubmittedAt(null)
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
      /* Ask rather than assume. A setup call that returns 200 after only half
         completing used to drop the user straight into a form whose every
         submit would fail with an error that never mentioned the wallet. */
      const status = await fetchTradingWalletStatus()
      setWalletReady(status.initialized)
      if (!status.initialized) {
        setSubmitError("Setup started but hasn't finished yet. Give it a moment and try again.")
      }
    } catch (e) {
      setSubmitError(e instanceof CryptoApiError ? e.message : "Setup didn't complete — try again.")
    } finally {
      setSettingUp(false)
    }
  }

  /* The checklist's position, kept monotonic and timestamped. Computed before
     the early return so the hook runs on every render, form included. */
  const activeStages = isFund ? FUND_STAGES : WITHDRAW_STAGES
  const rawStageIndex =
    result?.status === "completed"
      ? activeStages.length
      : (isFund ? FUND_STAGE_INDEX : WITHDRAW_STAGE_INDEX)[result?.status ?? "pending"] ?? 0
  const stageProgress = useStageProgress(rawStageIndex, submittedAt)

  /* ── Status screen ──────────────────────────────────────────────────── */
  /* On screen from the moment the CTA is pressed, not from the moment the
     service answers. Initiating a fund holds real dollars and can take several
     seconds; a greyed-out button is the least reassuring possible response to
     "I just moved money". The checklist opens on stage one and the service
     catches up to it. */
  if (result || submittedAt !== null) {
    const status = result?.status ?? "pending"
    const done = status === "completed"
    const failed = status === "failed"
    const stages = activeStages
    const index = done ? stages.length : stageProgress.index
    const eta = result && !isFund && "expectedSeconds" in result && result.expectedSeconds > 0
      ? Math.max(1, Math.round(result.expectedSeconds / 60))
      : null

    /* Bridging is slow by nature, so these thresholds are generous — but past
       them the spinner is making a promise the flow has already broken. */
    const stalled = !done && !failed && waitedMs >= POLL_GIVE_UP_MS
    const slow = !done && !failed && !stalled && waitedMs >= POLL_SLOW_AFTER_MS
    /* Offline is a different stall with different advice: nothing is wrong
       with the transfer, we simply can't see it. */
    const blind = !done && !failed && !online

    return (
      <Shell>
        <StatusScreen
          direction={isFund ? "in" : "out"}
          figure={`${(result?.amountUsdc ?? amt).toLocaleString()} USDC`}
          state={done ? "success" : failed ? "failure" : "processing"}
          headline={
            done
              ? `${result!.amountUsdc.toLocaleString()} USDC ${isFund ? "delivered" : "withdrawn"}`
              : failed
                ? isFund ? "Funding didn't complete" : "Withdrawal didn't complete"
                : isFund ? "Funding your trading account" : "Withdrawing to your Dollar Account"
          }
          caption={
            done
              ? isFund
                ? `Your ${side === "spot" ? "Spot" : "Futures"} balance is topped up and ready to trade.`
                : `$${(result && "creditUsd" in result ? result.creditUsd : result!.amountUsdc).toFixed(2)} was credited to your Dollar Account.`
              : failed
                ? result?.message ??
                  (isFund
                    ? "The transfer stopped before completing. Anything already charged will be returned automatically — support has been notified."
                    : "The withdrawal stopped before completing. Your trading balance is untouched — it's safe to try again.")
                : blind
                  ? "You're offline, so we can't check on this right now. The transfer carries on without you."
                  : stalled || slow
                    ? "This is taking longer than it usually does — the transfer is still open."
                    : !result
                      ? "Starting the transfer…"
                      : eta
                        ? `Usually takes about ${eta} minute${eta > 1 ? "s" : ""}.`
                        : "This can take a couple of minutes."
          }
          stages={!failed ? stages : undefined}
          activeIndex={index}
          stageStartedAt={stageProgress.since}
          reference={result?.reference}
          autoUpdating={!stalled && !blind}
          notice={
            blind
              ? "We'll pick up where we left off as soon as you're back online."
              : stalled
                ? "We've stopped checking automatically. Nothing is lost — the reference below identifies this transfer. Check again, or find it in your history."
                : result && "partial" in result && result.partial
                  ? "Funds arrived but not exactly where requested — contact support if they don't show up in a few minutes."
                  : slow
                    ? "You can leave this page. The transfer carries on either way, and history will show how it ends."
                    : undefined
          }
          primary={
            done
              ? // In a modal the workspace is already behind you — closing
                // returns to it; a link would reload the page you're on.
                isModal && onDismiss
                ? { label: "Back to trading", onClick: onDismiss }
                : { label: "Go trade", href: "/trade" }
              : failed
                ? { label: "Start over", onClick: resetFlow }
                : stalled
                  ? { label: "Check again", onClick: resumePolling }
                  : undefined
          }
          secondary={
            done
              ? { label: "Done", onClick: resetFlow }
              : failed || stalled
                ? { label: "View history", href: "/transactions" }
                : undefined
          }
        />
      </Shell>
    )
  }

  /* ── Form ───────────────────────────────────────────────────────────── */
  const title = isFund ? "Fund trading account" : "Withdraw trading balance"
  const subtitle = isFund
    ? "Pay from your Dollar Account — funds land in Hyperliquid ready to trade."
    : "Move funds from Hyperliquid back to your Dollar Account."

  /* Shared by both presentations — the modal's terminal layout and the
     page's single column — so they can't drift apart on copy or gating. */
  const banners = (
    <>
      {!online && (
        <AnnouncementBanner
          title="You're offline"
          detail="We can't reach the service right now. Nothing here will submit until you're back."
          tone="error"
        />
      )}
      {!limits.enabled && (
        <AnnouncementBanner
          title={isFund ? "Funding is paused right now" : "Withdrawals are paused right now"}
          detail={limits.reason || "This is usually brief — everything below is disabled until it's back."}
        />
      )}
    </>
  )

  /* The route's endpoints — the venue side tracks the Spot/Futures picker,
     balance included. */
  const sideLabel = side === "spot" ? "Spot" : "Futures"
  const sideBalance = hl ? (side === "spot" ? hl.spot : hl.perps) : null
  const dollarSide = {
    label: "Dollar Account",
    sub:
      cashUsd !== null
        ? `$${cashUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })} available`
        : undefined,
  }
  const venueSide = {
    label: `Hyperliquid ${sideLabel}`,
    sub: sideBalance !== null ? `$${sideBalance.toFixed(2)} balance` : "Trading account",
  }

  const approxLine =
    amt > 0
      ? isFund
        ? `≈ $${costUsd.toFixed(2)} charged to your Dollar Account`
        : `≈ $${costUsd.toFixed(2)} to your Dollar Account`
      : undefined
  const hintLine = `Min ${limits.min} · Max ${limits.max.toLocaleString()}`

  /* The receipt — the transfer itemised, fee in dollars. */
  const receiptRows =
    amt > 0
      ? [
          { label: isFund ? "You transfer" : "You withdraw", value: `${amt.toLocaleString()} USDC` },
          { label: isFund ? "Destination" : "From", value: `Hyperliquid ${sideLabel}` },
          ...(limits.feePercent > 0
            ? [{ label: `Fee (${limits.feePercent}%)`, value: `$${Math.abs(costUsd - amt).toFixed(2)}` }]
            : []),
          {
            label: isFund ? "Charged to Dollar Account" : "Credited to Dollar Account",
            value: `$${costUsd.toFixed(2)}`,
            strong: true,
          },
          /* What the account holds AFTER the move — the number a person
             actually checks before committing. Skipped when it would be
             negative (the blocker already says there isn't enough). */
          ...(cashUsd !== null && !(isFund && insufficient)
            ? [
                {
                  label: "Dollar Account after",
                  value: `$${(isFund ? cashUsd - costUsd : cashUsd + costUsd).toFixed(2)}`,
                },
              ]
            : []),
        ]
      : null

  const venueOptions = [
    { key: "spot" as const, label: "Spot", sub: hl ? `$${hl.spot.toFixed(2)}` : undefined },
    { key: "perps" as const, label: "Futures", sub: hl ? `$${hl.perps.toFixed(2)}` : undefined },
  ]

  /* Dead-end screens render the same in both presentations. */
  const gate =
    loading || recovering ? (
      <FlowSkeleton />
    ) : loadError ? (
      <UnavailablePanel
        title="We couldn't load this screen"
        reason={`${loadError} — refresh to try again.`}
        tone="muted"
        action={isModal && onDismiss ? { label: "Close", onClick: onDismiss } : undefined}
      />
    ) : walletReady === false ? (
      /* One-time setup gate — a real screen with a single clear action.
         No fill of its own: bg-card was invisible inside the bg-card modal. */
      <div className="flex flex-col items-center gap-3 rounded-2xl px-6 py-8 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/[0.12] text-primary">
          <HugeiconsIcon icon={Wallet01Icon} className="h-6 w-6" />
        </span>
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
    ) : null

  /* ── Modal presentation: the terminal ─────────────────────────────────── */
  if (isModal) {
    if (gate) return <ModalBody>{gate}</ModalBody>
    return (
      <FlowTerminal
        direction={isFund ? "in" : "out"}
        title={title}
        amount={amount}
        onAmountChange={setAmount}
        unit="USDC"
        approx={approxLine}
        problem={amountProblem}
        hint={hintLine}
        maxSpend={maxSpend}
        route={{ from: isFund ? dollarSide : venueSide, to: isFund ? venueSide : dollarSide }}
        banners={banners}
        picker={
          <div className="flex flex-col gap-2">
            <Eyebrow>{isFund ? "Destination" : "Withdraw from"}</Eyebrow>
            <OptionRows options={venueOptions} value={side} onChange={setSide} disabled={inert} />
          </div>
        }
        receipt={receiptRows}
        errorSlot={submitError ? <ErrorDetail message={submitError} raw={submitError} /> : undefined}
        cta={<FlowCta label={ctaLabel} onClick={submit} disabled={!!blocker || inert} busy={submitting} />}
        disabled={inert}
      />
    )
  }

  /* ── Page presentation (/fund, /trading-withdraw): the single column ─── */
  return (
    <FlowShell>
      <PageHeader title={title} subtitle={subtitle} back="/" className="mb-5" />

      {gate ?? (
        <div className="flex flex-1 flex-col gap-4">
          {banners}

          <RouteStrip
            direction={isFund ? "in" : "out"}
            from={isFund ? dollarSide : venueSide}
            to={isFund ? venueSide : dollarSide}
          />

          {/* Unboxed hero amount — same treatment as buy/sell. */}
          <div className="py-1">
            <AmountField
              value={amount}
              onChange={setAmount}
              unit="USDC"
              hint={hintLine}
              problem={amountProblem}
              approx={approxLine}
              maxSpend={maxSpend}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Eyebrow>{isFund ? "Destination" : "Withdraw from"}</Eyebrow>
            <ChoiceRow columns={2} options={venueOptions} value={side} onChange={setSide} />
          </div>

          {receiptRows && <DetailPanel rows={receiptRows} />}

          {submitError && <ErrorDetail message={submitError} raw={submitError} />}

          <FlowCta label={ctaLabel} onClick={submit} disabled={!!blocker || inert} busy={submitting} />
        </div>
      )}
    </FlowShell>
  )
}

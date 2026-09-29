"use client"

/**
 * The OnSwitch onramp order, by backend `state` (guide §11 lines 952-963):
 * payment instructions while awaiting the bank deposit, then a staged status
 * screen. Instructions are rendered as returned, as plain text (guide lines
 * 755-757). "I've made the transfer" only refetches the order; an onramp is
 * never confirmed (guide §9.3 line 809).
 */

import { FiatAction as FlowCta } from "@/components/fiat/shared/FiatAction"
import { FiatStatus as StatusScreen } from "@/components/fiat/shared/FiatStatus"
import { FiatErrorDetail } from "@/components/fiat/shared/FiatErrorDetail"
import { formatCountdown } from "@/components/fiat/shared/format"
import { CopyButton } from "@/components/fiat/shared/SensitiveValue"
import { FlowHeader } from "@/components/ui/flow"
import { describeFiatError } from "@/lib/crypto-backend/fiat-errors"
import {
  ONRAMP_STAGES,
  quoteSecondsLeft,
  type OnrampOrderView,
  type PaymentInstructions,
} from "@/lib/crypto-backend/fiat-onramp"
import type { FiatOrder } from "@/lib/crypto-backend/types"

const PROBLEM_HEADLINE: Record<string, string> = {
  failed: "This order failed",
  reversed: "This order was reversed",
  refund_in_flight: "A refund is in progress",
  refunded: "This order was refunded",
  refund_failed: "The refund didn't go through",
  expired: "This order expired",
  cancelled: "This order was discarded",
}

export function OnrampOrderScreen({
  order,
  view,
  instructions,
  now,
  figure,
  stageIndex,
  stageProgress,
  checkingPayment,
  onRefresh,
  onViewPaymentDetails,
  onStartOver,
  onDiscard,
  discarding,
  discardError,
}: {
  order: FiatOrder
  view: OnrampOrderView
  instructions: PaymentInstructions
  now: number
  /** "62.45 USDC", when the quote is still in memory. */
  figure?: string
  stageIndex: number | null
  stageProgress: { index: number; since: number }
  checkingPayment: boolean
  onRefresh: () => void
  onViewPaymentDetails: () => void
  onStartOver: () => void
  onDiscard: () => void
  discarding: boolean
  discardError?: unknown
}) {
  const supportLine = `Quote reference ${order.publicReference} if you contact support.`
  const stages = [...ONRAMP_STAGES]
  const reasonCaption = (
    <>
      {view.reason ? <span className="block">{view.reason}</span> : null}
      <span className="block">{supportLine}</span>
    </>
  )
  const canDiscard = ["failed", "reversed", "refunded", "expired"].includes(order.state)
  const problemCaption = discardError ? <><FiatErrorDetail error={describeFiatError(discardError)} />{reasonCaption}</> : reasonCaption

  if (view.screen === "pay" && checkingPayment) {
    return (
      <StatusScreen
        state="processing"
        direction="in"
        figure={figure}
        headline="Checking your payment"
        caption={
          <>
            <span className="block">We&apos;re checking the bank transfer with OnSwitch now.</span>
            <span className="mt-1 block">You can leave this page open — we&apos;ll keep checking and update the order when the payment is confirmed.</span>
            <span className="mt-2 block">{supportLine}</span>
          </>
        }
        stages={stages}
        activeIndex={stageIndex ?? 1}
        stageStartedAt={stageProgress.since}
        reference={order.publicReference}
        autoUpdating
        primary={{ label: "Check status now", onClick: onRefresh }}
        secondary={{ label: "View payment details", onClick: onViewPaymentDetails }}
      />
    )
  }

  if (view.screen === "pay") {
    const secondsLeft = instructions.expiresAt ? quoteSecondsLeft({ expiresAt: instructions.expiresAt }, now) : null
    const expired = secondsLeft === 0
    return (
      <section className="mx-auto w-full max-w-xl space-y-5 rounded-2xl border border-border/50 bg-card/60 p-4 sm:p-6">
        <FlowHeader
          direction="in"
          title="Send the bank transfer"
          subtitle={figure ? `${figure} arrives in your wallet once it's confirmed` : "Your crypto arrives once the payment is confirmed"}
        />
        {instructions.rows.length > 0 ? (
          <dl className="divide-y divide-border/40 rounded-xl border border-border/40 bg-background/40 px-3">
            {instructions.rows.map((row) => <div key={row.label} className="flex flex-col gap-1 py-3">
              <dt className="text-xs text-muted-foreground">{row.label}</dt>
              <dd className="flex items-start gap-2"><span className="min-w-0 flex-1 whitespace-pre-line break-words text-sm font-semibold tabular-nums">{row.value}</span><CopyButton value={row.value} /></dd>
            </div>)}
          </dl>
        ) : (
          <p className="rounded-2xl bg-surface-sunken/60 px-4 py-3 text-[13px] text-muted-foreground">
            Payment details aren&apos;t available yet. We&apos;ll keep checking.
          </p>
        )}
        {expired ? (
          <div className="rounded-xl bg-debit-chip px-3.5 py-2.5 text-[13px] leading-relaxed text-debit">
            These payment details have expired. Don&apos;t send money to them. {supportLine}
          </div>
        ) : secondsLeft !== null ? (
          <p className="text-[13px] text-muted-foreground">These details expire in {formatCountdown(secondsLeft)}.</p>
        ) : null}
        <p className="text-xs leading-relaxed text-muted-foreground">Send the exact amount using the details above. Use this account only for this order.</p>
        <p className="break-all text-xs text-muted-foreground">Order reference {order.publicReference}</p>
        {expired ? (
          <FlowCta label="Start a new buy" onClick={onStartOver} />
        ) : (
          <FlowCta label="I've made the transfer" onClick={onRefresh} disabled={instructions.rows.length === 0} />
        )}
      </section>
    )
  }

  if (view.screen === "review") {
    return (
      <StatusScreen
        state="processing"
        direction="in"
        figure={figure}
        headline="Your order is being reviewed"
        caption={reasonCaption}
        reference={order.publicReference}
        autoUpdating={false}
        secondary={{ label: "Check again", onClick: onRefresh }}
      />
    )
  }

  if (view.screen === "problem") {
    return (
      <StatusScreen
        state="failure"
        direction="in"
        figure={figure}
        headline={PROBLEM_HEADLINE[order.state] ?? "This order didn't complete"}
        caption={problemCaption}
        reference={order.publicReference}
        // refund_in_flight isn't terminal and is still being polled.
        autoUpdating={!view.terminal}
        primary={{ label: "Start a new buy", onClick: onStartOver }}
        secondary={canDiscard ? {
          label: discarding ? "Discarding…" : order.state === "expired" ? "Discard expired order" : "Discard failed order",
          onClick: discarding ? () => undefined : onDiscard,
        } : undefined}
      />
    )
  }

  if (view.screen === "completed") {
    return (
      <StatusScreen
        state="success"
        direction="in"
        figure={figure}
        headline="Done — your crypto is in your Worldstreet wallet"
        stages={stages}
        activeIndex={ONRAMP_STAGES.length}
        reference={order.publicReference}
        autoUpdating={false}
        primary={{ label: "Start a new buy", onClick: onStartOver }}
      />
    )
  }

  // continue / processing / unknown: the backend is still working.
  const tracking = checkingPayment
  return (
    <StatusScreen
      state="processing"
      direction="in"
      figure={figure}
      headline={
        tracking
          ? "Checking your payment"
          : view.screen === "continue"
          ? "Setting up your order"
          : view.screen === "unknown"
            ? "We're checking on your order"
            : "Your order is being processed"
      }
      caption={tracking ? "We’re checking the bank transfer and will update this order as soon as the provider confirms it." : "You can close this; the order carries on and you can come back to it."}
      stages={stageIndex !== null ? stages : undefined}
      activeIndex={stageProgress.index}
      stageStartedAt={stageProgress.since}
      reference={order.publicReference}
      primary={tracking ? { label: "Check status now", onClick: onRefresh } : undefined}
      secondary={tracking ? { label: "View payment details", onClick: onViewPaymentDetails } : undefined}
    />
  )
}

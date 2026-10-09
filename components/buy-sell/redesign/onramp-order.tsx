"use client"

/**
 * OnrampOrderScreen (components/fiat/buy/OnrampOrderScreen.tsx) in the
 * preview's look. Same props, same branches in the same order, same
 * actions; driven by backend `state` only (guide §11 line 1022). The
 * only copy change: no provider name ("…with OnSwitch now" → "…now").
 * Payment instructions are rendered as returned, as plain text, with copy
 * (guide §9.2 lines 824-826); "I've made the transfer" only refetches —
 * an onramp is never confirmed (guide §9.3 line 878).
 */

import { Breakdown } from "@/components/buy-sell/redesign/ticket-parts"
import { TradeCta, TradeNotice } from "@/components/buy-sell/redesign/kit"
import { TradeStatus } from "@/components/buy-sell/redesign/order-status"
import { FiatErrorDetail } from "@/components/fiat/shared/FiatErrorDetail"
import { formatCountdown } from "@/components/fiat/shared/format"
import { CopyButton } from "@/components/fiat/shared/SensitiveValue"
import { describeFiatError } from "@/lib/crypto-backend/fiat-errors"
import { ONRAMP_STAGES, quoteSecondsLeft, type OnrampOrderView, type PaymentInstructions } from "@/lib/crypto-backend/fiat-onramp"
import type { FiatOrder } from "@/lib/crypto-backend/types"

// Same wording as OnrampOrderScreen.
const PROBLEM_HEADLINE: Record<string, string> = {
  failed: "This order failed",
  reversed: "This order was reversed",
  refund_in_flight: "A refund is in progress",
  refunded: "This order was refunded",
  refund_failed: "The refund didn't go through",
  expired: "This order expired",
  cancelled: "This order was discarded",
}

export function RedesignOnrampOrder({
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
  const stages = ONRAMP_STAGES.map((s) => s.label)
  const reasonCaption = (
    <>
      {view.reason ? <span className="block">{view.reason}</span> : null}
      <span className="block">{supportLine}</span>
    </>
  )
  const canDiscard = ["failed", "reversed", "refunded", "expired"].includes(order.state)

  if (view.screen === "pay" && checkingPayment) {
    return (
      <TradeStatus
        state="processing"
        figure={figure}
        headline="Checking your payment"
        caption={
          <>
            <span className="block">We&apos;re checking the bank transfer now.</span>
            <span className="mt-1 block">You can leave this page open — we&apos;ll keep checking and update the order when the payment is confirmed.</span>
            <span className="mt-2 block">{supportLine}</span>
          </>
        }
        stages={stages}
        activeIndex={stageIndex ?? 1}
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
      <section aria-live="polite" className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <span className="font-display text-[22px] font-semibold tracking-[-0.02em]">Send the bank transfer</span>
          <span className="text-[13.5px] text-muted-foreground">
            {figure ? `${figure} arrives in your wallet once it's confirmed` : "Your crypto arrives once the payment is confirmed"}
          </span>
        </div>
        {instructions.rows.length > 0 ? (
          <dl className="flex flex-col divide-y divide-foreground/[0.06] rounded-2xl border border-foreground/[0.06] bg-foreground/[0.015] px-4">
            {instructions.rows.map((row) => (
              <div key={row.label} className="flex flex-col gap-1 py-3">
                <dt className="text-[12px] text-muted-foreground">{row.label}</dt>
                <dd className="flex items-start gap-2">
                  <span className="min-w-0 flex-1 whitespace-pre-line break-words text-[14px] font-semibold tabular-nums text-foreground">{row.value}</span>
                  <CopyButton value={row.value} />
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.015] px-4 py-3 text-[13px] text-muted-foreground">
            Payment details aren&apos;t available yet. We&apos;ll keep checking.
          </p>
        )}
        {expired ? (
          <TradeNotice tone="error" title="These payment details have expired" detail={<>Don&apos;t send money to them. {supportLine}</>} />
        ) : secondsLeft !== null ? (
          <Breakdown rows={[{ label: "These details expire in", value: formatCountdown(secondsLeft) }]} />
        ) : null}
        <p className="text-[12px] leading-relaxed text-muted-foreground">Send the exact amount using the details above. Use this account only for this order.</p>
        <p className="break-all text-[12px] text-muted-foreground">Order reference {order.publicReference}</p>
        {expired ? (
          <TradeCta label="Start a new buy" onClick={onStartOver} />
        ) : (
          <TradeCta label="I've made the transfer" onClick={onRefresh} disabled={instructions.rows.length === 0} />
        )}
      </section>
    )
  }

  if (view.screen === "review") {
    return (
      <TradeStatus
        state="review"
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
      <TradeStatus
        state="failure"
        figure={figure}
        headline={PROBLEM_HEADLINE[order.state] ?? "This order didn't complete"}
        caption={reasonCaption}
        notice={discardError ? <FiatErrorDetail error={describeFiatError(discardError)} /> : undefined}
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
      <TradeStatus
        state="success"
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
    <TradeStatus
      state="processing"
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
      reference={order.publicReference}
      primary={tracking ? { label: "Check status now", onClick: onRefresh } : undefined}
      secondary={tracking ? { label: "View payment details", onClick: onViewPaymentDetails } : undefined}
    />
  )
}

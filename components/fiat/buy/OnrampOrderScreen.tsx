"use client"

/**
 * The OnSwitch onramp order, by backend `state` (guide §11 lines 952-963):
 * payment instructions while awaiting the bank deposit, then a staged status
 * screen. Instructions are rendered as returned, as plain text (guide lines
 * 755-757). "I've made the transfer" only refetches the order; an onramp is
 * never confirmed (guide §9.3 line 809).
 */

import { formatCountdown } from "@/components/fiat/shared/format"
import { SensitiveValue } from "@/components/fiat/shared/SensitiveValue"
import { DetailPanel, FlowCta, FlowHeader, StatusScreen } from "@/components/ui/flow"
import { Eyebrow } from "@/components/ui/system"
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
}

export function OnrampOrderScreen({
  order,
  view,
  instructions,
  now,
  figure,
  stageIndex,
  stageProgress,
  onRefresh,
  onStartOver,
}: {
  order: FiatOrder
  view: OnrampOrderView
  instructions: PaymentInstructions
  now: number
  /** "62.45 USDC", when the quote is still in memory. */
  figure?: string
  stageIndex: number | null
  stageProgress: { index: number; since: number }
  onRefresh: () => void
  onStartOver: () => void
}) {
  const supportLine = `Quote reference ${order.publicReference} if you contact support.`
  const stages = [...ONRAMP_STAGES]
  const reasonCaption = (
    <>
      {view.reason ? <span className="block">{view.reason}</span> : null}
      <span className="block">{supportLine}</span>
    </>
  )

  if (view.screen === "pay") {
    const secondsLeft = instructions.expiresAt ? quoteSecondsLeft({ expiresAt: instructions.expiresAt }, now) : null
    const expired = secondsLeft === 0
    return (
      <>
        <FlowHeader
          direction="in"
          title="Send the bank transfer"
          subtitle={figure ? `${figure} arrives in your wallet once it's confirmed` : "Your crypto arrives once the payment is confirmed"}
        />
        {instructions.rows.length > 0 ? (
          <div className="flex flex-col gap-2">
            <Eyebrow>Pay to</Eyebrow>
            <DetailPanel
              rows={instructions.rows.map((row) => ({
                label: row.label,
                value: <SensitiveValue value={row.value} sensitive={row.sensitive} />,
              }))}
            />
          </div>
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
        <p className="text-[13px] text-muted-foreground">Order reference {order.publicReference}</p>
        {expired ? (
          <FlowCta label="Start a new buy" onClick={onStartOver} />
        ) : (
          <FlowCta label="I've made the transfer" onClick={onRefresh} />
        )}
      </>
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
        caption={reasonCaption}
        reference={order.publicReference}
        // refund_in_flight isn't terminal and is still being polled.
        autoUpdating={!view.terminal}
        primary={{ label: "Start a new buy", onClick: onStartOver }}
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
  return (
    <StatusScreen
      state="processing"
      direction="in"
      figure={figure}
      headline={
        view.screen === "continue"
          ? "Setting up your order"
          : view.screen === "unknown"
            ? "We're checking on your order"
            : "Your order is being processed"
      }
      caption="You can close this; the order carries on and you can come back to it."
      stages={stageIndex !== null ? stages : undefined}
      activeIndex={stageProgress.index}
      stageStartedAt={stageProgress.since}
      reference={order.publicReference}
    />
  )
}

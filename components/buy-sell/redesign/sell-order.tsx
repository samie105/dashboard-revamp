"use client"

/**
 * The Sell order screens in the preview's look. Presentational: the flows
 * (FiatSellFlow's OfframpOrderStatus, BridgeUsdSell's
 * BridgeWithdrawalOrderStatus) compute every value — figure, stage, which
 * actions apply — and render these when their variant is "redesign". Same
 * branches, same actions; copy without provider names.
 *
 * Signing follows guide §9.2 lines 861-864 (the existing wallet intent flow).
 * The local payout confirms after broadcast inside the flow (§9.3); the USD
 * withdrawal never calls /confirm (guide §10.3 lines 1017-1019).
 */

import * as React from "react"

import { cn } from "@/lib/utils"
import { TradeCta, TradeGhost, TradeNotice } from "@/components/buy-sell/redesign/kit"
import { TradeStatus } from "@/components/buy-sell/redesign/order-status"
import { Breakdown } from "@/components/buy-sell/redesign/ticket-parts"
import { FiatErrorDetail } from "@/components/fiat/shared/FiatErrorDetail"
import { describeFiatError } from "@/lib/crypto-backend/fiat-errors"
import type { FiatOrder } from "@/lib/crypto-backend/types"

type View = { screen: string; terminal: boolean; reason?: string }

function SignScreen({
  title,
  subtitle,
  rows,
  notice,
  signError,
  intentNotice,
  canSign,
  signing,
  onSign,
  onRefresh,
  discard,
}: {
  title: string
  subtitle: string
  rows: { label: string; value: string }[]
  notice: string
  signError: unknown
  intentNotice: React.ReactNode
  canSign: boolean
  signing: boolean
  onSign: () => void
  onRefresh: () => void
  discard?: { label: string; onClick: () => void; disabled: boolean }
}) {
  return (
    <section aria-live="polite" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <span className="font-display text-[22px] font-semibold tracking-[-0.02em]">{title}</span>
        <span className="text-[13.5px] text-muted-foreground">{subtitle}</span>
      </div>
      <Breakdown rows={rows} />
      <TradeNotice tone="info" title={notice} />
      {Boolean(signError) && <FiatErrorDetail error={describeFiatError(signError)} />}
      {intentNotice}
      <TradeCta label={signing ? "Signing and submitting…" : "Unlock and sign"} onClick={onSign} disabled={!canSign || signing} busy={signing} />
      <div className={cn("grid gap-2.5", discard ? "grid-cols-2" : "grid-cols-1")}>
        <TradeGhost label="Refresh order" onClick={onRefresh} disabled={signing} />
        {discard && <TradeGhost label={discard.label} onClick={discard.onClick} disabled={discard.disabled} />}
      </div>
    </section>
  )
}

/* ── Local payout (OnSwitch offramp) ──────────────────────────────────── */

const LOCAL_STAGES_PROCESSING = ["Order created", "Crypto transfer submitted", "Local payout being processed", "Payout completed"]
const LOCAL_STAGES_DONE = ["Order created", "Crypto transfer submitted", "Local payout processed", "Payout completed"]

export function RedesignOfframpOrder({
  order,
  view,
  figure,
  canDiscard,
  stuckBeforeSigning,
  stageIndex,
  stageProgress,
  canSign,
  signing,
  signError,
  onSign,
  onRefresh,
  onStartOver,
  onDiscard,
  discarding,
  discardError,
}: {
  order: FiatOrder
  view: View
  figure?: string
  canDiscard: boolean
  stuckBeforeSigning: boolean
  stageIndex: number | null
  stageProgress: { index: number; since: number }
  canSign: boolean
  signing: boolean
  signError: unknown
  onSign: () => void
  onRefresh: () => void
  onStartOver: () => void
  onDiscard: () => void
  discarding: boolean
  discardError?: unknown
}) {
  const supportLine = `Order reference ${order.publicReference} if you contact support.`
  const reasonCaption = (
    <>
      {view.reason ? <span className="block">{view.reason}</span> : null}
      <span className="block">{supportLine}</span>
    </>
  )

  if (view.screen === "sign") {
    return (
      <SignScreen
        title="Review and sign"
        subtitle="Review your payout, then approve the crypto transfer."
        rows={[
          { label: "You send", value: figure ?? "Crypto amount prepared by the backend" },
          { label: "Receive", value: `${order.currency} payout after processing` },
          { label: "Network", value: order.network },
          { label: "Destination", value: "The payout deposit address" },
        ]}
        notice="Check the amount and network before you sign. Signing submits your crypto transfer for this payout."
        signError={signError}
        intentNotice={
          !order.cryptoIntent?.id ? (
            <TradeNotice
              title={
                order.cryptoIntentPreparation?.state === "blocked"
                  ? order.cryptoIntentPreparation.message ?? "The wallet transaction could not be prepared yet. Add the required funds and network gas, then refresh this order."
                  : "Your payout request is created. We're preparing the wallet transaction now; signing will unlock automatically when it's ready. You can refresh this order."
              }
            />
          ) : !canSign ? (
            <TradeNotice tone="info" title="Signing details are still loading. Keep this order open and try again in a moment." />
          ) : null
        }
        canSign={canSign}
        signing={signing}
        onSign={onSign}
        onRefresh={onRefresh}
        discard={stuckBeforeSigning ? { label: discarding ? "Discarding…" : "Discard order & start over", onClick: onDiscard, disabled: signing || discarding } : undefined}
      />
    )
  }

  if (view.screen === "review") {
    return (
      <TradeStatus
        state="review"
        figure={figure}
        headline="Your payout is being reviewed"
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
        headline={order.state === "reversed" ? "This payout was reversed" : "This payout did not complete"}
        caption={reasonCaption}
        notice={discardError ? <FiatErrorDetail error={describeFiatError(discardError)} /> : undefined}
        reference={order.publicReference}
        autoUpdating={!view.terminal}
        primary={{ label: "Start a new sell", onClick: onStartOver }}
        secondary={canDiscard ? {
          label: discarding ? "Discarding…" : order.state === "expired" ? "Discard expired order" : "Discard failed payout",
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
        headline="Done — your payout is complete"
        stages={LOCAL_STAGES_DONE}
        activeIndex={4}
        reference={order.publicReference}
        autoUpdating={false}
        primary={{ label: "Start a new sell", onClick: onStartOver }}
      />
    )
  }

  return (
    <TradeStatus
      state="processing"
      figure={figure}
      headline={view.screen === "continue" ? "Setting up your payout" : "Your payout is being processed"}
      caption="Your payout is in progress. You can return to check it using this order reference."
      stages={stageIndex !== null ? LOCAL_STAGES_PROCESSING : undefined}
      activeIndex={stageProgress.index}
      reference={order.publicReference}
      autoUpdating={!view.terminal}
    />
  )
}

/* ── USD withdrawal (Bridge offramp) ──────────────────────────────────── */

export function RedesignUsdWithdrawalOrder({
  order,
  view,
  figure,
  stages,
  stageIndex,
  stageProgress,
  railLabel,
  canSign,
  signing,
  signError,
  onSign,
  onRefresh,
  onStartOver,
}: {
  order: FiatOrder
  view: View
  figure?: string
  stages: string[]
  stageIndex: number | null
  stageProgress: { index: number; since: number }
  railLabel: string
  canSign: boolean
  signing: boolean
  signError: unknown
  onSign: () => void
  onRefresh: () => void
  onStartOver: () => void
}) {
  const reasonCaption = (
    <>
      {view.reason ? <span className="block">{view.reason}</span> : null}
      <span className="block">Order reference {order.publicReference} if you contact support.</span>
    </>
  )

  if (view.screen === "sign") {
    return (
      <SignScreen
        title="Review and sign USD withdrawal"
        subtitle="We've prepared the exact USDC transfer for this payout."
        rows={[
          { label: "You send", value: figure ?? "USDC amount prepared by the backend" },
          { label: "Receive", value: "USD after processing" },
          { label: "Network", value: order.network },
          { label: "Payment rail", value: railLabel },
        ]}
        notice="This isn't a quote. The USDC amount above is what's sent; the payout provider controls final USD settlement timing and any payout terms."
        signError={signError}
        intentNotice={
          !order.cryptoIntent?.id ? (
            <TradeNotice tone="error" title="The signing intent is not available yet. Refresh this order to continue." />
          ) : !canSign ? (
            <TradeNotice tone="info" title="Signing details are still loading. Keep this order open and try again in a moment." />
          ) : null
        }
        canSign={canSign}
        signing={signing}
        onSign={onSign}
        onRefresh={onRefresh}
      />
    )
  }

  if (view.screen === "review") {
    return (
      <TradeStatus
        state="review"
        figure={figure}
        headline="Your USD payout is being reviewed"
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
        headline={order.state === "reversed" ? "This USD payout was reversed" : "This USD payout did not complete"}
        caption={reasonCaption}
        reference={order.publicReference}
        autoUpdating={!view.terminal}
        primary={{ label: "Start a new USD withdrawal", onClick: onStartOver }}
      />
    )
  }

  if (view.screen === "completed") {
    return (
      <TradeStatus
        state="success"
        figure={figure}
        headline="Done — your USD payout is complete"
        stages={stages}
        activeIndex={stages.length}
        reference={order.publicReference}
        autoUpdating={false}
        primary={{ label: "Start a new USD withdrawal", onClick: onStartOver }}
      />
    )
  }

  return (
    <TradeStatus
      state="processing"
      figure={figure}
      headline={view.screen === "continue" ? "Setting up your USD payout" : "Your USD payout is being processed"}
      caption="The order continues on the backend. You can leave this page and return from fiat order history."
      stages={stageIndex !== null ? stages : undefined}
      activeIndex={stageProgress.index}
      reference={order.publicReference}
      autoUpdating={!view.terminal}
    />
  )
}

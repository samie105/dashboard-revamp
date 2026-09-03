"use client"

/**
 * Screen 1 — what to send, and where.
 *
 * Progressive: the network picks the account, the account's balances give the
 * asset list, and only then do the destination and the amount appear. That
 * order is the same one the CTA's blocker ladder states, so the button is
 * always naming the next thing on screen rather than something further down.
 */

import * as React from "react"

import { AmountField, ChoiceRow, FlowCta, InlineNotice, UnavailablePanel } from "@/components/ui/flow"
import { Eyebrow } from "@/components/ui/system"

export type ChoiceOption = { key: string; label: string; sub?: string; icon?: string }

const ADDRESS_INPUT_CLASS =
  "w-full rounded-xl bg-surface-sunken/70 px-3.5 py-2.5 font-mono text-[13px] outline-none ring-1 ring-border/25 transition-shadow focus-visible:ring-2 focus-visible:ring-primary/40 placeholder:font-sans disabled:opacity-50"


export function SendFormScreen({
  networkOptions,
  networkId,
  onNetworkChange,
  networkNotice,
  assetOptions,
  assetKey,
  onAssetChange,
  to,
  onToChange,
  onToBlur,
  addressProblem,
  selfSend,
  amount,
  onAmountChange,
  symbol,
  decimals,
  amountProblem,
  amountApprox,
  amountHint,
  maxSpend,
  ctaLabel,
  ctaDisabled,
  ctaBusy,
  onSubmit,
  errorSlot,
  disabled = false,
}: {
  networkOptions: ChoiceOption[]
  networkId: string
  onNetworkChange: (networkId: string) => void
  /** Outage line for the chosen network — an empty asset list on a network
   *  whose balance read failed means "we don't know", not "you hold nothing". */
  networkNotice?: React.ReactNode
  assetOptions: ChoiceOption[]
  assetKey: string
  onAssetChange: (assetKey: string) => void
  to: string
  onToChange: (to: string) => void
  onToBlur: () => void
  addressProblem: string | null
  selfSend: boolean
  amount: string
  onAmountChange: (amount: string) => void
  symbol: string
  decimals: number
  amountProblem: string | null
  amountApprox: string | null
  amountHint: string | null
  maxSpend: number | null
  ctaLabel: string
  ctaDisabled: boolean
  ctaBusy: boolean
  onSubmit: () => void
  errorSlot?: React.ReactNode
  /** True while a value read from this screen is already in flight (an intent
   *  create/refresh) — belt and braces alongside the committed-snapshot
   *  capture in `SendFlow`: the fields are locked so what the review screen
   *  shows can never diverge from what got signed. */
  disabled?: boolean
}) {
  const networkChosen = Boolean(networkId)
  const assetChosen = Boolean(assetKey)
  const nothingToSend = networkChosen && assetOptions.length === 0

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Eyebrow>Network</Eyebrow>
        <ChoiceRow options={networkOptions} value={networkId} onChange={onNetworkChange} disabled={disabled} />
      </div>

      {networkNotice}

      {nothingToSend ? (
        <UnavailablePanel
          title="Nothing to send on this network"
          tone="muted"
          reason="This account holds no spendable balance here. Deposit first, or pick a network you already hold something on."
          action={{ label: "Choose another network", onClick: () => onNetworkChange("") }}
        />
      ) : (
        <>
          {networkChosen && (
            <div className="flex flex-col gap-2">
              <Eyebrow>Asset</Eyebrow>
              <ChoiceRow columns={2} options={assetOptions} value={assetKey} onChange={onAssetChange} disabled={disabled} />
            </div>
          )}

          {assetChosen && (
            <>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="send-to-address">
                  <Eyebrow>To</Eyebrow>
                </label>
                <input
                  id="send-to-address"
                  value={to}
                  onChange={(event) => onToChange(event.target.value)}
                  onBlur={onToBlur}
                  disabled={disabled}
                  spellCheck={false}
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder={`Destination ${symbol} address`}
                  aria-invalid={addressProblem ? true : undefined}
                  className={ADDRESS_INPUT_CLASS}
                />
                {addressProblem && <p className="text-[12px] text-debit">{addressProblem}</p>}
              </div>

              {/* Allowed, but never silently: a send to your own address costs
                  a real network fee and moves nothing. */}
              {selfSend && (
                <InlineNotice tone="warning">You&apos;re sending to this wallet&apos;s own address.</InlineNotice>
              )}

              <AmountField
                value={amount}
                onChange={onAmountChange}
                unit={symbol}
                maxDecimals={decimals}
                maxSpend={maxSpend}
                problem={amountProblem}
                approx={amountApprox}
                hint={amountHint ?? undefined}
                // The destination sits directly above and is still empty on
                // first arrival — grabbing focus for the amount would skip it.
                autoFocus={false}
                disabled={disabled}
              />

              {/* The fee choice is gone from the form.
                  It offered "Worldstreet pays — when available", which is a
                  choice whose outcome the user cannot know when they make it,
                  sitting above the button that spends their money. The sender
                  pays the network fee; `sponsorFees` stays in the flow's state
                  and its plumbing is untouched, so restoring the control is a
                  matter of putting this block back once sponsorship is
                  something we can actually promise. */}
            </>
          )}

          {errorSlot}

          <FlowCta label={ctaLabel} onClick={onSubmit} disabled={ctaDisabled} busy={ctaBusy} />
        </>
      )}
    </div>
  )
}

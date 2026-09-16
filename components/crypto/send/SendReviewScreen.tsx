"use client"

/**
 * Screen 2 — the receipt before the signature.
 *
 * Everything the signature commits to is stated here in full: the exact
 * contract for a token (a symbol is not an identity), the destination, the
 * amount, who pays the fee, and how long this quote is still good for. The
 * pre-check policy is asymmetric on purpose — a simulation that says "this
 * would fail" blocks signing, while a simulation we simply couldn't RUN warns
 * and steps aside.
 *
 * LANDSCAPE from `sm` up: the route and the itemised rows on the left, and on
 * the right the one thing the signature actually commits to — the amount, the
 * fee, and how long the quote is still good for — sitting directly above the
 * button that commits it. Stacked in a single column this screen put the
 * countdown several rows above a CTA that could scroll out of sight, so the
 * number you were racing and the button you were racing it to were never on
 * screen together. Warnings and errors stay full width beneath both panes:
 * they are about the whole transfer, not about one half of it.
 */

import * as React from "react"

import { AddressPill } from "@/components/crypto/primitives"
import { DetailPanel, ErrorDetail, FlowCta, InlineNotice, RouteStrip } from "@/components/ui/flow"
import { QUOTE_EXPIRED_MESSAGE, truncateAddress } from "./send-helpers"

export function SendReviewScreen({
  fromAddress,
  toAddress,
  networkLabel,
  symbol,
  tokenContract,
  amount,
  feeValue,
  feeFallbackReason,
  countdown,
  expired,
  validationErrors,
  simulationFailed,
  simulationRaw,
  simulateCallFailed,
  ctaLabel,
  ctaDisabled,
  ctaBusy,
  onSign,
  onEdit,
  errorSlot,
}: {
  fromAddress: string
  toAddress: string
  networkLabel: string
  symbol: string
  /** The mint/contract for a token asset; null for a native coin. */
  tokenContract: string | null
  amount: string
  feeValue: string
  /** Spec §11: why the fee row fell back to self-paid — null when it didn't
   *  (either it was never requested, or sponsorship is live). */
  feeFallbackReason: string | null
  /** `mm:ss` left on the quote, or the sponsorship offer — whichever is
   *  sooner — or null when neither carries an expiry. */
  countdown: string | null
  expired: boolean
  validationErrors: string[]
  /** The service's own "this would fail" verdict — fail-closed. */
  simulationFailed: boolean
  /** Whatever the service said about that failure; often nothing. */
  simulationRaw: string | null
  /** The simulate CALL never landed (provider down) — fail-open with a warning. */
  simulateCallFailed: boolean
  ctaLabel: string
  ctaDisabled: boolean
  ctaBusy: boolean
  onSign: () => void
  onEdit: () => void
  errorSlot?: React.ReactNode
}) {
  const rows: { label: string; value: React.ReactNode; strong?: boolean }[] = [
    { label: "Network", value: networkLabel },
    { label: "Asset", value: symbol },
  ]
  if (tokenContract) rows.push({ label: "Token contract", value: <AddressPill address={tokenContract} /> })
  rows.push({ label: "To", value: <AddressPill address={toAddress} /> })
  rows.push({ label: "Amount", value: `${amount} ${symbol}`, strong: true })
  rows.push({ label: "Network fee", value: feeValue })
  if (countdown !== null) rows.push({ label: "Expires", value: expired ? "Expired" : `in ${countdown}` })

  // Split for the two panes: the summary carries what the signature commits
  // to, the table carries the rest. One source, so the panes cannot disagree.
  const detailRows = rows.filter((r) => r.label !== "Amount" && r.label !== "Network fee" && r.label !== "Expires")

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] sm:items-start sm:gap-5">
        <div className="flex min-w-0 flex-col gap-4">
          <RouteStrip
            direction="out"
            from={{ label: "Your Worldstreet wallet", sub: truncateAddress(fromAddress) }}
            to={{ label: truncateAddress(toAddress) }}
          />
          <DetailPanel rows={detailRows} />
        </div>

        {/* The commitment pane. */}
        <div className="flex flex-col gap-3 rounded-2xl bg-foreground/[0.05] p-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
            You&apos;re sending
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="font-display text-[26px] font-light leading-none tabular-nums">{amount}</span>
            <span className="text-[14px] font-medium text-muted-foreground">{symbol}</span>
          </span>

          <div className="flex flex-col gap-1.5 border-t border-border/40 pt-3">
            <span className="flex items-baseline justify-between gap-3">
              <span className="text-[12.5px] text-muted-foreground">Network fee</span>
              <span className="text-[12.5px] font-medium tabular-nums">{feeValue}</span>
            </span>
            {countdown !== null && (
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-[12.5px] text-muted-foreground">Quote expires</span>
                {/* Warning tone, never gold: a deadline running out is not a
                    brand moment. */}
                <span
                  className={`text-[12.5px] font-semibold tabular-nums ${
                    expired ? "text-debit" : "text-warning"
                  }`}
                >
                  {expired ? "Expired" : `in ${countdown}`}
                </span>
              </span>
            )}
          </div>

          <FlowCta label={ctaLabel} onClick={onSign} disabled={ctaDisabled} busy={ctaBusy} />

          <button
            type="button"
            onClick={onEdit}
            className="mx-auto inline-flex min-h-11 items-center px-4 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            Edit transfer
          </button>
        </div>
      </div>

      {feeFallbackReason && <InlineNotice tone="warning">{feeFallbackReason}</InlineNotice>}

      {expired && <InlineNotice tone="warning">{QUOTE_EXPIRED_MESSAGE}</InlineNotice>}

      {validationErrors.length > 0 && (
        <ErrorDetail
          message="This transfer can't be sent as entered."
          raw={validationErrors.join("\n")}
        />
      )}

      {simulationFailed && (
        <ErrorDetail message="Simulation failed — this transfer would not succeed." raw={simulationRaw} />
      )}

      {simulateCallFailed && (
        <InlineNotice tone="warning">
          Couldn&apos;t pre-check this transfer — the network provider is unavailable. You can still sign, but it
          may fail on-chain.
        </InlineNotice>
      )}

      {errorSlot}
    </div>
  )
}

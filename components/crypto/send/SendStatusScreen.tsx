"use client"

/**
 * Screen 3 — the progress report.
 *
 * Three stages, advanced by the intent poll and kept monotonic upstream, so a
 * status this client doesn't recognise reads as "no news" rather than
 * un-ticking work the user already watched finish.
 */

import * as React from "react"

import { StatusScreen } from "@/components/ui/flow"
import { SEND_STAGES } from "@/lib/crypto-wallet/send-stages"
import { LEAVE_SAFELY_CAPTION } from "./send-helpers"

export function SendStatusScreen({
  state,
  amount,
  symbol,
  activeIndex,
  stageStartedAt,
  reference,
  txHash,
  explorer,
  onDone,
  onTryAgain,
  onLeave,
  errorSlot,
}: {
  state: "processing" | "success" | "failure"
  amount: string
  symbol: string
  activeIndex: number
  stageStartedAt: number | null
  reference: string | null
  txHash: string | null
  /** Null when the network isn't in the display registry — then there is no
   *  honest link to offer, so none is shown (Task 5 returns null). */
  explorer: { label: string; href: string } | null
  onDone: () => void
  onTryAgain: () => void
  /** Supplied when the flow is inside the wallet's send modal: "back to
   *  wallet" then means CLOSE, not navigate — the wallet is already the
   *  thing behind the popup. */
  onLeave?: () => void
  errorSlot?: React.ReactNode
}) {
  const figure = `-${amount} ${symbol}`
  const headline =
    state === "success"
      ? `${amount} ${symbol} sent`
      : state === "failure"
        ? "This transfer didn't go through"
        : `Sending ${amount} ${symbol}`
  const caption =
    state === "success"
      ? "It's on-chain. Your balances will catch up on the next read."
      : state === "failure"
        ? txHash
          ? "The transaction failed on-chain — the amount stayed in your wallet, though the network fee was spent."
          : "Nothing was sent — your balance is unchanged."
        : LEAVE_SAFELY_CAPTION

  return (
    <div className="flex flex-col gap-4">
      <StatusScreen
        state={state}
        direction="out"
        figure={figure}
        headline={headline}
        caption={caption}
        stages={state === "failure" ? undefined : [...SEND_STAGES]}
        activeIndex={activeIndex}
        stageStartedAt={stageStartedAt}
        reference={reference}
        txHash={txHash}
        // The caption already carries the Copy Deck's "you can safely leave"
        // promise in its own words; the kit's stock line would repeat it.
        autoUpdating={false}
        primary={
          state === "success"
            ? explorer
              ? { label: explorer.label, href: explorer.href }
              : { label: "Done", onClick: onDone }
            : state === "failure"
              ? { label: "Try again", onClick: onTryAgain }
              : undefined
        }
        secondary={onLeave ? { label: "Back to wallet", onClick: onLeave } : { label: "Back to wallet", href: "/wallet/modern" }}
      />
      {errorSlot}
    </div>
  )
}

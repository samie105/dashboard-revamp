"use client"

/**
 * Send, as a popup over the wallet.
 *
 * The three verbs on the wallet now behave alike: Deposit, Send and Security
 * all open over the page you're on. Send used to be the one that navigated
 * away, which meant leaving your balances to move money out of them and
 * finding your way back afterwards.
 *
 * ── Why this isn't the cash money-flow modal ──────────────────────────────
 * `MoneyFlowProvider` looks like the obvious host, and its BEHAVIOUR is the
 * model copied here. Its four modes are not: buy/sell move USDT against the
 * Dollar Account and fund/trading-withdraw move USDC to and from Hyperliquid
 * — custodial balances, rendered by BuySellClient and FundClient. None of
 * that picks a network, holds a key, signs, or waits on a chain. It is also
 * mounted once in the layout shell for every route, so adding a fifth mode
 * for an on-chain send would pull the whole wallet stack into every page's
 * tree to serve one screen.
 *
 * So the pattern is borrowed, not the provider — including the part that
 * matters most, below.
 *
 * DISMISSAL: once a transfer is signed and broadcast, a backdrop click is an
 * accident, not a cancellation — and unlike a cash order there is nothing on
 * a server to reconcile it against. While the flow reports in-flight, every
 * dismissal REASON is refused. The X is the one intentional exit: it closes
 * regardless, because an explicit close is a choice and the transfer carries
 * on either way. This mirrors money-flow-modal.tsx, whose own header calls
 * accidental dismissal of a live move "the one unforgivable bug".
 *
 * MOUNTING: mounted only while open. The flow holds a live transaction intent
 * and a poll; a closed-but-mounted copy would leave both running behind the
 * wallet and re-open showing a stale quote.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"

import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/ui/responsive-modal"
import { SendFlow } from "@/components/crypto/send/SendFlow"

export function SendModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  // A ref, not state: the shell has no reason to re-render when it flips.
  const inFlightRef = React.useRef(false)
  const reportInFlight = React.useCallback((value: boolean) => {
    inFlightRef.current = value
  }, [])

  // Backdrop clicks and Escape arrive here. The dialog is controlled, so
  // simply not flipping the state keeps it open.
  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (!next && inFlightRef.current) return
      onOpenChange(next)
    },
    [onOpenChange],
  )
  // The deliberate exits — the X, and "back to wallet" on the status screen.
  const close = React.useCallback(() => {
    inFlightRef.current = false
    onOpenChange(false)
  }, [onOpenChange])

  return (
    <ResponsiveModal open={open} onOpenChange={handleOpenChange}>
      <ResponsiveModalContent showCloseButton={false} className="sm:max-w-md">
        {/* The flow draws its own header — direction badge, title, subtitle —
            so the dialog's title exists for screen readers only. Rendering
            both would title the popup twice. */}
        <ResponsiveModalHeader className="sr-only">
          <ResponsiveModalTitle>Send crypto</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Choose a network, pick what to send, and confirm on this device.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-2 top-2 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
        </button>
        {open ? (
          <div className="min-h-0 flex-1 overflow-y-auto sm:max-h-[min(78dvh,720px)]">
            <SendFlow onClose={close} onInFlightChange={reportInFlight} />
          </div>
        ) : null}
      </ResponsiveModalContent>
    </ResponsiveModal>
  )
}

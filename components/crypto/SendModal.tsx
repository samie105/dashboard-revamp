"use client"

/**
 * Send, as a popup over the wallet.
 *
 * The three verbs on the wallet now behave alike: Deposit, Send and Security
 * all open over the page you're on. Send used to be the one that navigated
 * away, which meant leaving your balances to move money out of them and
 * finding your way back afterwards.
 *
 * `SendFlow` is rendered unchanged — `onClose` is the only difference, and it
 * is what tells the flow it's a guest here: drop the page shell, and let
 * "back to wallet" mean "close" instead of "navigate". The route at
 * /wallet/modern/send still renders the same component with no props, so a
 * deep link or a refresh mid-send lands somewhere real.
 *
 * MOUNTING: this is deliberately mounted only while `open`. The flow holds
 * a live transaction intent and a poll; keeping a closed copy alive would
 * leave both running behind the wallet, and re-opening would show a stale
 * quote rather than a fresh one.
 */

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
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="sm:max-w-md">
        {/* The flow draws its own header — direction badge, title, subtitle —
            so the dialog's title exists for screen readers only. Rendering
            both would title the popup twice. */}
        <ResponsiveModalHeader className="sr-only">
          <ResponsiveModalTitle>Send crypto</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Choose a network, pick what to send, and confirm on this device.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>
        {open ? (
          <div className="max-h-[min(78vh,720px)] overflow-y-auto">
            <SendFlow onClose={() => onOpenChange(false)} />
          </div>
        ) : null}
      </ResponsiveModalContent>
    </ResponsiveModal>
  )
}

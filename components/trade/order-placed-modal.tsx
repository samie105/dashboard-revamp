"use client"

/**
 * The confirmation an order gets after it's placed.
 *
 * This used to be one line of text wedged above the submit button reading
 * "Swap submitted. Waiting for on-chain confirmation…". Two things wrong with
 * it: it named the plumbing rather than the act — the user placed an ORDER,
 * that it settles as an on-chain swap is our problem, not theirs — and a
 * sentence in the ticket is not an acknowledgement. Pressing the button that
 * spends money should be answered by something that takes over the screen.
 *
 * The house modal is `ResponsiveModal`: centred dialog on desktop, bottom
 * sheet on mobile, heavy frost, Escape and outside-click for free. Same shell
 * as the unlock dialog, so this reads as part of the app rather than a new
 * kind of surface invented for one screen.
 *
 * The copy map is exported because the ticket shows the same status inline
 * once this is dismissed, and two places describing one intent in different
 * words is how "submitted" and "filled" come to mean the same thing.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckmarkCircle02Icon,
  AlertCircleIcon,
  Clock01Icon,
} from "@hugeicons/core-free-icons"
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
} from "@/components/ui/responsive-modal"
import { cn } from "@/lib/utils"

/** The intent lifecycle, as the ticket sees it. */
export type OrderStatus = string | undefined

export type OrderTone = "working" | "done" | "failed"

export function orderTone(status: OrderStatus): OrderTone {
  if (status === "confirmed") return "done"
  if (status === "failed" || status === "expired") return "failed"
  return "working"
}

/**
 * What to call the state, in the user's terms.
 *
 * "Placed" is deliberately not "filled": the order has been signed and sent,
 * and nothing has traded until the chain says so. Claiming a fill here is the
 * one lie this screen must never tell.
 */
export function orderCopy(status: OrderStatus, symbol: string): { title: string; body: string } {
  if (status === "confirmed") {
    return {
      title: "Order filled",
      body: `Your ${symbol || "token"} balance updates in a moment.`,
    }
  }
  if (status === "failed") {
    return {
      title: "Order didn't go through",
      body: "Nothing left your wallet beyond network fees. You can place it again.",
    }
  }
  if (status === "expired") {
    return {
      title: "Order expired",
      body: "It wasn't filled in time, so nothing was traded. Placing it again will price it fresh.",
    }
  }
  return {
    title: "Order placed",
    body: "Filling now — this usually takes a few seconds.",
  }
}

const TONE_STYLES: Record<OrderTone, { chip: string; icon: typeof CheckmarkCircle02Icon }> = {
  /* Neutral while it is still moving. Emerald and red are reserved for the
     outcome — money arrived, money didn't — and gold for brand, primary CTA
     and active state. "Still going" is none of those, so it takes the raised
     step of the stone ladder and lets the clock icon carry the meaning. */
  working: { chip: "bg-foreground/[0.08] text-foreground", icon: Clock01Icon },
  done: { chip: "bg-credit-chip text-credit", icon: CheckmarkCircle02Icon },
  failed: { chip: "bg-debit-chip text-debit", icon: AlertCircleIcon },
}

/** One labelled figure — the order as placed, so the modal states what it is. */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className="text-[13px] font-semibold tabular-nums">{value}</span>
    </div>
  )
}

export function OrderPlacedModal({
  open,
  onOpenChange,
  status,
  side,
  symbol,
  amount,
  quantity,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
  status: OrderStatus
  side: "buy" | "sell"
  symbol: string
  /** What was spent, already formatted with its unit. */
  amount: string
  /** The estimated size, already formatted — omitted when we can't state one. */
  quantity?: string | null
}) {
  const tone = orderTone(status)
  const { title, body } = orderCopy(status, symbol)
  const style = TONE_STYLES[tone]

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="sm:max-w-sm">
        <ResponsiveModalHeader className="items-center gap-3 pt-2 text-center">
          <span
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full",
              style.chip,
            )}
          >
            <HugeiconsIcon
              icon={style.icon}
              className={cn("h-6 w-6", tone === "working" && "animate-pulse")}
            />
          </span>
          <ResponsiveModalTitle className="text-[17px] font-semibold">
            {title}
          </ResponsiveModalTitle>
          <ResponsiveModalDescription className="text-[13px] leading-relaxed">
            {body}
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <div className="divide-y divide-border/40 rounded-xl bg-surface-sunken/70 px-3.5">
          <Row label={side === "buy" ? "Buying" : "Selling"} value={symbol || "—"} />
          <Row label={side === "buy" ? "Spending" : "Amount"} value={amount} />
          {quantity ? <Row label="Estimated size" value={quantity} /> : null}
        </div>

        <button
          type="button"
          onClick={() => onOpenChange(false)}
          data-vivid-target="order-modal-done"
          data-vivid-label="Dismiss the order confirmation"
          className="flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90"
        >
          Done
        </button>

        {/* Dismissing is not cancelling — the order is already out, and the
            ticket keeps showing its status once this closes. */}
        {tone === "working" && (
          <p className="text-center text-[11px] text-subtle">
            You can close this — the order keeps working.
          </p>
        )}
      </ResponsiveModalContent>
    </ResponsiveModal>
  )
}

/**
 * Spec §11 — sponsorship truth for the send review screen.
 *
 * A pure decision function, deliberately kept out of React: the review
 * screen's fee row (and its min-expiry countdown) render exactly what this
 * returns, and nothing else decides "who pays". The rule that matters —
 * sponsorship is shown only when the backend explicitly reports it available,
 * and an outage in the sponsorship path must never fail a transfer the user
 * could pay for themselves — lives here once, and is testable without a
 * network or a component tree.
 *
 * `useTransactionIntent.create` is what makes the outage non-fatal: a
 * `quoteSponsorship`/`prepareSponsorship` failure is caught there and comes
 * back as `sponsorshipError` alongside a perfectly good intent, not as a
 * failed mutation. This function is what turns `(operation, quoteError)` into
 * the three states the UI actually renders.
 */

import { CryptoBackendError } from "./errors"
import type { SponsorshipOperation } from "./types"

/* ── Copy Deck ─────────────────────────────────────────────────────────── */

export const SPONSOR_UNAVAILABLE_REASON =
  "Fee sponsorship isn't available for this transfer — you'll pay the network fee."
export const SPONSOR_EXPIRED_REASON = "The sponsorship offer expired — you'll pay the network fee."

export type FeePresentation =
  | { kind: "sponsored"; costUsd?: number }
  | { kind: "self-paid" }
  | { kind: "self-paid-fallback"; reason: string }

/**
 * Who pays the network fee, and why.
 *
 * `operation` reaching `prepared`/`submitted`/`confirmed` is the ONLY state
 * that may promise Worldstreet pays — a quote that never reached `prepared`
 * has no signing payload, so `useTransactionIntent.submit` would fall back to
 * the direct signing path anyway. Promising "sponsored" for anything short of
 * that would tell the user something the submit step can't honour.
 */
export function resolveFeePresentation(input: {
  /** Did the user actually ask for a sponsored fee on this transfer? */
  requested: boolean
  operation: SponsorshipOperation | null
  /** Whatever `quoteSponsorship`/`prepareSponsorship` threw, if anything. */
  quoteError: unknown
}): FeePresentation {
  const { requested, operation, quoteError } = input
  if (!requested) return { kind: "self-paid" }

  // The offer itself lapsing is the case the min-expiry countdown exists for —
  // it wins over quoteError (which, when the operation exists at all, is
  // stale from an earlier failed attempt, not what's true now).
  if (operation?.status === "expired") {
    return { kind: "self-paid-fallback", reason: SPONSOR_EXPIRED_REASON }
  }

  const prepared =
    operation !== null &&
    (operation.status === "prepared" || operation.status === "submitted" || operation.status === "confirmed")
  if (prepared) {
    const estimate = operation.estimatedCostUsd ?? operation.quote?.sponsor?.estimatedCostUsd
    const costUsd = typeof estimate === "string" ? Number(estimate) : estimate
    return Number.isFinite(costUsd) && (costUsd as number) > 0
      ? { kind: "sponsored", costUsd: costUsd as number }
      : { kind: "sponsored" }
  }

  return { kind: "self-paid-fallback", reason: sponsorshipUnavailableReason(quoteError) }
}

/**
 * The taxonomy's own reason when the backend gave one, else the Copy Deck's
 * canned fallback. Never a raw exception string reaching the screen.
 *
 * Fallback chain: a structured `details.message` (e.g. the daily-limit
 * copy) wins when present; otherwise, but ONLY for a `SPONSORSHIP_
 * UNAVAILABLE`-coded error, the backend's own top-level `.message` — that
 * field is `client.ts`'s `payload.error?.message`, the documented primary
 * human-readable field, so a backend that puts the daily-limit copy there
 * instead of in `details` must not be silently dropped. Gating this on the
 * SPONSORSHIP_UNAVAILABLE code specifically (rather than any CryptoBackendError)
 * keeps an unrelated transport failure's technical message from leaking into
 * the fee row; the canned copy is always the answer for those.
 */
function sponsorshipUnavailableReason(quoteError: unknown): string {
  if (quoteError instanceof CryptoBackendError) {
    const details = quoteError.details
    if (details && typeof details === "object") {
      const message = (details as Record<string, unknown>).message
      if (typeof message === "string" && message.trim()) return message.trim()
    }
    if (quoteError.code === "SPONSORSHIP_UNAVAILABLE" && quoteError.message.trim()) {
      return quoteError.message.trim()
    }
  }
  return SPONSOR_UNAVAILABLE_REASON
}

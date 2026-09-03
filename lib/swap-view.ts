/**
 * What the swap screen shows in each mode.
 *
 * Swap is the one screen where the two audiences want genuinely different
 * things rather than different amounts of the same thing. Someone new wants
 * "turn this into that" and a number they can trust. Someone who trades wants
 * to see the route, set their own slippage, and know the minimum they will
 * receive before they sign anything.
 *
 * So Simple is not Pro-with-rows-hidden. Simple answers one question — what
 * do I get — and puts everything else away. Pro shows the quote's working.
 *
 * Both the /swap page and the swap panel on the dashboard read this, so the
 * two cannot drift apart.
 *
 * Every flag is `true` in Pro by construction.
 *
 * ── TWO OF THESE FLAGS ARE DARK, AND BOTH NEED THE BACKEND ──────────────
 * `customToken` and `recipientOverride` are kept as the shape Pro takes once
 * the service supports them, not as unfinished screen work:
 *
 *   - customToken: the quote is requested by SYMBOL, and the proxy route only
 *     allow-lists the curated pairs. A paste-an-address field would answer
 *     "this pair isn't available yet" to every address ever pasted. Unblocked
 *     when the quote endpoint accepts a contract address.
 *   - recipientOverride: the swap intent takes networks, tokens, amount,
 *     slippage and an idempotency key, and no destination address — output
 *     always lands in the user's own wallet. Unblocked when the intent
 *     endpoint takes a destination.
 *
 * Do not wire either to a plausible-looking placeholder. A recipient field
 * that silently ignores what you type is worse than no recipient field.
 *
 * Note also what deliberately has NO flag: price protection. Slippage is a
 * CONTROL in Pro and a house default in Simple, but it always applies and
 * Simple says so in a sentence. Never let Simple mean "unprotected".
 */

import type { UiMode } from "@/lib/ui-mode"

export type SwapView = {
  /** Slippage tolerance, as a control rather than a fixed house default. */
  slippageControl: boolean
  /** Which venues the swap routes through, and in what proportion. */
  routeDetail: boolean
  /** The quote's fine print: price impact, minimum received, fee. */
  quoteBreakdown: boolean
  /** The rate line, and its inverse, spelled out both ways. */
  rateDetail: boolean
  /** A quote countdown with a manual refresh, instead of a silent re-quote. */
  quoteRefresh: boolean
  /** Paste a token address that is not in the curated list. */
  customToken: boolean
  /** Send the output to an address other than your own wallet. */
  recipientOverride: boolean
  /** The USD ↔ token unit toggle on the amount field. */
  unitSwitch: boolean
  /** Chart of the pair's recent rate, above the ticket. */
  rateChart: boolean
}

export function swapView(mode: UiMode): SwapView {
  const pro = mode === "pro"
  return {
    slippageControl: pro,
    routeDetail: pro,
    quoteBreakdown: pro,
    rateDetail: pro,
    quoteRefresh: pro,
    customToken: pro,
    recipientOverride: pro,
    unitSwitch: pro,
    rateChart: pro,
  }
}

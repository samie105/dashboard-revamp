/**
 * What the spot trading screen shows in each mode.
 *
 * This file exists because Pro looked like Simple. The old descriptor carried
 * two flags — a stats row and a unit toggle — so pressing Pro moved almost
 * nothing on screen and the control read as decoration. A mode switch that
 * does not visibly change the screen is worse than no switch: it teaches
 * people the control is broken.
 *
 * The split follows the product rule from the 2026-09-03 review: do not
 * oversimplify, because a trader who cannot find the ladder is a lost trader,
 * and a newcomer who meets the ladder first is a lost newcomer. So Simple is
 * the complete BUY/SELL story with nothing else on screen, and Pro is the
 * workstation.
 *
 * Every flag is `true` in Pro by construction — Pro is defined as "everything
 * this screen can do". Simple turns things off; it never turns anything on.
 *
 * ── FIVE OF THESE FLAGS ARE CURRENTLY DARK ──────────────────────────────
 * `orderBook`, `timeAndSales`, `advancedOrderTypes`, `orderModifiers` and
 * `feeBreakdown` are wired to nothing, and that is a BACKEND fact rather than
 * an unfinished screen. Spot on Worldstreet is an AMM swap routed through
 * 0x/LI.FI, not a matching engine:
 *
 *   - A liquidity pool has a price curve, not a ladder, so there is no book
 *     to draw. (`fetchHlOrderBook` returns a DIFFERENT venue's book for a
 *     similarly-named contract — rendering it here would be a lie with a
 *     spread on it.)
 *   - There is no trade feed; `/api/charts/ohlcv` serves candles and nothing
 *     else, so there is no tape.
 *   - Nothing can rest, so nothing can be a limit or a stop, and time-in-
 *     force and post-only modify a resting order that does not exist.
 *   - The backend prices a swap when it BUILDS it, at submit, so there is no
 *     quote-before-intent route and therefore no honest fee or cost line.
 *     What the ticket can promise — the floor price protection guarantees —
 *     is already on the receipt as "At least", in both modes.
 *
 * They are kept in the type deliberately, as the shape Pro takes once those
 * routes exist. Do not delete them to make the list tidy, and do not wire one
 * to a plausible-looking number: an invented ladder or an estimated fee on a
 * money screen is worse than an absent one. See the block comment at the
 * descriptor's read site in `components/trade/trade-client.tsx`.
 */

import type { UiMode } from "@/lib/ui-mode"

export type TradeView = {
  /** The market's reference row — 1h and 7d change, 24h volume, and the day's
   *  traded range — under the price in the market header. The price and its
   *  24h move always show: those answer "is it up or down", which is the
   *  question a first-time buyer actually has. */
  marketStats: boolean
  /** The USD ↔ token unit toggle inside the amount field. Off means the order
   *  is always sized in dollars, which is the unit a newcomer thinks in and
   *  the one every quick-percentage button already assumes. */
  unitSwitch: boolean
  /** The order book ladder — resting bids and asks with cumulative depth. */
  orderBook: boolean
  /** The tape: prints as they happen, beside the book. */
  timeAndSales: boolean
  /** Limit and stop orders. Simple places market orders only, because a
   *  resting order that never fills is the single most confusing thing a
   *  first-time trader can do to themselves. */
  advancedOrderTypes: boolean
  /** Time in force and post-only — the modifiers on an order that is already
   *  a limit order, so this can only ever matter when the types above are on. */
  orderModifiers: boolean
  /** Interval picker, indicators and drawing tools on the chart. Simple keeps
   *  the chart and drops the toolbar: the line is information, the toolbar is
   *  a workbench. */
  chartToolbar: boolean
  /** The open-orders / order-history / fills tab strip under the chart.
   *  Simple shows open orders alone, since it can only create market orders
   *  and the other two tabs would be permanently empty. */
  orderTabs: boolean
  /** Maker/taker fee and the estimated cost line inside the ticket. */
  feeBreakdown: boolean
  /** The raw last-price / mark-price / index-price triplet. */
  priceSources: boolean
}

export function tradeView(mode: UiMode): TradeView {
  const pro = mode === "pro"
  return {
    marketStats: pro,
    unitSwitch: pro,
    orderBook: pro,
    timeAndSales: pro,
    advancedOrderTypes: pro,
    orderModifiers: pro,
    chartToolbar: pro,
    orderTabs: pro,
    feeBreakdown: pro,
    priceSources: pro,
  }
}

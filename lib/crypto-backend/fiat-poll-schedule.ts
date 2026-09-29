/**
 * Polling ladders for fiat orders and Bridge virtual accounts (CP2).
 *
 * Guide §11 order lifecycle (docs/fiat-frontend-integration-guide.md
 * lines 964-985):
 *
 *   For an active order, use a bounded backoff such as 2s, 4s, 8s, 15s,
 *   30s, then every 30-60s while the screen is open. Stop on a terminal
 *   state. Refetch on window focus and after a wallet transaction
 *   submit. Avoid polling every second across a list of orders; the
 *   backend is rate-limited.
 *
 *   For virtual-account activity, poll less frequently (15-30s while
 *   the account screen is open) and refresh on focus.
 *
 * The guide never lists terminal states (open question 10). The grouping
 * below comes from §11 lines 954-963 and §13 line 1185 (the Bridge
 * offramp polls "until completed, failed, reversed, or manual review"):
 *  · end states stop polling;
 *  · `manual_review` / `blocked` pause automatic polling — "Stop automatic
 *    retries and show support/review messaging" — with focus refetch still
 *    allowed;
 *  · `refund_in_flight` is grouped with the problem states in §11 but a
 *    refund in flight can still change, so it keeps polling at the slow
 *    end of the ladder.
 */

const ORDER_LADDER_MS: readonly number[] = [2_000, 4_000, 8_000, 15_000, 30_000, 45_000]

const VIRTUAL_ACCOUNT_INTERVAL_MS = 20_000 // guide §11: 15-30s while the account screen is open.

/** End states — polling stops entirely. Not a guide-given list (open question 10). */
export const FIAT_ORDER_TERMINAL_STATES: ReadonlySet<string> = new Set([
  "completed",
  "expired",
  "cancelled",
  "failed",
  "reversed",
  "refunded",
  "refund_failed",
])

/** Pause states — automatic polling stops; focus refetch still allowed. */
export const FIAT_ORDER_PAUSE_STATES: ReadonlySet<string> = new Set([
  "manual_review",
  "blocked",
])

/** Still changing, but slowly: polled at the ladder's slowest step. */
export const FIAT_ORDER_SLOW_STATES: ReadonlySet<string> = new Set(["refund_in_flight"])

/**
 * Return the next order-poll delay in ms, or null if polling should
 * stop. `pollCount` is 0-indexed — 0 means "we've never polled".
 */
export function nextFiatOrderPollDelayMs(
  state: string | undefined,
  pollCount: number,
): number | null {
  if (state && FIAT_ORDER_TERMINAL_STATES.has(state)) return null
  if (state && FIAT_ORDER_PAUSE_STATES.has(state)) return null
  if (state && FIAT_ORDER_SLOW_STATES.has(state)) return ORDER_LADDER_MS[ORDER_LADDER_MS.length - 1]
  const index = Math.min(Math.max(pollCount, 0), ORDER_LADDER_MS.length - 1)
  return ORDER_LADDER_MS[index]
}

/**
 * Return the next virtual-account-poll delay in ms, or null if polling
 * should stop (only when the account itself is closed / decommissioned).
 */
export function nextFiatVirtualAccountPollDelayMs(
  status: string | undefined,
): number | null {
  if (status && (status === "closed" || status === "decommissioned")) return null
  return VIRTUAL_ACCOUNT_INTERVAL_MS
}

const CAPABILITY_TTL_FLOOR_MS = 5_000
const CAPABILITY_TTL_CEILING_MS = 5 * 60_000

/**
 * Milliseconds until /fiat/config should be refetched. Guide §5 lines
 * 215-216: "Cache it for no longer than the returned cacheExpiresAt;
 * refetch after that time or after a provider-related error." Clamped so
 * a missing, malformed or past value can't stall or hot-loop polling.
 */
export function fiatConfigRefetchDelayMs(
  cacheExpiresAt: string | undefined,
  now: number = Date.now(),
): number {
  if (!cacheExpiresAt) return CAPABILITY_TTL_CEILING_MS
  const expires = Date.parse(cacheExpiresAt)
  if (!Number.isFinite(expires)) return CAPABILITY_TTL_CEILING_MS
  const delta = expires - now
  if (delta <= 0) return CAPABILITY_TTL_FLOOR_MS
  return Math.min(Math.max(delta, CAPABILITY_TTL_FLOOR_MS), CAPABILITY_TTL_CEILING_MS)
}

export const __TESTING__ = {
  ORDER_LADDER_MS,
  VIRTUAL_ACCOUNT_INTERVAL_MS,
}

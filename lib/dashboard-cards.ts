/**
 * Which account cards the dashboard shows, and when.
 *
 * Three accounts make up the crypto balance: what you HOLD in your wallet,
 * what you have moved into SPOT to trade with, and what is in FUTURES. Cash
 * is not among them — a dollar balance belongs to the Dollar Account, which
 * is a different product with its own dashboard, and putting it here is what
 * made people arrive expecting to deposit naira into a crypto wallet.
 *
 * The rule these functions encode is progressive disclosure. A person who
 * signed up ten seconds ago holds nothing, has traded nothing, and has no
 * futures position. Showing them three cards reading $0.00 does not inform
 * them; it tells them the product is empty and they are already behind. So a
 * card earns its place by having something in it, and the dashboard fills in
 * as they use the platform: buy a coin and Holdings appears, move money into
 * spot and Spot appears.
 *
 * Futures is a special case. The venue is shut (see `FUTURES_CLOSED` in
 * `venues.ts`), so its card is not "not yet earned" — it is unreachable, and
 * it stays off the screen no matter what the numbers say.
 *
 * Pure functions, and tested as such: what shows on the money screen has to
 * be assertable without mounting React.
 */

export type AccountKey = "holdings" | "spot" | "futures"

export const ACCOUNT_KEYS: readonly AccountKey[] = ["holdings", "spot", "futures"]

export type AccountSignal = {
  /** Is the venue open at all? A closed venue never shows, however it reads. */
  open: boolean
  /** Has an answer arrived? Separates "not loaded yet" from a truthful zero,
   *  so the screen never decides a card is unearned on the strength of a
   *  placeholder. */
  settled: boolean
  /** Is there anything here — a balance, an open position, a resting order?
   *  Callers should be generous: this is "has this person used this account",
   *  not "is the balance above zero right this second". */
  used: boolean
}

export type DashboardCards =
  /** At least one open account is still loading and none has reported
   *  anything yet. Show skeletons — an empty state here would be a guess. */
  | { status: "loading" }
  /** Every open account has answered and none is in use. A brand-new
   *  account: show the invitation, not three zeroes. */
  | { status: "empty" }
  /** The accounts worth showing, in ledger order. */
  | { status: "ready"; accounts: AccountKey[] }

/**
 * Decide what the breakdown row renders.
 *
 * Cards appear as they settle rather than all at once. Someone whose wallet
 * has loaded and whose spot ledger has not sees Holdings immediately, and
 * Spot joins it a moment later — which is right, because the alternative is
 * holding a card they have earned hostage to a request they cannot see.
 */
export function dashboardCards(signals: Record<AccountKey, AccountSignal>): DashboardCards {
  const open = ACCOUNT_KEYS.filter((key) => signals[key].open)
  const earned = open.filter((key) => signals[key].settled && signals[key].used)

  if (earned.length > 0) return { status: "ready", accounts: earned }
  // Nothing earned yet. That is only news once every open account has spoken.
  if (open.some((key) => !signals[key].settled)) return { status: "loading" }
  return { status: "empty" }
}

/**
 * The crypto total: holdings + spot + futures, and nothing else.
 *
 * Closed venues contribute zero rather than being quietly added, because the
 * dashboard and the portfolio page were computing net worth independently and
 * disagreeing — the larger of the two counted money nobody could open a
 * screen to reach.
 */
export function cryptoTotal(input: {
  holdings: number
  spot: number
  futures: number
  futuresOpen: boolean
}): number {
  return input.holdings + input.spot + (input.futuresOpen ? input.futures : 0)
}

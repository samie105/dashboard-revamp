/**
 * The bridge deposit's three-step story, and the mapping from the evidence the
 * client actually holds onto it.
 *
 * A deposit is TWO different kinds of fact stitched together:
 *
 *  1. The wallet's own transactions — one or two EVM intents (an allowance and
 *     the bridge call) whose statuses the backend reports per intent.
 *  2. The trading account crediting, which no intent status describes: the
 *     bridge is off to one side, and the only honest evidence that the money
 *     arrived is the trading balance moving (or the account flipping `ready`).
 *
 * So the checklist advances 0 → 1 on the intents and 1 → done on the account,
 * and stage 2 is never rendered "in flight" on its own. That is deliberate:
 * inventing a bridge-side signal we don't receive would be a progress bar that
 * moves because time passed, which is the lie this kit exists to avoid.
 *
 * Two rules keep it honest:
 *
 *  · Stage 0 completes only when EVERY intent confirmed. A two-intent deposit
 *    whose approval landed and whose bridge call is still pending has not sent
 *    anything — reporting "USDC sent from your wallet" there would tick a box
 *    about money that is still in the user's wallet.
 *  · An unrecognised status is NOT progress. The backend owns a longer status
 *    vocabulary than this client ("simulated", "validated", "unknown", …) and
 *    may grow it; anything that isn't literally `confirmed` leaves stage 0
 *    open. (The send flow's default is the opposite because there a single
 *    intent's unknown status means "no news since we submitted"; here an
 *    unknown status among several would falsely complete a shared stage.)
 *    `useStageProgress` still keeps the RENDERED index monotonic on top of
 *    this, so a status that regresses can't un-tick a completed row.
 *
 * A `failed`/`expired` intent therefore answers 0 as well — which is exactly
 * "the stage it failed in", the label the failure screen names. The status
 * screen's own verdict (processing / success / failure) is derived separately
 * by the caller; this function only answers "how far did it get".
 */

export const FUNDING_STAGES = [
  { key: "sent", label: "USDC sent from your wallet" },
  { key: "bridged", label: "Bridge transfer confirmed" },
  { key: "credited", label: "Trading account credited" },
] as const

export function fundingStageIndex(input: { intentStatuses: string[]; accountCredited: boolean }): number {
  // The money being in the trading account is the end of the story, whatever
  // the intent statuses say about how it got there.
  if (input.accountCredited) return FUNDING_STAGES.length
  const sent = input.intentStatuses.length > 0 && input.intentStatuses.every((status) => status === "confirmed")
  return sent ? 1 : 0
}

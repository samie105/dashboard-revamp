/**
 * When the crypto dashboard introduces itself.
 *
 * The rule is "once per person", and it answers to two stores that can
 * disagree: a `ws:`-prefixed localStorage key (instant, per device) and the
 * profile's `onboardingCompleted` array (durable, cross-device). Either one
 * saying "seen" retires the guide — the local key is what makes the render
 * path fast, the profile is what stops a two-year user being greeted again
 * on a new laptop.
 *
 * Kept pure for the same reason the migration popup's rule is: "exactly
 * once" is a claim worth being able to test without mounting React.
 */

/** The value stored in `DashboardProfile.onboardingCompleted`. */
export const WELCOME_GUIDE_KEY = "crypto-wallet"

export const WELCOME_SEEN_PREFIX = "ws:crypto-welcome-seen:"

export function welcomeSeenKey(userId: string | undefined) {
  return `${WELCOME_SEEN_PREFIX}${userId ?? "anonymous"}`
}

/** "unknown" = the store hasn't been read yet (SSR, or the profile request
 *  is still in flight). Treated as "don't show" — a guide that flashes up
 *  before we know whether it should have is worse than one that waits a
 *  beat. */
export type SeenSnapshot = boolean | "unknown"

export function welcomeGuideSurfaces(input: {
  /** The crypto wallet is switched on and there is a signed-in user. */
  eligible: boolean
  /** Another first-run modal currently owns the screen — the wallet setup
   *  ceremony, or the migration popup. Two modals at once is the thing this
   *  flag exists to prevent: the guide waits, then greets the person the
   *  moment the screen is theirs. */
  blockedByModal: boolean
  seenLocally: SeenSnapshot
  seenOnProfile: SeenSnapshot
}): { guide: boolean } {
  /* There used to be a `walletReady` condition here — the guide waited until
     a wallet existed. It had the effect of hiding the guide from exactly the
     person it was written for: someone arriving with no wallet met the crypto
     dashboard cold, worked out the setup ceremony unaided, and was greeted
     with "here is what this screen is" only afterwards. A newcomer needs the
     explanation BEFORE the work, not as a receipt for it.
     Nothing is lost by dropping it. `blockedByModal` is what actually keeps
     two modals off the screen at once, and it still does. */
  if (!input.eligible || input.blockedByModal) return { guide: false }
  if (input.seenLocally === "unknown" || input.seenOnProfile === "unknown") return { guide: false }
  return { guide: !input.seenLocally && !input.seenOnProfile }
}

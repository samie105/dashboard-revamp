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
  /** A wallet exists. Before that, the setup ceremony owns the screen. */
  walletReady: boolean
  /** `WalletSetupFlow` currently owns the page. Two modals at once is the
   *  thing this flag exists to prevent — the guide waits, then greets the
   *  person the moment setup lets go. */
  ceremonyVisible: boolean
  seenLocally: SeenSnapshot
  seenOnProfile: SeenSnapshot
}): { guide: boolean } {
  if (!input.eligible || !input.walletReady || input.ceremonyVisible) return { guide: false }
  if (input.seenLocally === "unknown" || input.seenOnProfile === "unknown") return { guide: false }
  return { guide: !input.seenLocally && !input.seenOnProfile }
}

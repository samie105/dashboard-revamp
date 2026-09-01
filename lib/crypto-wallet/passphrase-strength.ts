/**
 * Wallet passphrase strength — scored here, on this device, from the string
 * alone.
 *
 * No zxcvbn and no dictionary: the passphrase protects the only copy of the
 * user's keys, so it never leaves this module — not to a scoring service, not
 * to a log, not to a heavier dependency whose network story we'd have to
 * audit. Four rungs is all a meter needs to steer someone toward a longer,
 * more varied phrase.
 *
 * The ladder:
 *  · under 12 characters → 0, a hard floor. `createSelfCustodialWallet`
 *    refuses anything shorter, so the meter must never call it merely weak.
 *  · at 12 → 1.
 *  · +1 for three of the four character classes, OR for 20+ characters — a
 *    long passphrase earns the same rung as a varied one, because length is
 *    the thing that actually resists a guess.
 *  · +1 for 16+ characters WITH that variety. Strong needs both.
 */

export type PassphraseStrength = {
  score: 0 | 1 | 2 | 3
  label: "Too short" | "Weak" | "Good" | "Strong"
}

/** Mirrors MIN_WALLET_PASSPHRASE_LENGTH in `wallet-setup.ts`. */
const MIN_LENGTH = 12
/** Length that, paired with variety, earns the top rung. */
const VARIED_LENGTH = 16
/** Length that stands in for variety on its own. */
const LONG_LENGTH = 20

const LABELS = ["Too short", "Weak", "Good", "Strong"] as const

const CHARACTER_CLASSES = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/]

export function passphraseStrength(passphrase: string): PassphraseStrength {
  // `wallet-setup.ts` trims before enforcing its minimum, so the meter measures
  // exactly the string that will be accepted. Scoring the untrimmed value would
  // let a phrase padded to 12 with spaces read "Weak" and then be rejected by
  // the very call the meter was encouraging.
  const value = passphrase.trim()
  if (value.length < MIN_LENGTH) return { score: 0, label: LABELS[0] }

  const varied = CHARACTER_CLASSES.filter((cls) => cls.test(value)).length >= 3
  const score = (1 +
    (varied || value.length >= LONG_LENGTH ? 1 : 0) +
    (varied && value.length >= VARIED_LENGTH ? 1 : 0)) as 1 | 2 | 3

  return { score, label: LABELS[score] }
}

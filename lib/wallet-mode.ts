export type WalletMode = "modern" | "legacy"

export const WALLET_MODE_STORAGE_PREFIX = "ws:wallet-mode:"

export function shouldProvisionLegacy(input: {
  modernEnabled: boolean
  legacyWalletExists: boolean | null
}): boolean {
  if (!input.modernEnabled) return true
  return input.legacyWalletExists === true
}

export function resolveWalletMode(input: {
  modernEnabled: boolean
  legacyEnabled: boolean
  legacyWalletExists: boolean | null
  stored: WalletMode | null
}): WalletMode {
  if (!input.modernEnabled) return "legacy"
  if (!input.legacyEnabled) return "modern"
  // Spec §1: a user without a legacy wallet has nothing to select — modern only.
  if (input.legacyWalletExists === false) return "modern"
  return input.stored ?? "modern"
}

// Spec §1, §5: the single named gate every data hook shares. Balance and
// history sources must follow the user's *selected* mode, not the raw
// backend flag alone — a flag-only gate makes the legacy data path
// unreachable for a legacy-mode user once the modern backend is enabled.
export function modernDataEnabled(input: { modernEnabled: boolean; mode: WalletMode }): boolean {
  return input.modernEnabled && input.mode === "modern"
}

export function canChooseWalletMode(input: {
  modernEnabled: boolean
  legacyEnabled: boolean
  legacyWalletExists: boolean | null
}): boolean {
  return input.modernEnabled && input.legacyEnabled && input.legacyWalletExists === true
}

// Spec §2: nudge confirmed legacy-wallet owners to migrate once both wallet
// systems are live. Never for modern-only (new) users (legacyWalletExists:
// false) and never for an inconclusive lookup (null) — don't nag a user we
// can't classify.
export function shouldShowMigrationNotice(input: {
  modernEnabled: boolean
  legacyEnabled: boolean
  legacyWalletExists: boolean | null
  dismissed: boolean
}): boolean {
  return (
    input.modernEnabled &&
    input.legacyEnabled &&
    input.legacyWalletExists === true &&
    !input.dismissed
  )
}

/**
 * Spec §2 surfaces. The migration message has two of them and they answer to
 * different state, which is the whole point:
 *
 *  - The POPUP is an announcement. It runs once per user and never again —
 *    `popupSeen` is set the moment it is shown, not when it is closed, so a
 *    reload mid-read does not earn a second showing.
 *  - The NOTIFICATION-centre entry is where the message lives afterwards, on
 *    mobile and desktop alike. It outlives the popup and retires only when
 *    the user actually resolves it ("I've already moved them", or dismissing
 *    the row itself).
 *
 * Keeping this pure means the "exactly once" rule is testable without
 * mounting React, and neither surface can drift from the other.
 */
export function migrationNoticeSurfaces(input: {
  /** The base predicate — does this user have a legacy wallet to move? */
  eligible: boolean
  /** They have dealt with it; both surfaces retire. */
  resolved: boolean
  /** The one-time popup has already had its showing. */
  popupSeen: boolean
}): { popup: boolean; notification: boolean } {
  if (!input.eligible || input.resolved) return { popup: false, notification: false }
  return { popup: !input.popupSeen, notification: true }
}

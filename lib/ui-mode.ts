/**
 * Simple / Pro — one preference, read by every surface that offers two depths.
 *
 * The preference used to live here together with the descriptors for each
 * screen. It no longer does, for two reasons that came out of the 2026-09-03
 * product review:
 *
 *  1. The WALLET lost its switch entirely. "Everybody understands what's
 *     going on there" — so the wallet shows the complete page to everyone
 *     rather than hiding half of it behind a control nobody asked for.
 *  2. SWAP gained one, and TRADE's grew teeth. Those two screens each own a
 *     descriptor file of their own (`swap-view.ts`, `trade-view.ts`) so the
 *     flags can move at the speed of the screen that reads them.
 *
 * What is left here is the part that must not fork: the type, where it is
 * stored, and what an unset preference resolves to.
 *
 * Simple stays the DEFAULT. Worldstreet onboards people who have never held
 * a coin, and the difference between the two first screens is retention.
 * Nothing is deleted to build Simple — Pro is one press away, remembered per
 * user, and every flag is `true` in Pro by construction.
 */

export type UiMode = "simple" | "pro"

export const UI_MODE_STORAGE_PREFIX = "ws:ui-mode:"

export function uiModeStorageKey(userId: string | undefined) {
  return `${UI_MODE_STORAGE_PREFIX}${userId ?? "anonymous"}`
}

/** A stored value, or null when there is no usable preference. */
export function parseUiMode(raw: string | null | undefined): UiMode | null {
  return raw === "simple" || raw === "pro" ? raw : null
}

export function resolveUiMode(input: { stored: UiMode | null }): UiMode {
  return input.stored ?? "simple"
}

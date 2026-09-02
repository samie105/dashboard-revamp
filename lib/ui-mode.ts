/**
 * Simple / Pro — how much of the crypto dashboard a person is shown.
 *
 * Worldstreet onboards people who have never held a coin. The wallet's Pro
 * view is honest and complete: five chain cards, an Assets/Networks/Accounts
 * counter row, a raw address, and one balance row per asset PER NETWORK, so
 * the same dollar appears three times because it sits on three networks.
 * That is the right screen for someone who knows what a network is. It is
 * the wrong first screen for everyone else, and the difference between the
 * two is retention.
 *
 * Simple is therefore the DEFAULT, and nothing is deleted to make it — Pro
 * is the page as it stands today, one press away, remembered per user.
 *
 * The rules live here as pure functions for the same reason the wallet-mode
 * ones do: what each mode shows must be assertable without mounting React,
 * and both screens must read the answer from one place rather than each
 * growing its own `mode === "simple"` sprinkles.
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

/** What the wallet page shows. Every flag is `true` in Pro by construction:
 *  Pro is defined as "the page before this feature existed". */
export type WalletView = {
  /** The chain-card pouch — the "your money lives on five chains" metaphor. */
  chainCards: boolean
  /** The grouped hex address on the hero card. */
  heroAddress: boolean
  /** "Ethereum · Arbitrum" under the hero figure. */
  heroNetworks: boolean
  /** The Assets / Networks / Accounts counters. */
  heroStats: boolean
  /** The "Share of wallet" column in the balances table. */
  shareColumn: boolean
  /** The network name under each balance row's symbol. */
  networkPerRow: boolean
  /** Collapse the balance list to one row per asset, networks summed. */
  groupBySymbol: boolean
  /** Key export and network provisioning listed outright, not behind a
   *  disclosure, in the security modal. */
  advancedSecurity: boolean
}

export function simpleWalletView(mode: UiMode): WalletView {
  const pro = mode === "pro"
  return {
    chainCards: pro,
    heroAddress: pro,
    heroNetworks: pro,
    heroStats: pro,
    shareColumn: pro,
    networkPerRow: pro,
    groupBySymbol: !pro,
    advancedSecurity: pro,
  }
}

export type TradeView = {
  /** The market's reference row — 1h and 7d change, 24h volume, and the day's
   *  traded range — under the price in the market header. The price and its
   *  24h move always show: those answer "is it up or down", which is the
   *  question a first-time buyer actually has. */
  marketStats: boolean
  /** The USD ↔ token unit toggle inside the amount field. Off means the
   *  order is always sized in dollars, which is the unit a newcomer thinks
   *  in and the one every quick-percentage button already assumes. */
  unitSwitch: boolean
}

export function simpleTradeView(mode: UiMode): TradeView {
  const pro = mode === "pro"
  return { marketStats: pro, unitSwitch: pro }
}

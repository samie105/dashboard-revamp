export type WalletAction =
  | "view-balances" | "view-transactions" | "view-markets" | "view-positions"
  | "spot-order" | "spot-cancel" | "futures-order" | "futures-cancel" | "leverage-change"
  | "send" | "swap" | "withdraw" | "hyperliquid-deposit" | "wallet-export"
  | "security-change" | "permission-change"

export type WalletActionClass = "normal" | "sensitive" | "delegated"

export type WalletActionPolicy = {
  classification: WalletActionClass
  requiresFreshUserVerification: boolean
  delegatedAllowed: boolean
}

const SENSITIVE_ACTIONS = new Set<WalletAction>([
  "withdraw", "hyperliquid-deposit", "wallet-export", "security-change", "permission-change", "send", "swap",
])

const DELEGATED_ACTIONS = new Set<WalletAction>([
  "spot-order", "spot-cancel", "futures-order", "futures-cancel", "leverage-change",
])

/** One classification used by wallet UX and request builders. */
export function walletActionPolicy(action: WalletAction): WalletActionPolicy {
  if (SENSITIVE_ACTIONS.has(action)) return { classification: "sensitive", requiresFreshUserVerification: true, delegatedAllowed: false }
  if (DELEGATED_ACTIONS.has(action)) return { classification: "delegated", requiresFreshUserVerification: false, delegatedAllowed: true }
  return { classification: "normal", requiresFreshUserVerification: false, delegatedAllowed: false }
}

export function requiresFreshWalletVerification(action: WalletAction) {
  return walletActionPolicy(action).requiresFreshUserVerification
}

export function canUseDelegatedTradingPermission(action: WalletAction) {
  return walletActionPolicy(action).delegatedAllowed
}

/** Public, non-secret integration controls for the standalone crypto backend. */
export const CRYPTO_BACKEND_CONTRACT_VERSION =
  process.env.NEXT_PUBLIC_CRYPTO_BACKEND_CONTRACT_VERSION ?? "b00e793"

/** Modern wallet is the default product path. Set explicitly to false only
 * when an operator needs the rollback/disable switch. */
export const isCryptoBackendEnabled = process.env.NEXT_PUBLIC_CRYPTO_ENABLED !== "false"

/** Enables the server-side proxy. This can be disabled independently for rollback. */
export const isCryptoProxyEnabled = process.env.NEXT_PUBLIC_CRYPTO_PROXY_ENABLED !== "false"

/** Legacy Privy remains available during the dual-run period. */
export const isLegacyPrivyEnabled = process.env.NEXT_PUBLIC_LEGACY_PRIVY_ENABLED !== "false"

/** Hybrid-wallet controls are default-on; each remains independently killable. */
export const isPinUnlockEnabled = process.env.NEXT_PUBLIC_PIN_UNLOCK_ENABLED !== "false"
export const isPasskeyUnlockEnabled = process.env.NEXT_PUBLIC_PASSKEY_UNLOCK_ENABLED !== "false"
export const isLongLivedLocalSessionsEnabled = process.env.NEXT_PUBLIC_LONG_LIVED_LOCAL_SESSIONS_ENABLED !== "false"
export const isDelegatedTradingEnabled = process.env.NEXT_PUBLIC_DELEGATED_TRADING_ENABLED !== "false"
export const isSensitiveActionReauthEnabled = process.env.NEXT_PUBLIC_SENSITIVE_ACTION_REAUTH_ENABLED !== "false"

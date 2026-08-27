/** Public, non-secret integration controls for the standalone crypto backend. */
export const CRYPTO_BACKEND_CONTRACT_VERSION =
  process.env.NEXT_PUBLIC_CRYPTO_BACKEND_CONTRACT_VERSION ?? "b00e793"

/** Enables crypto-backend-backed UI data hooks. Set true in the production build. */
export const isCryptoBackendEnabled = process.env.NEXT_PUBLIC_CRYPTO_ENABLED === "true"

/** Enables the server-side proxy. This can be disabled independently for rollback. */
export const isCryptoProxyEnabled = process.env.NEXT_PUBLIC_CRYPTO_PROXY_ENABLED !== "false"

/** Legacy Privy remains available during the dual-run period. */
export const isLegacyPrivyEnabled = process.env.NEXT_PUBLIC_LEGACY_PRIVY_ENABLED !== "false"

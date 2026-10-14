/**
 * Explicit production test-host controls for dashboard-revamp.
 *
 * This is deliberately separate from DEV_AUTH_BYPASS. The latter remains a
 * development-only convenience. The dashboard-test host opts into this mode
 * with a server secret plus the matching NEXT_PUBLIC flag baked into its
 * image; a normal production build cannot enter it accidentally.
 */

export const DASHBOARD_TEST_USER = {
  userId: "dev_bypass_user",
  email: "worldstreet-test-user@worldstreetgold.com",
  firstName: "WorldStreet",
  lastName: "Test User",
  imageUrl: "",
} as const

/** Client-visible build-time flag. Never put the secret in NEXT_PUBLIC_*. */
export const DASHBOARD_TEST_MODE =
  process.env.NEXT_PUBLIC_WORLDSTREET_DASHBOARD_TEST_MODE === "true"

/** Server/runtime flag. This is read again at request time in server seams. */
export const SERVER_DASHBOARD_TEST_MODE =
  process.env.WORLDSTREET_DASHBOARD_TEST_MODE === "true"

export const DASHBOARD_TEST_LIVE_FIAT =
  process.env.NEXT_PUBLIC_WORLDSTREET_DASHBOARD_LIVE_FIAT === "true"

export const SERVER_DASHBOARD_TEST_LIVE_FIAT =
  process.env.WORLDSTREET_DASHBOARD_LIVE_FIAT === "true"

/**
 * Paths which must use the isolated backend even while the rest of the
 * dashboard is served from its browser mock. Fiat and modern-wallet calls
 * are real in the test deployment; market/demo-only surfaces remain local.
 */
export function isDashboardTestBackendPath(path: string): boolean {
  if (!SERVER_DASHBOARD_TEST_LIVE_FIAT && !DASHBOARD_TEST_LIVE_FIAT) return false
  if (path.startsWith("fiat/")) return true
  if (path === "auth/me" || path === "networks" || path === "wallets") return true
  if (path.startsWith("wallets/me")) return true
  return false
}


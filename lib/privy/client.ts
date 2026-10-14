import { PrivyClient } from "@privy-io/node"

const APP_ENV: Record<number, [string, string]> = {
  0: ["PRIVY_APP_ID", "PRIVY_APP_SECRET"],
  1: ["NEW_PRIVY_APP_ID", "NEW_PRIVY_APP_SECRET"],
  2: ["THIRD_PRIVY_APP_ID", "THIRD_PRIVY_APP_SECRET"],
  3: ["FOURTH_PRIVY_APP_ID", "FOURTH_PRIVY_APP_SECRET"],
}

export function getPrivyClient(privyType = 0) {
  const [idName, secretName] = APP_ENV[privyType] ?? APP_ENV[0]
  const appId = process.env[idName]
  const appSecret = process.env[secretName]
  if (!appId) throw new Error(`${idName} is not set`)
  if (!appSecret) throw new Error(`${secretName} is not set`)
  return new PrivyClient({ appId, appSecret })
}

/**
 * Legacy Privy is independently disableable. Do not fail module evaluation
 * when its credentials are intentionally absent: Next still evaluates the
 * legacy route during a production build even when the product flag disables
 * that route. Keep the failure at call time for any accidental legacy use.
 */
const missingPrivyClient = new Proxy({}, {
  get() {
    return () => {
      throw new Error("Legacy Privy is disabled because PRIVY_APP_ID/PRIVY_APP_SECRET are not configured")
    }
  },
}) as unknown as PrivyClient

export const privyClient =
  process.env.PRIVY_APP_ID && process.env.PRIVY_APP_SECRET
    ? getPrivyClient(0)
    : missingPrivyClient

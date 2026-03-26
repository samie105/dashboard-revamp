const ADMIN_BACKEND_URL = process.env.ADMIN_BACKEND_URL || "http://localhost:3000"
const ADMIN_BACKEND_API_KEY = process.env.ADMIN_BACKEND_API_KEY || ""

/**
 * Fire-and-forget log of a sponsored gas transaction to the admin backend.
 * Failures are silently caught — logging must never block user flows.
 */
export function logSponsoredTransaction(params: {
  userId: string
  chain: string
  txHash: string
  method?: string
  estimatedCostUSD?: number
}) {
  fetch(`${ADMIN_BACKEND_URL}/api/gas-logs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ADMIN_BACKEND_API_KEY,
    },
    body: JSON.stringify(params),
  }).catch(() => {
    // Silent — logging must not block transactions
  })
}

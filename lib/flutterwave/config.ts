// ── Flutterwave Configuration ─────────────────────────────────────────────

export const FLUTTERWAVE_BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://api.flutterwave.com"
    : "https://developersandbox-api.flutterwave.com"

export const FLUTTERWAVE_TIMEOUT_MS = 30_000

export const FLUTTERWAVE_RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
}

// Hardcoded fallback rates (used when CoinGecko is down)
// Update these periodically based on market conditions
export const FALLBACK_RATES: Record<string, number> = {
  NGN: 1580,
  GHS: 15.5,
  USD: 1,
  GBP: 0.79,
}

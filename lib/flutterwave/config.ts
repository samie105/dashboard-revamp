// ── Flutterwave Configuration ─────────────────────────────────────────────

// Flutterwave uses the same base URL for test and production.
// The environment is determined by the key (test keys start with FLWSECK_TEST-)
export const FLUTTERWAVE_BASE_URL = "https://api.flutterwave.com/v3"

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

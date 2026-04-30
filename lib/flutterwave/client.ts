import { FLUTTERWAVE_BASE_URL, FLUTTERWAVE_TIMEOUT_MS, FLUTTERWAVE_RETRY_CONFIG } from "./config"

function getSecretKey(): string {
  const key = process.env.FLUTTERWAVE_SECRET_KEY
  if (!key) {
    throw new Error("FLUTTERWAVE_SECRET_KEY is not set")
  }
  return key
}

/**
 * Shared Flutterwave HTTP client with auth, retries, and idempotency.
 *
 * @param endpoint - API path (e.g. "/charges")
 * @param options - fetch options + optional idempotencyKey
 */
export async function flutterwaveFetch<T>(
  endpoint: string,
  options: RequestInit & { idempotencyKey?: string } = {},
): Promise<T> {
  const url = `${FLUTTERWAVE_BASE_URL}${endpoint}`
  const secretKey = getSecretKey()

  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    ...((options.headers as Record<string, string>) || {}),
  }

  if (options.idempotencyKey) {
    headers["X-Idempotency-Key"] = options.idempotencyKey
  }

  let lastError: Error | null = null
  let delay = FLUTTERWAVE_RETRY_CONFIG.initialDelayMs

  for (let attempt = 0; attempt <= FLUTTERWAVE_RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), FLUTTERWAVE_TIMEOUT_MS)

      const res = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      const data = await res.json()

      if (!res.ok) {
        const errorMsg =
          data.message || data.error?.message || `Flutterwave API error: ${res.status}`
        throw new Error(errorMsg)
      }

      // Flutterwave v4 returns { status: "success", data: ... }
      if (data.status !== "success") {
        throw new Error(data.message || "Flutterwave returned non-success status")
      }

      return data.data as T
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))

      // Don't retry on 4xx client errors (except 429 rate limit)
      if (lastError.message.includes("401") || lastError.message.includes("403")) {
        throw lastError // Auth failure — don't retry
      }

      if (attempt < FLUTTERWAVE_RETRY_CONFIG.maxRetries) {
        await new Promise((r) => setTimeout(r, delay))
        delay *= FLUTTERWAVE_RETRY_CONFIG.backoffMultiplier
      }
    }
  }

  throw lastError || new Error("Flutterwave request failed after retries")
}

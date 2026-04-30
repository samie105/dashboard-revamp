import { createHmac } from "crypto"

/**
 * Verify that a webhook payload came from Flutterwave.
 * Uses HMAC-SHA256 with the secret hash configured in the Flutterwave dashboard.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  secretHash: string,
): boolean {
  if (!signature) return false

  const hash = createHmac("sha256", secretHash).update(rawBody).digest("base64")
  return hash === signature
}

/**
 * Extract the charge ID from a webhook payload for API re-verification.
 */
export function extractChargeIdFromWebhook(payload: unknown): string | null {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    payload.data &&
    typeof payload.data === "object" &&
    "id" in payload.data &&
    typeof payload.data.id === "string"
  ) {
    return payload.data.id
  }
  return null
}

/**
 * Extract the webhook event ID for idempotency tracking.
 */
export function extractWebhookEventId(payload: unknown): string | null {
  if (
    payload &&
    typeof payload === "object" &&
    "id" in payload &&
    typeof payload.id === "string"
  ) {
    return payload.id
  }
  return null
}

/**
 * Extract the tx_ref (reference) from a webhook payload.
 * Flutterwave uses `tx_ref` in standard checkout webhooks.
 */
export function extractWebhookReference(payload: unknown): string | null {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    payload.data &&
    typeof payload.data === "object"
  ) {
    const data = payload.data as Record<string, unknown>
    if (typeof data.tx_ref === "string") {
      return data.tx_ref
    }
    if (typeof data.reference === "string") {
      return data.reference
    }
  }
  return null
}

/**
 * Normalize Flutterwave status values to a consistent set.
 * Flutterwave may return different status strings depending on endpoint and payment method.
 */
export function normalizeFlutterwaveStatus(
  status: string,
): "successful" | "failed" | "pending" | "cancelled" | "unknown" {
  const normalized = status.toLowerCase().trim()

  if (["successful", "succeeded", "completed", "success"].includes(normalized)) {
    return "successful"
  }
  if (["failed", "failure", "declined", "rejected"].includes(normalized)) {
    return "failed"
  }
  if (["pending", "processing", "awaiting"].includes(normalized)) {
    return "pending"
  }
  if (["cancelled", "canceled", "abandoned"].includes(normalized)) {
    return "cancelled"
  }

  return "unknown"
}

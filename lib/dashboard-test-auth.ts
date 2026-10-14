import { DASHBOARD_TEST_USER } from "@/lib/dashboard-test-mode"

export const DASHBOARD_TEST_SESSION_COOKIE = "worldstreet_dashboard_test_session"
const SESSION_PAYLOAD = "worldstreet-dashboard-test-session-v1"

function base64Url(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

async function hmac(payload: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)))
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return difference === 0
}

export async function createDashboardTestSession(secret: string): Promise<string> {
  return base64Url(await hmac(SESSION_PAYLOAD, secret))
}

export async function verifyDashboardTestSession(value: string | undefined, secret: string | undefined): Promise<boolean> {
  if (!value || !secret) return false
  const expected = await createDashboardTestSession(secret)
  return constantTimeEqual(value, expected)
}

export function isDashboardTestAccessKey(value: unknown, secret: string | undefined): value is string {
  if (typeof value !== "string" || !secret || value.length !== secret.length) return false
  return constantTimeEqual(value, secret)
}

export { DASHBOARD_TEST_USER }


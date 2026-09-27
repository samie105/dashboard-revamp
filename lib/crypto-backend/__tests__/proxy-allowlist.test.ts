import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

/**
 * Drives the real proxy handler (app/api/crypto/[...path]/route.ts) to check
 * which fiat paths pass its allowlist. With CRYPTO_API_URL unset, a path that
 * passes the allowlist answers 503 CRYPTO_SERVICE_UNCONFIGURED; a path that
 * doesn't answers the allowlist's bare 404. Nothing is forwarded anywhere.
 *
 * Documented routes: guide §6.2 endpoint summary
 * (docs/fiat-frontend-integration-guide.md lines 408-428).
 */

vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ getToken: async () => "token" }) }))
vi.mock("@/lib/crypto-backend/config", () => ({ isCryptoProxyEnabled: true }))
vi.mock("@/lib/dev-auth-bypass", () => ({ DEV_AUTH_BYPASS: false }))
vi.mock("@/lib/dev-mock-crypto-backend", () => ({ devMockCryptoApiResponse: async () => null }))

type Handler = (req: Request, ctx: { params: Promise<{ path: string[] }> }) => Promise<Response>
let handlers: Record<string, Handler>

beforeAll(async () => {
  vi.stubEnv("CRYPTO_API_URL", "")
  vi.resetModules()
  handlers = (await import("@/app/api/crypto/[...path]/route")) as unknown as Record<string, Handler>
})

afterAll(() => {
  vi.unstubAllEnvs()
})

async function call(method: string, path: string): Promise<number> {
  const segments = path.split("/")
  const response = await handlers[method](
    new Request(`https://dashboard.test/api/crypto/${path}`, { method }),
    { params: Promise.resolve({ path: segments }) },
  )
  return response.status
}

const PASSES = 503
const BLOCKED = 404

// Every fiat route in guide §6.2.
const DOCUMENTED: Array<[string, string]> = [
  ["GET", "fiat/config"],
  ["GET", "fiat/compliance"],
  ["POST", "fiat/compliance/customer"],
  ["POST", "fiat/compliance/bridge/kyc-link"],
  ["POST", "fiat/compliance/bridge/sync"],
  ["GET", "fiat/institutions"],
  ["GET", "fiat/beneficiaries"],
  ["POST", "fiat/beneficiaries"],
  ["DELETE", "fiat/beneficiaries/66f000000000000000000021"],
  ["POST", "fiat/quotes"],
  ["GET", "fiat/quotes/66f000000000000000000031"],
  ["POST", "fiat/orders"],
  ["GET", "fiat/orders"],
  ["GET", "fiat/orders/66f000000000000000000051"],
  ["POST", "fiat/orders/66f000000000000000000052/confirm"],
  ["POST", "fiat/bridge/virtual-accounts"],
  ["GET", "fiat/bridge/virtual-accounts"],
  ["GET", "fiat/bridge/virtual-accounts/66f000000000000000000071"],
  ["GET", "fiat/bridge/virtual-accounts/66f000000000000000000071/activity"],
]

describe("proxy allowlist — every documented fiat route passes", () => {
  it.each(DOCUMENTED)("%s /api/crypto/%s", async (method, path) => {
    expect(await call(method, path)).toBe(PASSES)
  })
})

describe("proxy allowlist — undocumented fiat paths and methods are rejected", () => {
  it.each([
    // Wrong method for a documented path.
    ["POST", "fiat/config"],
    ["POST", "fiat/compliance"],
    ["GET", "fiat/compliance/customer"],
    ["GET", "fiat/compliance/bridge/kyc-link"],
    ["GET", "fiat/compliance/bridge/sync"],
    ["POST", "fiat/institutions"],
    ["DELETE", "fiat/orders/66f000000000000000000051"],
    ["DELETE", "fiat/quotes/66f000000000000000000031"],
    ["DELETE", "fiat/bridge/virtual-accounts/66f000000000000000000071"],
    ["PUT", "fiat/beneficiaries/66f000000000000000000021"],
    ["PATCH", "fiat/beneficiaries/66f000000000000000000021"],
    // DELETE shape checks (anchored ^fiat/beneficiaries/[A-Za-z0-9_-]+$).
    ["DELETE", "fiat/beneficiaries"],
    ["DELETE", "fiat/beneficiaries/66f/extra"],
    ["DELETE", "fiat/beneficiaries/.."],
    ["DELETE", "fiat/beneficiaries/abc.def"],
    ["DELETE", "prefix/fiat/beneficiaries/66f"],
    // Paths the guide never lists.
    ["GET", "fiat/compliance/extra"],
    ["GET", "fiat/institutions/abc"],
    ["POST", "fiat/compliance/onswitch/sync"],
    ["GET", "fiat"],
  ])("%s /api/crypto/%s → 404", async (method, path) => {
    expect(await call(method, path)).toBe(BLOCKED)
  })

  it("never forwards the provider/operator-only routes from guide §1 (lines 43-51)", async () => {
    expect(await call("POST", "webhooks/fiat/onswitch")).toBe(BLOCKED)
    expect(await call("POST", "webhooks/fiat/bridge")).toBe(BLOCKED)
    expect(await call("POST", "fiat/reconcile")).toBe(BLOCKED)
  })
})

describe("proxy allowlist — existing non-fiat entries unchanged", () => {
  it.each([
    ["GET", "wallets/me"],
    ["GET", "transactions/abc"],
    ["POST", "transactions/intents"],
    ["POST", "launchpad/launches"],
    ["GET", "bridge/intertrain/usdc/status"],
    ["POST", "bridge/intertrain/usdc/intents"],
  ])("%s /api/crypto/%s still passes", async (method, path) => {
    expect(await call(method, path)).toBe(PASSES)
  })

  it("DELETE is only open for the one fiat route", async () => {
    expect(await call("DELETE", "wallets/me")).toBe(BLOCKED)
    expect(await call("DELETE", "wallets/me/sessions/abc")).toBe(BLOCKED)
  })
})

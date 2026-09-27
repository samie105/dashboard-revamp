import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Tests for CryptoBackendClient's lazy fetcher resolution
 * (lib/crypto-backend/client.ts ensureFetcher).
 *
 * The three cases this file locks in:
 *  1. Concurrent requests during dev-mock loading all hit the mock —
 *     no request slips through to the real fetch while the dynamic
 *     import is in flight.
 *  2. An explicitly injected fetcher is never swapped out, even when
 *     FIAT_MOCKS_ENABLED / DEV_AUTH_BYPASS is on.
 *  3. Production build (both flags false) uses the real global.fetch
 *     on the very first request — no dynamic import touched.
 */

async function makeClient(env: {
  fiatMocks?: boolean
  devAuthBypass?: boolean
  window?: boolean
  mockFetch?: typeof fetch
  realFetch?: typeof fetch
  injectedFetcher?: typeof fetch
  mockLoadDelayMs?: number
}) {
  vi.resetModules()
  vi.doMock("@/lib/fiat-mocks", () => ({ FIAT_MOCKS_ENABLED: env.fiatMocks ?? false }))
  vi.doMock("@/lib/dev-auth-bypass", () => ({
    DEV_AUTH_BYPASS: env.devAuthBypass ?? false,
    DEV_BYPASS_USER: {
      userId: "test",
      email: "",
      firstName: "",
      lastName: "",
      imageUrl: "",
    },
  }))
  vi.doMock("@/lib/dev-mock-fetch", async () => {
    if (env.mockLoadDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, env.mockLoadDelayMs))
    }
    return { devMockFetch: env.mockFetch ?? vi.fn() }
  })

  if (env.window && typeof (globalThis as { window?: unknown }).window === "undefined") {
    ;(globalThis as { window?: unknown }).window = {}
  }
  if (!env.window && typeof (globalThis as { window?: unknown }).window !== "undefined") {
    delete (globalThis as { window?: unknown }).window
  }

  if (env.realFetch) {
    ;(globalThis as { fetch?: typeof fetch }).fetch = env.realFetch
  }

  const clientModule = await import("@/lib/crypto-backend/client")
  return new clientModule.CryptoBackendClient(
    env.injectedFetcher ? { fetcher: env.injectedFetcher } : {},
  )
}

function okResponse(): Response {
  return new Response(JSON.stringify({ success: true, data: null }), {
    status: 200,
    headers: { "content-type": "application/json" },
  })
}

const originalFetch = globalThis.fetch
const originalWindow = (globalThis as { window?: unknown }).window

beforeEach(() => {
  vi.unstubAllEnvs()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
  vi.doUnmock("@/lib/fiat-mocks")
  vi.doUnmock("@/lib/dev-auth-bypass")
  vi.doUnmock("@/lib/dev-mock-fetch")
  globalThis.fetch = originalFetch
  if (originalWindow === undefined) {
    delete (globalThis as { window?: unknown }).window
  } else {
    ;(globalThis as { window?: unknown }).window = originalWindow
  }
})

describe("ensureFetcher — concurrent requests", () => {
  it("routes every concurrent request to the mock, even while the mock module is still loading", async () => {
    const mockFetch = vi.fn(async () => okResponse())
    const realFetch = vi.fn(async () => okResponse())
    const client = await makeClient({
      fiatMocks: true,
      window: true,
      mockFetch,
      realFetch,
      // The dev-mock import takes long enough that a serial-await style
      // would let request 2 use the real fetch. The fix stores the
      // import promise once, so both awaits resolve on the same mock.
      mockLoadDelayMs: 25,
    })

    const responses = await Promise.all([
      client.getFiatConfig(),
      client.getFiatConfig(),
      client.getFiatConfig(),
      client.getFiatConfig(),
      client.getFiatConfig(),
    ])

    expect(responses).toHaveLength(5)
    expect(mockFetch).toHaveBeenCalledTimes(5)
    expect(realFetch).not.toHaveBeenCalled()
  })
})

describe("ensureFetcher — injected fetcher takes precedence", () => {
  it("never swaps in the dev mock when options.fetcher is set, even under FIAT_MOCKS_ENABLED", async () => {
    const injected = vi.fn(async () => okResponse())
    const mockFetch = vi.fn(async () => okResponse())
    const client = await makeClient({
      fiatMocks: true,
      window: true,
      injectedFetcher: injected,
      mockFetch,
    })

    await client.getFiatConfig()
    await client.getFiatConfig()

    expect(injected).toHaveBeenCalledTimes(2)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("also never swaps in the dev mock when options.fetcher is set under DEV_AUTH_BYPASS", async () => {
    const injected = vi.fn(async () => okResponse())
    const mockFetch = vi.fn(async () => okResponse())
    const client = await makeClient({
      devAuthBypass: true,
      window: true,
      injectedFetcher: injected,
      mockFetch,
    })

    await client.getFiatConfig()
    expect(injected).toHaveBeenCalledOnce()
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe("ensureFetcher — production (both flags false)", () => {
  it("uses the real global.fetch on the very first request without touching the dev-mock module", async () => {
    const realFetch = vi.fn(async () => okResponse())
    const mockFetch = vi.fn(async () => okResponse())
    const client = await makeClient({
      fiatMocks: false,
      devAuthBypass: false,
      window: true,
      realFetch,
      mockFetch,
    })

    await client.getFiatConfig()

    expect(realFetch).toHaveBeenCalledOnce()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("also uses real global.fetch when window is undefined (SSR path)", async () => {
    const realFetch = vi.fn(async () => okResponse())
    const mockFetch = vi.fn(async () => okResponse())
    const client = await makeClient({
      fiatMocks: true, // even with flag on, no window → no mock
      window: false,
      realFetch,
      mockFetch,
    })

    await client.getFiatConfig()

    expect(realFetch).toHaveBeenCalledOnce()
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

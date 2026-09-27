import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The two mock gates that let the fiat responder run — DEV_AUTH_BYPASS and
 * FIAT_MOCKS_ENABLED — MUST be false in a production build no matter what
 * the env vars say. Both source files evaluate their booleans at module
 * load, so we re-import them under a stubbed env for each case.
 */

async function importUnderEnv<T>(
  env: Record<string, string | undefined>,
  loader: () => Promise<T>,
): Promise<T> {
  vi.resetModules()
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) vi.stubEnv(key, "")
    else vi.stubEnv(key, value)
  }
  return await loader()
}

beforeEach(() => {
  vi.unstubAllEnvs()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe("DEV_AUTH_BYPASS gate", () => {
  it("is false in a production build even when the opt-in env var is true", async () => {
    const { DEV_AUTH_BYPASS } = await importUnderEnv(
      { NODE_ENV: "production", NEXT_PUBLIC_DEV_AUTH_BYPASS: "true" },
      () => import("@/lib/dev-auth-bypass"),
    )
    expect(DEV_AUTH_BYPASS).toBe(false)
  })

  it("is false in a test environment (default vitest)", async () => {
    const { DEV_AUTH_BYPASS } = await importUnderEnv(
      { NODE_ENV: "test", NEXT_PUBLIC_DEV_AUTH_BYPASS: "true" },
      () => import("@/lib/dev-auth-bypass"),
    )
    expect(DEV_AUTH_BYPASS).toBe(false)
  })

  it("is false in development when the opt-in env var is missing", async () => {
    const { DEV_AUTH_BYPASS } = await importUnderEnv(
      { NODE_ENV: "development", NEXT_PUBLIC_DEV_AUTH_BYPASS: undefined },
      () => import("@/lib/dev-auth-bypass"),
    )
    expect(DEV_AUTH_BYPASS).toBe(false)
  })

  it("is true ONLY in development with the opt-in env var set", async () => {
    const { DEV_AUTH_BYPASS } = await importUnderEnv(
      { NODE_ENV: "development", NEXT_PUBLIC_DEV_AUTH_BYPASS: "true" },
      () => import("@/lib/dev-auth-bypass"),
    )
    expect(DEV_AUTH_BYPASS).toBe(true)
  })
})

describe("FIAT_MOCKS_ENABLED gate", () => {
  it("is false in a production build even when the opt-in env var is true", async () => {
    const { FIAT_MOCKS_ENABLED } = await importUnderEnv(
      { NODE_ENV: "production", NEXT_PUBLIC_FIAT_MOCKS: "true" },
      () => import("@/lib/fiat-mocks"),
    )
    expect(FIAT_MOCKS_ENABLED).toBe(false)
  })

  it("is false in a test environment", async () => {
    const { FIAT_MOCKS_ENABLED } = await importUnderEnv(
      { NODE_ENV: "test", NEXT_PUBLIC_FIAT_MOCKS: "true" },
      () => import("@/lib/fiat-mocks"),
    )
    expect(FIAT_MOCKS_ENABLED).toBe(false)
  })

  it("is false in development when the opt-in env var is missing", async () => {
    const { FIAT_MOCKS_ENABLED } = await importUnderEnv(
      { NODE_ENV: "development", NEXT_PUBLIC_FIAT_MOCKS: undefined },
      () => import("@/lib/fiat-mocks"),
    )
    expect(FIAT_MOCKS_ENABLED).toBe(false)
  })

  it("is true ONLY in development with the opt-in env var set", async () => {
    const { FIAT_MOCKS_ENABLED } = await importUnderEnv(
      { NODE_ENV: "development", NEXT_PUBLIC_FIAT_MOCKS: "true" },
      () => import("@/lib/fiat-mocks"),
    )
    expect(FIAT_MOCKS_ENABLED).toBe(true)
  })
})

describe("proxy does not return fiat fixtures in a production build", () => {
  /*
   * The proxy at `app/api/crypto/[...path]/route.ts` calls the mock only
   * inside `if (DEV_AUTH_BYPASS)`. Since DEV_AUTH_BYPASS is proven false
   * under NODE_ENV=production above, that path is unreachable in a
   * production build. We assert the proxy's source contains ONLY this
   * gated invocation and no other reference to the fiat responder.
   */
  it("route.ts only invokes the mock behind DEV_AUTH_BYPASS", async () => {
    const { readFile } = await import("node:fs/promises")
    const source = await readFile("app/api/crypto/[...path]/route.ts", "utf8")
    expect(source).toContain("if (DEV_AUTH_BYPASS)")
    expect(source).toContain("devMockCryptoApiResponse")
    // Anything that would invoke the fiat fixture responder from the proxy
    // must be behind DEV_AUTH_BYPASS. Right now there's no such reference,
    // which is stricter than needed but matches the CP1 scope.
    expect(source).not.toContain("respondFromFiatFixtures")
    expect(source).not.toContain("FIAT_MOCKS_ENABLED")
  })
})

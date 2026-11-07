import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

async function importConfig(env: Record<string, string | undefined>) {
  vi.resetModules()
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value ?? "")
  return import("@/lib/clerk-config")
}

beforeEach(() => vi.unstubAllEnvs())
afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe("Clerk configuration", () => {
  it("falls back when satellite environment values are blank", async () => {
    const config = await importConfig({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://dashboard.worldstreetgold.com",
      NEXT_PUBLIC_CLERK_DOMAIN: "   ",
      NEXT_PUBLIC_CLERK_IS_SATELLITE: "true",
      NEXT_PUBLIC_CLERK_SIGN_IN_URL: "",
      NEXT_PUBLIC_CLERK_SIGN_UP_URL: "",
      NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: "",
      NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: "",
    })

    expect(config.CLERK_IS_SATELLITE).toBe(true)
    expect(config.CLERK_APP_ORIGIN).toBe(
      "https://dashboard.worldstreetgold.com"
    )
    expect(config.CLERK_DOMAIN).toBe("worldstreetgold.com")
    expect(config.CLERK_SIGN_IN_URL).toBe(
      "https://www.worldstreetgold.com/login"
    )
    expect(config.CLERK_SIGN_UP_URL).toBe(
      "https://www.worldstreetgold.com/register"
    )
    expect(config.CLERK_AFTER_SIGN_IN_URL).toBe(
      "https://dashboard.worldstreetgold.com/"
    )
    expect(config.CLERK_AFTER_SIGN_UP_URL).toBe(
      "https://dashboard.worldstreetgold.com/"
    )
  })

  it("uses the local primary-app defaults when satellite mode is disabled", async () => {
    const config = await importConfig({
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      NEXT_PUBLIC_CLERK_IS_SATELLITE: "false",
      NEXT_PUBLIC_CLERK_SIGN_IN_URL: "",
      NEXT_PUBLIC_CLERK_SIGN_UP_URL: "",
    })

    expect(config.CLERK_IS_SATELLITE).toBe(false)
    expect(config.CLERK_APP_ORIGIN).toBeUndefined()
    expect(config.CLERK_SIGN_IN_URL).toBe("/login")
    expect(config.CLERK_SIGN_UP_URL).toBe("/register")
  })
})

import { afterEach, describe, expect, it, vi } from "vitest"
import { cryptoBackendUrl, selfCustodyEnabled } from "@/lib/crypto/config"

afterEach(() => vi.unstubAllEnvs())

describe("crypto config", () => {
  it("defaults to the production backend URL", () => {
    vi.stubEnv("NEXT_PUBLIC_CRYPTO_BACKEND_URL", "")
    expect(cryptoBackendUrl()).toBe("https://crypto-backend.worldstreetgold.com")
  })
  it("honors the env override", () => {
    vi.stubEnv("NEXT_PUBLIC_CRYPTO_BACKEND_URL", "http://localhost:3020")
    expect(cryptoBackendUrl()).toBe("http://localhost:3020")
  })
  it("flag is off unless the value is exactly '1'", () => {
    vi.stubEnv("NEXT_PUBLIC_SELF_CUSTODY_ENABLED", "")
    expect(selfCustodyEnabled()).toBe(false)
    vi.stubEnv("NEXT_PUBLIC_SELF_CUSTODY_ENABLED", "true")
    expect(selfCustodyEnabled()).toBe(false)
    vi.stubEnv("NEXT_PUBLIC_SELF_CUSTODY_ENABLED", "1")
    expect(selfCustodyEnabled()).toBe(true)
  })
})

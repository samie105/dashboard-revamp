import { describe, expect, it } from "vitest"
import { CryptoBackendError } from "@/lib/crypto-backend/errors"
import { describeCryptoError } from "@/lib/crypto-backend/error-messages"

const err = (code: string, status = 400, details?: unknown) =>
  new CryptoBackendError("boom", status, code, details, "req-123")

describe("describeCryptoError", () => {
  it("maps WALLET_NOT_FOUND to a setup action, not a network error", () => {
    const d = describeCryptoError(err("WALLET_NOT_FOUND", 404))
    expect(d.action).toBe("setup-wallet")
    expect(d.requestId).toBe("req-123")
  })
  it("maps INTENT_EXPIRED to requesting a fresh intent", () => {
    expect(describeCryptoError(err("INTENT_EXPIRED")).action).toBe("new-intent")
  })
  it("surfaces available vs requested for INSUFFICIENT_FUNDS when details carry them", () => {
    const d = describeCryptoError(err("INSUFFICIENT_FUNDS", 400, { available: "1.2 SOL", requested: "5 SOL" }))
    expect(d.message).toContain("1.2 SOL")
    expect(d.message).toContain("5 SOL")
  })
  it("offers user-paid gas for SPONSORSHIP_UNAVAILABLE", () => {
    expect(describeCryptoError(err("SPONSORSHIP_UNAVAILABLE")).action).toBe("pay-gas")
  })
  it("keeps last data and offers retry for RPC_UNAVAILABLE", () => {
    expect(describeCryptoError(err("RPC_UNAVAILABLE", 502)).action).toBe("retry")
  })
  it("shows the existing operation for DUPLICATE_REQUEST", () => {
    expect(describeCryptoError(err("DUPLICATE_REQUEST", 409)).action).toBe("view-existing")
  })
  it("never emits the phrase 'backend unreachable' for coded errors", () => {
    for (const code of ["AUTH_REQUIRED", "WALLET_NOT_FOUND", "RPC_UNAVAILABLE", "INTENT_EXPIRED", "CRYPTO_BACKEND_UNREACHABLE"]) {
      expect(describeCryptoError(err(code)).message.toLowerCase()).not.toContain("backend unreachable")
    }
  })
  it("falls back to a generic retry with the requestId for unknown codes", () => {
    const d = describeCryptoError(err("SOMETHING_NEW", 500))
    expect(d.action).toBe("retry")
    expect(d.requestId).toBe("req-123")
  })
  it("gives an honest, non-technical message for CRYPTO_BACKEND_UNREACHABLE and offers retry", () => {
    // Mirrors what client.ts actually throws when fetch() itself fails
    // (network down, DNS failure, etc.) before any HTTP response exists.
    const raw = new CryptoBackendError(
      "Crypto backend request failed before a response (GET http://localhost:3020/v1/wallets/me): TypeError: fetch failed",
      0,
      "CRYPTO_BACKEND_UNREACHABLE",
      { endpoint: "http://localhost:3020/v1/wallets/me", method: "GET", reason: "TypeError: fetch failed" },
      "req-123",
    )
    const d = describeCryptoError(raw)
    expect(d.action).toBe("retry")
    expect(d.requestId).toBe("req-123")
    expect(d.message.toLowerCase()).not.toContain("fetch failed")
    expect(d.message.toLowerCase()).not.toContain("http")
  })
})

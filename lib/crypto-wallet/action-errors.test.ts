import { describe, expect, it } from "vitest"
import { CryptoBackendError } from "@/lib/crypto-backend"
import { formatWalletActionError } from "./action-errors"

describe("wallet action errors", () => {
  it("names the selected chain's fee asset instead of hardcoding SOL", () => {
    expect(formatWalletActionError(new CryptoBackendError("failed", 400, "INSUFFICIENT_FUNDS"), "arbitrum", "USDC")).toContain("ETH")
    expect(formatWalletActionError(new CryptoBackendError("failed", 400, "INSUFFICIENT_FUNDS"), "tron", "USDT")).toContain("TRX")
  })

  it("explains allowance failures", () => {
    expect(formatWalletActionError(new Error("ERC20: transfer amount exceeds allowance"), "arbitrum", "USDC")).toMatch(/approve enough USDC/i)
  })

  it("explains a cancelled wallet prompt", () => {
    expect(formatWalletActionError(new Error("User rejected the request"), "ethereum")).toMatch(/cancelled/i)
  })

  it("hides RPC gas diagnostics when the provider rejects an underfunded account", () => {
    const message = formatWalletActionError(new Error("Missing or invalid parameters. Details: insufficient funds for gas * price + value"), "arbitrum", "USDC")
    expect(message).toBe("Not enough USDC or ETH for network fees. Add funds and try again.")
    expect(message).not.toContain("Missing or invalid parameters")
  })
})

import { describe, expect, it } from "vitest"

import { canUseDelegatedTradingPermission, requiresFreshWalletVerification, walletActionPolicy } from "../action-policy"

describe("wallet action policy", () => {
  it("requires fresh verification for fund-moving and security actions", () => {
    expect(requiresFreshWalletVerification("withdraw")).toBe(true)
    expect(requiresFreshWalletVerification("hyperliquid-deposit")).toBe(true)
    expect(walletActionPolicy("permission-change")).toMatchObject({ classification: "sensitive", delegatedAllowed: false })
  })

  it("allows delegated permissions only for spot/futures trading actions", () => {
    expect(canUseDelegatedTradingPermission("spot-order")).toBe(true)
    expect(canUseDelegatedTradingPermission("futures-cancel")).toBe(true)
    expect(canUseDelegatedTradingPermission("withdraw")).toBe(false)
  })

  it("classifies read-only actions as normal", () => {
    expect(walletActionPolicy("view-balances")).toEqual({ classification: "normal", requiresFreshUserVerification: false, delegatedAllowed: false })
  })
})

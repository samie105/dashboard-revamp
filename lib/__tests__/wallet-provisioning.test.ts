import { describe, expect, it } from "vitest"
import { canChooseWalletMode, modernDataEnabled, resolveWalletMode, shouldProvisionLegacy } from "@/lib/wallet-mode"

describe("shouldProvisionLegacy", () => {
  // Spec §1: newly created Clerk users must not be provisioned a legacy Privy wallet.
  it("never provisions when the user has no existing legacy wallet", () => {
    expect(shouldProvisionLegacy({ modernEnabled: true, legacyWalletExists: false })).toBe(false)
  })
  it("keeps provisioning for users who already own a legacy wallet", () => {
    expect(shouldProvisionLegacy({ modernEnabled: true, legacyWalletExists: true })).toBe(true)
  })
  // Fail-safe: an inconclusive lookup must not create a wallet as a side effect.
  it("does not provision when the lookup was inconclusive", () => {
    expect(shouldProvisionLegacy({ modernEnabled: true, legacyWalletExists: null })).toBe(false)
  })
  // Kill switch: with the modern wallet disabled, signup must not brick — old behavior stands.
  it("falls back to legacy provisioning when the modern wallet is disabled", () => {
    expect(shouldProvisionLegacy({ modernEnabled: false, legacyWalletExists: null })).toBe(true)
  })
})

describe("resolveWalletMode", () => {
  it("defaults to modern when nothing is stored", () => {
    expect(
      resolveWalletMode({ modernEnabled: true, legacyEnabled: true, legacyWalletExists: true, stored: null }),
    ).toBe("modern")
  })
  it("is legacy when the modern wallet is disabled, regardless of stored preference", () => {
    expect(
      resolveWalletMode({ modernEnabled: false, legacyEnabled: true, legacyWalletExists: true, stored: "modern" }),
    ).toBe("legacy")
  })
  it("is modern when the legacy toggle is off, regardless of stored preference", () => {
    expect(
      resolveWalletMode({ modernEnabled: true, legacyEnabled: false, legacyWalletExists: true, stored: "legacy" }),
    ).toBe("modern")
  })
  it("honors a stored legacy preference when the user actually has a legacy wallet", () => {
    expect(
      resolveWalletMode({ modernEnabled: true, legacyEnabled: true, legacyWalletExists: true, stored: "legacy" }),
    ).toBe("legacy")
  })
  it("ignores a stored legacy preference when the user has no legacy wallet", () => {
    expect(
      resolveWalletMode({ modernEnabled: true, legacyEnabled: true, legacyWalletExists: false, stored: "legacy" }),
    ).toBe("modern")
  })
})

describe("canChooseWalletMode", () => {
  it("allows the choice only when both modes are enabled and a legacy wallet exists", () => {
    expect(
      canChooseWalletMode({ modernEnabled: true, legacyEnabled: true, legacyWalletExists: true }),
    ).toBe(true)
  })
  it("disallows the choice when the user has no legacy wallet", () => {
    expect(
      canChooseWalletMode({ modernEnabled: true, legacyEnabled: true, legacyWalletExists: false }),
    ).toBe(false)
  })
  it("disallows the choice when the legacy lookup is inconclusive", () => {
    expect(
      canChooseWalletMode({ modernEnabled: true, legacyEnabled: true, legacyWalletExists: null }),
    ).toBe(false)
  })
  it("disallows the choice when the legacy toggle is off", () => {
    expect(
      canChooseWalletMode({ modernEnabled: true, legacyEnabled: false, legacyWalletExists: true }),
    ).toBe(false)
  })
  it("disallows the choice when the modern wallet is disabled", () => {
    expect(
      canChooseWalletMode({ modernEnabled: false, legacyEnabled: true, legacyWalletExists: true }),
    ).toBe(false)
  })
})

// Spec §1, §5: the single gate every data hook shares — balance/history
// sources must follow the user's selected mode, not the raw feature flag,
// or legacy-mode users can never reach the legacy data path.
describe("modernDataEnabled", () => {
  it("is enabled when the modern backend flag is on and the selected mode is modern", () => {
    expect(modernDataEnabled({ modernEnabled: true, mode: "modern" })).toBe(true)
  })
  it("is disabled when the selected mode is legacy, even with the modern backend flag on", () => {
    expect(modernDataEnabled({ modernEnabled: true, mode: "legacy" })).toBe(false)
  })
  it("is disabled when the modern backend flag is off, even if the mode is modern", () => {
    expect(modernDataEnabled({ modernEnabled: false, mode: "modern" })).toBe(false)
  })
  it("is disabled when both the flag is off and the mode is legacy", () => {
    expect(modernDataEnabled({ modernEnabled: false, mode: "legacy" })).toBe(false)
  })
})

import { describe, expect, it } from "vitest"
import { shouldShowMigrationNotice } from "@/lib/wallet-mode"

describe("shouldShowMigrationNotice", () => {
  // Spec §2: legacy-wallet owners get nudged to migrate once both wallet
  // systems are live and their legacy wallet is confirmed to exist.
  it("shows when modern is enabled, legacy is enabled, the user has a legacy wallet, and it hasn't been dismissed", () => {
    expect(
      shouldShowMigrationNotice({
        modernEnabled: true,
        legacyEnabled: true,
        legacyWalletExists: true,
        dismissed: false,
      }),
    ).toBe(true)
  })

  // Spec §2's explicit exclusion: modern-only (new) users never had a legacy
  // wallet, so they must never see a notice about migrating one.
  it("never shows for a new user with no legacy wallet", () => {
    expect(
      shouldShowMigrationNotice({
        modernEnabled: true,
        legacyEnabled: true,
        legacyWalletExists: false,
        dismissed: false,
      }),
    ).toBe(false)
  })

  // Fail-safe: an inconclusive lookup must not nag a user we can't classify.
  it("never shows when the legacy-wallet lookup is inconclusive", () => {
    expect(
      shouldShowMigrationNotice({
        modernEnabled: true,
        legacyEnabled: true,
        legacyWalletExists: null,
        dismissed: false,
      }),
    ).toBe(false)
  })

  it("never shows once dismissed", () => {
    expect(
      shouldShowMigrationNotice({
        modernEnabled: true,
        legacyEnabled: true,
        legacyWalletExists: true,
        dismissed: true,
      }),
    ).toBe(false)
  })

  it("never shows when the modern wallet is disabled", () => {
    expect(
      shouldShowMigrationNotice({
        modernEnabled: false,
        legacyEnabled: true,
        legacyWalletExists: true,
        dismissed: false,
      }),
    ).toBe(false)
  })

  it("never shows when the legacy toggle is off", () => {
    expect(
      shouldShowMigrationNotice({
        modernEnabled: true,
        legacyEnabled: false,
        legacyWalletExists: true,
        dismissed: false,
      }),
    ).toBe(false)
  })
})

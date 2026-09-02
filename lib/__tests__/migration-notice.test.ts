import { describe, expect, it } from "vitest"
import { migrationNoticeSurfaces, shouldShowMigrationNotice } from "@/lib/wallet-mode"

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

describe("migrationNoticeSurfaces", () => {
  const eligible = { eligible: true, resolved: false, popupSeen: false }

  // The popup is an announcement: a user who has never seen it gets it, and
  // the notification-centre entry is pinned from the same moment.
  it("shows the popup and the notification entry to a fresh eligible user", () => {
    expect(migrationNoticeSurfaces(eligible)).toEqual({ popup: true, notification: true })
  })

  // The whole point of the split: once shown, the popup never runs again, but
  // the message does NOT disappear — it lives on in the notification centre,
  // on mobile and desktop alike.
  it("retires the popup after one showing while keeping the notification entry", () => {
    expect(migrationNoticeSurfaces({ ...eligible, popupSeen: true })).toEqual({
      popup: false,
      notification: true,
    })
  })

  // Resolving is the only thing that retires BOTH surfaces.
  it("retires both surfaces once the user resolves it", () => {
    expect(migrationNoticeSurfaces({ ...eligible, resolved: true })).toEqual({
      popup: false,
      notification: false,
    })
    expect(
      migrationNoticeSurfaces({ eligible: true, resolved: true, popupSeen: true }),
    ).toEqual({ popup: false, notification: false })
  })

/* The popup's only action is a link to /wallet/modern, so on that page it
     is an announcement with nothing to announce — and it was landing on top
     of the setup ceremony there. Deferred, never spent: the notification
     entry still carries the message, and `popupSeen` stays untouched, so the
     popup still owes this user a showing somewhere it means something. */
  it("holds the popup back on the page it links to, keeping the notification", () => {
    expect(migrationNoticeSurfaces({ ...eligible, onDestination: true })).toEqual({
      popup: false,
      notification: true,
    })
  })

  it("announces again once they are off the destination page", () => {
    expect(migrationNoticeSurfaces({ ...eligible, onDestination: false })).toEqual({
      popup: true,
      notification: true,
    })
  })

  // A modern-only user, or one whose legacy lookup is inconclusive, gets
  // neither surface — resolution state is irrelevant.
  it("shows nothing to an ineligible user", () => {
    expect(
      migrationNoticeSurfaces({ eligible: false, resolved: false, popupSeen: false }),
    ).toEqual({ popup: false, notification: false })
  })
})

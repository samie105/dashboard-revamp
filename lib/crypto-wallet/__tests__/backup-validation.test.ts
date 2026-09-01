import { describe, expect, it } from "vitest"

import {
  WALLET_BACKUP_FORMAT,
  computeBackupChecksum,
  validateBackup,
} from "@/lib/crypto-wallet/backup-validation"
import { WALLET_PACKAGE_FORMAT } from "@/lib/crypto-wallet/package-crypto"
import { serializeEncryptedWalletPackage } from "@/lib/crypto-wallet/local-storage"

const WALLET_ID = "wallet-1"
const USER_ID = "user-1"

function packageBody(overrides: Record<string, unknown> = {}) {
  return {
    id: WALLET_ID,
    walletId: WALLET_ID,
    version: 2,
    baseVersion: 1,
    securityVersion: 1,
    format: WALLET_PACKAGE_FORMAT,
    status: "active",
    accounts: [{ accountId: "acct-1", family: "evm" }],
    envelopes: [{ envelopeId: "env-1", purpose: "passphrase" }],
    ...overrides,
  }
}

async function validBackup(overrides: { walletId?: string; userId?: string } = {}) {
  const packageValue = packageBody({ walletId: overrides.walletId ?? WALLET_ID })
  const checksum = await computeBackupChecksum(packageValue)
  return {
    backupFormat: WALLET_BACKUP_FORMAT,
    exportedAt: "2026-08-27T00:00:00.000Z",
    userId: overrides.userId ?? USER_ID,
    package: packageValue,
    checksum,
  }
}

describe("computeBackupChecksum", () => {
  it("is stable regardless of object key order", async () => {
    const a = { b: 2, a: 1, nested: { y: 2, x: 1 } }
    const b = { a: 1, nested: { x: 1, y: 2 }, b: 2 }
    expect(await computeBackupChecksum(a)).toBe(await computeBackupChecksum(b))
  })

  it("changes when the payload changes", async () => {
    expect(await computeBackupChecksum({ a: 1 })).not.toBe(await computeBackupChecksum({ a: 2 }))
  })

  it("is stable across a JSON round trip when the package contains undefined values (an object value and an array element), matching real JSON.stringify semantics", async () => {
    const live = packageBody({
      accounts: [
        { accountId: "acct-1", family: "evm", nickname: undefined }, // undefined object value — JSON.stringify drops the key
        undefined, // undefined array element — JSON.stringify serializes it as null
      ],
    })

    const liveChecksum = await computeBackupChecksum(live)
    const roundTripped = JSON.parse(JSON.stringify(live))
    const roundTrippedChecksum = await computeBackupChecksum(roundTripped)
    expect(roundTrippedChecksum).toBe(liveChecksum)

    // And the real export/restore path agrees: the checksum is computed
    // against the live, undefined-carrying package at export time, but the
    // file on disk only ever holds the JSON-normalized form — validating
    // that normalized form must still recompute the same checksum.
    const serialized = await serializeEncryptedWalletPackage(USER_ID, live)
    const parsed = JSON.parse(serialized)
    const result = await validateBackup({ backup: parsed, expectedWalletId: WALLET_ID, expectedUserId: USER_ID })
    expect(result).toEqual({ ok: true, warnings: [] })
  })
})

describe("validateBackup", () => {
  it("accepts a valid, checksummed backup with no warnings", async () => {
    const backup = await validBackup()
    const result = await validateBackup({ backup, expectedWalletId: WALLET_ID, expectedUserId: USER_ID })
    expect(result).toEqual({ ok: true, warnings: [] })
  })

  it("rejects a backup that isn't an object at all", async () => {
    const result = await validateBackup({ backup: "not json", expectedWalletId: WALLET_ID, expectedUserId: USER_ID })
    expect(result).toEqual({ ok: false, problem: "That file isn't a Worldstreet backup." })
  })

  it("rejects an unrecognized backupFormat, naming the version and pointing at an app update", async () => {
    const backup = await validBackup()
    const wrongFormat = { ...backup, backupFormat: "worldstreet-encrypted-wallet-backup-v2" }
    const result = await validateBackup({ backup: wrongFormat, expectedWalletId: WALLET_ID, expectedUserId: USER_ID })
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("expected rejection")
    expect(result.problem).toContain("worldstreet-encrypted-wallet-backup-v2")
    expect(result.problem.toLowerCase()).toContain("update the app")
  })

  it("rejects a backup whose walletId does not match the current wallet", async () => {
    const backup = await validBackup({ walletId: "wallet-2" })
    const result = await validateBackup({ backup, expectedWalletId: WALLET_ID, expectedUserId: USER_ID })
    expect(result).toEqual({ ok: false, problem: "This backup belongs to a different wallet." })
  })

  it("rejects a backup whose userId does not match the signed-in user", async () => {
    const backup = await validBackup({ userId: "user-2" })
    const result = await validateBackup({ backup, expectedWalletId: WALLET_ID, expectedUserId: USER_ID })
    expect(result).toEqual({ ok: false, problem: "This backup belongs to a different wallet." })
  })

  it("rejects a backup with an empty accounts array", async () => {
    const backup = await validBackup()
    const empty = { ...backup, package: { ...backup.package, accounts: [] } }
    const result = await validateBackup({ backup: empty, expectedWalletId: WALLET_ID, expectedUserId: USER_ID })
    expect(result).toEqual({ ok: false, problem: "That file isn't a Worldstreet backup." })
  })

  it("rejects a backup with an empty envelopes array", async () => {
    const backup = await validBackup()
    const empty = { ...backup, package: { ...backup.package, envelopes: [] } }
    const result = await validateBackup({ backup: empty, expectedWalletId: WALLET_ID, expectedUserId: USER_ID })
    expect(result).toEqual({ ok: false, problem: "That file isn't a Worldstreet backup." })
  })

  it("rejects a tampered payload when a checksum field is present", async () => {
    const backup = await validBackup()
    const tampered = {
      ...backup,
      package: { ...backup.package, accounts: [{ accountId: "attacker-added", family: "evm" }] },
    }
    const result = await validateBackup({ backup: tampered, expectedWalletId: WALLET_ID, expectedUserId: USER_ID })
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("expected rejection")
    expect(result.problem).toMatch(/checksum|corrupted|altered/i)
  })

  it("accepts a legacy checksum-less backup, but with a warning", async () => {
    const legacy: Record<string, unknown> = { ...(await validBackup()) }
    delete legacy.checksum
    const result = await validateBackup({ backup: legacy, expectedWalletId: WALLET_ID, expectedUserId: USER_ID })
    expect(result).toEqual({ ok: true, warnings: ["This backup predates integrity checks."] })
  })

  it("accepts a truly-legacy backup missing both userId and checksum (pre-dates both fields)", async () => {
    const legacy: Record<string, unknown> = { ...(await validBackup()) }
    delete legacy.checksum
    delete legacy.userId
    const result = await validateBackup({ backup: legacy, expectedWalletId: WALLET_ID, expectedUserId: USER_ID })
    expect(result).toEqual({ ok: true, warnings: ["This backup predates integrity checks."] })
  })

  it("round-trips with the real export path: serializeEncryptedWalletPackage's checksum validates cleanly", async () => {
    const packageValue = packageBody()
    const serialized = await serializeEncryptedWalletPackage(USER_ID, packageValue)
    const parsed = JSON.parse(serialized)
    const result = await validateBackup({ backup: parsed, expectedWalletId: WALLET_ID, expectedUserId: USER_ID })
    expect(result).toEqual({ ok: true, warnings: [] })
  })

  it("round-trips: tampering with an exported backup after the fact is caught", async () => {
    const packageValue = packageBody()
    const serialized = await serializeEncryptedWalletPackage(USER_ID, packageValue)
    const parsed = JSON.parse(serialized)
    parsed.package.accounts[0].accountId = "tampered"
    const result = await validateBackup({ backup: parsed, expectedWalletId: WALLET_ID, expectedUserId: USER_ID })
    expect(result.ok).toBe(false)
  })
})

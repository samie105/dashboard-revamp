import type { CryptoWalletPackage } from "@/lib/crypto-backend"

import { WALLET_BACKUP_FORMAT, computeBackupChecksum, validateBackup } from "./backup-validation"

const DATABASE_NAME = "worldstreet-crypto-wallet"
const STORE_NAME = "encrypted-packages"
const DATABASE_VERSION = 1

type StoredPackage = {
  key: string
  userId: string
  walletId: string
  package: CryptoWalletPackage
  savedAt: string
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.reject(new Error("Encrypted wallet storage is unavailable in this browser"))
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onerror = () => reject(request.error ?? new Error("Could not open encrypted wallet storage"))
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "key" })
      }
    }
    request.onsuccess = () => resolve(request.result)
  })
}

export async function saveEncryptedWalletPackage(userId: string, walletId: string, packageValue: CryptoWalletPackage) {
  const database = await openDatabase()
  const value: StoredPackage = {
    key: `${userId}:${walletId}`,
    userId,
    walletId,
    package: packageValue,
    savedAt: new Date().toISOString(),
  }

  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(value)
    request.onerror = () => reject(request.error ?? new Error("Could not save encrypted wallet package"))
    request.onsuccess = () => resolve()
  })
  database.close()
}

export async function loadEncryptedWalletPackage(userId: string, walletId: string) {
  const database = await openDatabase()
  const value = await new Promise<StoredPackage | undefined>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(`${userId}:${walletId}`)
    request.onerror = () => reject(request.error ?? new Error("Could not read encrypted wallet package"))
    request.onsuccess = () => resolve(request.result as StoredPackage | undefined)
  })
  database.close()
  return value?.package
}

export async function deleteEncryptedWalletPackage(userId: string, walletId: string) {
  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(`${userId}:${walletId}`)
    request.onerror = () => reject(request.error ?? new Error("Could not delete encrypted wallet package"))
    request.onsuccess = () => resolve()
  })
  database.close()
}

/** Backup export gains a checksum (spec §12): a SHA-256 digest of the
 *  canonical JSON of the package body, plus the exporting user's id, so a
 *  restore can later detect tampering and cross-wallet/cross-user mix-ups
 *  before anything is written. See `backup-validation.ts` for the matching
 *  canonicalization used to verify this on restore. */
export async function serializeEncryptedWalletPackage(userId: string, packageValue: CryptoWalletPackage) {
  const checksum = await computeBackupChecksum(packageValue)
  return JSON.stringify({
    backupFormat: WALLET_BACKUP_FORMAT,
    exportedAt: new Date().toISOString(),
    userId,
    package: packageValue,
    checksum,
  }, null, 2)
}

/**
 * Step 1 of a restore: parse and validate a backup file, writing nothing.
 * Throws with user-facing copy (spec §12) on any problem — JSON parse
 * failures get the same "not a Worldstreet backup" copy `validateBackup`
 * uses for other unrecognizable input, so a corrupted/truncated file and a
 * well-formed-but-wrong-shaped one read the same to the user. The caller is
 * expected to confirm with the user before writing, via
 * `commitWalletBackupRestore`.
 */
export async function previewWalletBackupRestore(userId: string, walletId: string, backupText: string) {
  let parsed: unknown
  try {
    parsed = JSON.parse(backupText)
  } catch {
    throw new Error("That file isn't a Worldstreet backup.")
  }
  const result = await validateBackup({ backup: parsed, expectedWalletId: walletId, expectedUserId: userId })
  if (!result.ok) throw new Error(result.problem)
  const packageValue = (parsed as { package: CryptoWalletPackage }).package
  return { packageValue, warnings: result.warnings }
}

/** Step 2 of a restore: the write, run only after the caller has confirmed. */
export async function commitWalletBackupRestore(userId: string, walletId: string, packageValue: CryptoWalletPackage) {
  await saveEncryptedWalletPackage(userId, walletId, packageValue)
  return packageValue
}

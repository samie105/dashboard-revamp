import type { CryptoWalletPackage } from "@/lib/crypto-backend"

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

export function serializeEncryptedWalletPackage(packageValue: CryptoWalletPackage) {
  return JSON.stringify({
    backupFormat: "worldstreet-encrypted-wallet-backup-v1",
    exportedAt: new Date().toISOString(),
    package: packageValue,
  }, null, 2)
}

export async function restoreEncryptedWalletPackage(userId: string, walletId: string, backupText: string) {
  let parsed: { backupFormat?: string; package?: CryptoWalletPackage }
  try {
    parsed = JSON.parse(backupText) as { backupFormat?: string; package?: CryptoWalletPackage }
  } catch {
    throw new Error("Wallet backup is not valid JSON")
  }
  const packageValue = parsed.package
  if (parsed.backupFormat !== "worldstreet-encrypted-wallet-backup-v1" || !packageValue || packageValue.format !== "worldstreet-wallet-package") {
    throw new Error("Unsupported wallet backup format")
  }
  if (String(packageValue.walletId) !== walletId || !Array.isArray(packageValue.accounts) || !Array.isArray(packageValue.envelopes)) {
    throw new Error("Wallet backup does not belong to this wallet")
  }
  await saveEncryptedWalletPackage(userId, walletId, packageValue)
  return packageValue
}

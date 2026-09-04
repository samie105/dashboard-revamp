import { CryptoBackendClient, cryptoBackendClient } from "@/lib/crypto-backend"
import type { CryptoNetwork, CryptoWalletPackage, CryptoWalletPackageDocument } from "@/lib/crypto-backend"
import nacl from "tweetnacl"

import { fromBase64Url, randomBytes, toBase64Url, wipeBytes } from "./encoding"
import { generateAccountKey, signEd25519Message } from "./key-generation"
import {
  derivePrfWrappingKey,
  derivePassphraseWrappingKey,
  derivePinWrappingKey,
  deriveRecoveryWrappingKey,
  decryptKeyMaterial,
  encryptKeyMaterial,
  fingerprint,
  PASSKEY_PRF_SALT,
  WALLET_PASSPHRASE_KDF_ITERATIONS,
  WALLET_PIN_KDF_ITERATIONS,
  unwrapDek,
  wrapDek,
} from "./package-crypto"
import { authenticateWalletPasskey, registerWalletPasskey } from "./security-service"
import { saveEncryptedWalletPackage } from "./local-storage"
import { getUnlockedWalletState, setUnlockedWalletState } from "./unlock-state"

export class WalletUnlockError extends Error {
  constructor(message: string, public readonly reason: "wrong-passphrase" | "malformed-package" | "unlock-failed") {
    super(message)
    this.name = "WalletUnlockError"
  }
}

type PackageEnvelope = {
  envelopeId: string
  purpose: string
  credentialId?: string
  wrappedDek: string
  iv: string
  aad: string
  keyDerivationMetadata?: Record<string, unknown>
  recoveryPublicKey?: string
}

function packageEnvelopes(packageValue: CryptoWalletPackageDocument | CryptoWalletPackage) {
  return (Array.isArray(packageValue.envelopes) ? packageValue.envelopes : []) as PackageEnvelope[]
}

function validatePin(pin: string) {
  if (!/^\d{6,12}$/.test(pin)) throw new Error("Use a 6 to 12 digit PIN")
}

const pinFailures = new Map<string, { count: number; lockedUntil: number }>()
const PIN_MAX_ATTEMPTS = 5
const PIN_LOCK_MS = 60_000

async function unwrapRecoveryDek(envelope: PackageEnvelope, secret: Uint8Array) {
  try {
    return await unwrapDek(
      envelope.wrappedDek,
      envelope.iv,
      await deriveRecoveryWrappingKey(secret),
      envelope.aad,
    )
  } catch {
    throw new Error("Recovery secret does not match this wallet")
  }
}

export async function registerNewWalletPasskey(client: CryptoBackendClient = cryptoBackendClient) {
  return registerWalletPasskey(client)
}

export async function authenticateAndUnlockWallet(
  userId: string,
  walletId: string,
  client: CryptoBackendClient = cryptoBackendClient,
) {
  const authentication = await authenticateWalletPasskey(client)
  if (!authentication.prfOutput) {
    throw new Error("This passkey authenticated, but it did not provide WebAuthn PRF output. Use the recovery secret to unlock this wallet, or register a passkey provider with PRF support.")
  }

  const packageValue = await client.getWalletPackage()
  const envelope = packageEnvelopes(packageValue).find(
    (candidate) => candidate.purpose === "passkey" && (!candidate.credentialId || candidate.credentialId === authentication.credentialId),
  )
  if (!envelope) throw new Error("No passkey wallet envelope is configured")

  const metadata = envelope.keyDerivationMetadata ?? {}
  const salt = typeof metadata.salt === "string" ? fromBase64Url(metadata.salt) : undefined
  const wrappingKey = await derivePrfWrappingKey(authentication.prfOutput, salt)
  const dek = await unwrapDek(envelope.wrappedDek, envelope.iv, wrappingKey, envelope.aad)
  setUnlockedWalletState(userId, walletId, dek)
  dek.fill(0)

  return {
    package: packageValue,
    walletAuthorizationToken: authentication.walletAuthorizationToken,
    credentialId: authentication.credentialId,
    prfSupported: true,
    prfOutput: authentication.prfOutput,
  }
}

export async function unlockWalletWithRecoverySecret(
  userId: string,
  walletId: string,
  packageValue: CryptoWalletPackageDocument,
  recoverySecret: string,
) {
  const secret = fromBase64Url(recoverySecret)
  const envelope = packageEnvelopes(packageValue).find((candidate) => candidate.purpose === "recovery")
  if (!envelope) {
    secret.fill(0)
    throw new WalletUnlockError("No recovery envelope is configured", "malformed-package")
  }

  let dek: Uint8Array
  try {
    dek = await unwrapDek(envelope.wrappedDek, envelope.iv, await deriveRecoveryWrappingKey(secret), envelope.aad)
  } catch (error) {
    secret.fill(0)
    if (error instanceof DOMException && error.name === "OperationError") {
      throw new WalletUnlockError("Recovery secret does not match this wallet", "wrong-passphrase")
    }
    throw new WalletUnlockError(error instanceof Error ? error.message : "Wallet unlock failed", "unlock-failed")
  }
  setUnlockedWalletState(userId, walletId, dek)
  dek.fill(0)
  secret.fill(0)
  return packageValue
}

export async function unlockWalletWithPassphrase(
  userId: string,
  walletId: string,
  packageValue: CryptoWalletPackageDocument,
  passphrase: string,
) {
  const envelope = packageEnvelopes(packageValue).find((candidate) => candidate.purpose === "passphrase")
  if (!envelope) throw new WalletUnlockError("This wallet does not have a wallet passphrase yet. Unlock it with the recovery secret and set one.", "malformed-package")

  const metadata = envelope.keyDerivationMetadata ?? {}
  if (metadata.kind !== "pbkdf2-sha256" || typeof metadata.salt !== "string") {
    throw new WalletUnlockError("This wallet passphrase envelope is invalid", "malformed-package")
  }
  const iterations = Number(metadata.iterations)
  if (!Number.isSafeInteger(iterations) || iterations < 100_000 || iterations > 2_000_000) {
    throw new WalletUnlockError("This wallet passphrase envelope has invalid key-derivation settings", "malformed-package")
  }

  let salt: Uint8Array | undefined
  let wrappingKey: Uint8Array | undefined
  try {
    salt = fromBase64Url(metadata.salt)
    wrappingKey = await derivePassphraseWrappingKey(passphrase.trim(), salt, iterations)
    const dek = await unwrapDek(envelope.wrappedDek, envelope.iv, wrappingKey, envelope.aad)
    setUnlockedWalletState(userId, walletId, dek)
    dek.fill(0)
    return packageValue
  } catch (error) {
    if (error instanceof DOMException && error.name === "OperationError") {
      throw new WalletUnlockError("Wallet passphrase is incorrect.", "wrong-passphrase")
    }
    throw new WalletUnlockError(error instanceof Error ? error.message : "Wallet unlock failed", "unlock-failed")
  } finally {
    wipeBytes(salt)
    wipeBytes(wrappingKey)
  }
}

/**
 * Links an already-registered passkey to the wallet when its credential exists
 * on the server but its encrypted DEK envelope was never committed. This is
 * the cross-device bootstrap path for synced iCloud/Android passkeys.
 */
export async function adoptExistingWalletPasskeyWithRecovery(
  userId: string,
  walletId: string,
  packageValue: CryptoWalletPackageDocument,
  recoverySecret: string,
  client: CryptoBackendClient = cryptoBackendClient,
) {
  const secret = fromBase64Url(recoverySecret)
  const existingRecovery = packageEnvelopes(packageValue).find((candidate) => candidate.purpose === "recovery")
  if (!existingRecovery) {
    secret.fill(0)
    throw new Error("No recovery envelope is configured")
  }

  const dek = await unwrapRecoveryDek(existingRecovery, secret)
  try {
    const authentication = await authenticateWalletPasskey(client)
    if (!authentication.prfOutput) throw new Error("This passkey does not support secure wallet-key wrapping on this device")

    const wallet = await client.getWallet()
    const envelopeId = crypto.randomUUID()
    const aad = `worldstreet:passkey:${wallet.id}:${envelopeId}`
    const wrapped = await wrapDek(dek, await derivePrfWrappingKey(authentication.prfOutput), aad)
    const nextPackage = {
      format: packageValue.format,
      version: wallet.version + 1,
      baseVersion: wallet.version,
      walletId: wallet.id,
      securityVersion: Math.max(wallet.securityVersion, packageValue.securityVersion),
      accounts: packageValue.accounts,
      envelopes: [
        ...packageEnvelopes(packageValue),
        {
          envelopeId,
          purpose: "passkey",
          methodVersion: 1,
          credentialId: authentication.credentialId,
          wrappedDek: wrapped.wrappedDek,
          iv: wrapped.iv,
          aad,
          keyDerivationMetadata: { kind: "webauthn-prf-sha256", version: 1, salt: toBase64Url(PASSKEY_PRF_SALT) },
        },
      ],
    }

    const committed = await client.commitWalletPackage(nextPackage, authentication.walletAuthorizationToken)
    await saveEncryptedWalletPackage(userId, walletId, committed)
    setUnlockedWalletState(userId, walletId, dek)
    return { package: committed, walletAuthorizationToken: authentication.walletAuthorizationToken, credentialId: authentication.credentialId }
  } finally {
    wipeBytes(dek)
    secret.fill(0)
  }
}

export async function unlockWalletWithPin(userId: string, walletId: string, packageValue: CryptoWalletPackageDocument, pin: string) {
  validatePin(pin)
  const attemptKey = `${userId}:${walletId}`
  const previous = pinFailures.get(attemptKey)
  if (previous && previous.lockedUntil > Date.now()) throw new WalletUnlockError("Too many incorrect PIN attempts. Try again in one minute or use your passphrase.", "unlock-failed")
  const envelope = packageEnvelopes(packageValue).find((candidate) => candidate.purpose === "pin")
  if (!envelope) throw new WalletUnlockError("No PIN is configured for this wallet", "malformed-package")
  const metadata = envelope.keyDerivationMetadata ?? {}
  if (metadata.kind !== "pbkdf2-sha256-pin" || typeof metadata.salt !== "string") throw new WalletUnlockError("This wallet PIN envelope is invalid", "malformed-package")
  const iterations = Number(metadata.iterations)
  if (!Number.isSafeInteger(iterations) || iterations < 200_000 || iterations > 2_000_000) throw new WalletUnlockError("This wallet PIN envelope has invalid key-derivation settings", "malformed-package")
  let salt: Uint8Array | undefined
  let wrappingKey: Uint8Array | undefined
  try {
    salt = fromBase64Url(metadata.salt)
    wrappingKey = await derivePinWrappingKey(pin, salt, iterations)
    const dek = await unwrapDek(envelope.wrappedDek, envelope.iv, wrappingKey, envelope.aad)
    pinFailures.delete(attemptKey)
    setUnlockedWalletState(userId, walletId, dek)
    dek.fill(0)
    return packageValue
  } catch (error) {
    if (error instanceof DOMException && error.name === "OperationError") {
      const count = (previous?.count ?? 0) + 1
      const lockedUntil = count >= PIN_MAX_ATTEMPTS ? Date.now() + PIN_LOCK_MS : 0
      pinFailures.set(attemptKey, { count, lockedUntil })
      await new Promise((resolve) => setTimeout(resolve, Math.min(1_000 * 2 ** (count - 1), 8_000)))
      throw new WalletUnlockError(lockedUntil ? "Too many incorrect PIN attempts. Try again in one minute or use your passphrase." : "PIN is incorrect.", lockedUntil ? "unlock-failed" : "wrong-passphrase")
    }
    throw new WalletUnlockError(error instanceof Error ? error.message : "Wallet unlock failed", "unlock-failed")
  } finally { wipeBytes(salt); wipeBytes(wrappingKey) }
}

export async function setWalletPin(userId: string, walletId: string, packageValue: CryptoWalletPackageDocument, passphrase: string, pin: string, authorizeWallet: () => Promise<{ walletAuthorizationToken: string }>, client: CryptoBackendClient = cryptoBackendClient) {
  validatePin(pin)
  await unlockWalletWithPassphrase(userId, walletId, packageValue, passphrase)
  const state = getUnlockedWalletState(userId, walletId)
  if (!state) throw new Error("Wallet could not be unlocked for PIN setup")
  const dek = new Uint8Array(state.dek)
  let salt: Uint8Array | undefined
  let wrappingKey: Uint8Array | undefined
  try {
    const wallet = await client.getWallet()
    const envelopeId = crypto.randomUUID()
    salt = randomBytes(16)
    wrappingKey = await derivePinWrappingKey(pin, salt)
    const wrapped = await wrapDek(dek, wrappingKey, `worldstreet:pin:${wallet.id}:${envelopeId}`)
    const nextPackage = {
      format: packageValue.format, version: wallet.version + 1, baseVersion: wallet.version, walletId: wallet.id,
      securityVersion: Math.max(wallet.securityVersion, packageValue.securityVersion), accounts: packageValue.accounts,
      envelopes: [...packageEnvelopes(packageValue).filter((candidate) => candidate.purpose !== "pin"), {
        envelopeId, purpose: "pin", methodVersion: 1, wrappedDek: wrapped.wrappedDek, iv: wrapped.iv, aad: wrapped.aad,
        keyDerivationMetadata: { kind: "pbkdf2-sha256-pin", version: 1, salt: toBase64Url(salt), iterations: WALLET_PIN_KDF_ITERATIONS },
      }],
    }
    const authorization = await authorizeWallet()
    const committed = await client.commitWalletPackage(nextPackage, authorization.walletAuthorizationToken)
    await saveEncryptedWalletPackage(userId, walletId, committed)
    setUnlockedWalletState(userId, walletId, dek)
    return committed
  } finally { wipeBytes(dek); wipeBytes(salt); wipeBytes(wrappingKey) }
}

/** Adds newly enabled chain families to an existing encrypted wallet. */
export async function addWalletChains(
  userId: string,
  walletId: string,
  packageValue: CryptoWalletPackageDocument,
  passphrase: string,
  recoverySecret: string,
  authorizeWallet: () => Promise<{ walletAuthorizationToken: string }>,
  client: CryptoBackendClient = cryptoBackendClient,
) {
  await unlockWalletWithPassphrase(userId, walletId, packageValue, passphrase)
  const state = getUnlockedWalletState(userId, walletId)
  if (!state) throw new Error("Unlock the wallet before adding chains")

  const wallet = await client.getWallet()
  const networks = await client.listNetworks()
  const existingFamilies = new Set((packageValue.accounts as Array<Record<string, unknown>>).map((account) => String(account.family)))
  const requestedFamilies = ["evm", "solana", "sui", "ton", "tron", "intertrain"] as const
  const missingFamilies = requestedFamilies.filter((family) => !existingFamilies.has(family))
  if (missingFamilies.length === 0) return packageValue

    const dek = new Uint8Array(state.dek)
  try {
    const preparedAccounts = await Promise.all(missingFamilies.map(async (family) => {
      const account = await client.prepareAccount({
        chainFamily: family,
        keyAlgorithm: family === "evm" || family === "tron" ? "secp256k1" : "ed25519",
        keyType: "private-key",
      })
      const key = generateAccountKey(family)
      try {
        const encryptedKeyMaterial = await encryptKeyMaterial(key.secretKey, `worldstreet:account:${wallet.id}:${account.id}`, dek)
        const addresses = networks.filter((network: CryptoNetwork) => network.family === family).map((network: CryptoNetwork) => ({ networkId: network.id, address: key.canonicalAddress, isCanonical: true }))
        if (addresses.length === 0) throw new Error(`No enabled ${family} network is configured`)
        return {
          accountId: account.id,
          family: key.family,
          algorithm: key.algorithm,
          keyType: key.keyType,
          publicKey: key.publicKey,
          canonicalAddress: key.canonicalAddress,
          addresses,
          encryptedKeyMaterial,
          derivationMetadata: { source: "browser", version: 1 },
          capabilities: { localSigning: true },
        }
      } finally {
        wipeBytes(key.secretKey)
      }
    }))

    const nextPackage = {
      format: packageValue.format,
      version: wallet.version + 1,
      baseVersion: wallet.version,
      walletId: wallet.id,
      securityVersion: packageValue.securityVersion,
      accounts: [...packageValue.accounts, ...preparedAccounts],
      envelopes: packageValue.envelopes,
    }
    const authorization = await authorizeWallet()
    const committed = await client.commitWalletPackage(nextPackage, authorization.walletAuthorizationToken)
    await saveEncryptedWalletPackage(userId, walletId, committed)
    setUnlockedWalletState(userId, walletId, dek)
    return committed
  } finally {
    wipeBytes(dek)
  }
}

export async function authorizeWalletWithRecoverySecret(
  recoverySecret: string,
  client: CryptoBackendClient = cryptoBackendClient,
) {
  const ceremony = await client.startRecoveryAuthorization()
  const proof = createRecoveryProof(recoverySecret, ceremony.challenge)
  return client.completeRecoveryAuthorization({ authorizationId: ceremony.authorizationId, ...proof })
}

export async function setWalletPassphraseWithRecovery(
  userId: string,
  walletId: string,
  packageValue: CryptoWalletPackageDocument,
  recoverySecret: string,
  passphrase: string,
  authorizeWallet: () => Promise<{ walletAuthorizationToken: string }>,
  client: CryptoBackendClient = cryptoBackendClient,
) {
  if (passphrase.trim().length < 12) throw new Error("Choose a wallet passphrase with at least 12 characters")

  const secret = fromBase64Url(recoverySecret)
  const existingRecovery = packageEnvelopes(packageValue).find((candidate) => candidate.purpose === "recovery")
  if (!existingRecovery) {
    wipeBytes(secret)
    throw new Error("No recovery envelope is configured")
  }

  const dek = await unwrapRecoveryDek(existingRecovery, secret)
  let salt: Uint8Array | undefined
  let wrappingKey: Uint8Array | undefined
  try {
    const wallet = await client.getWallet()
    const envelopeId = crypto.randomUUID()
    salt = randomBytes(16)
    wrappingKey = await derivePassphraseWrappingKey(passphrase.trim(), salt)
    const aad = `worldstreet:passphrase:${wallet.id}:${envelopeId}`
    const wrapped = await wrapDek(dek, wrappingKey, aad)
    const nextPackage = {
      format: packageValue.format,
      version: wallet.version + 1,
      baseVersion: wallet.version,
      walletId: wallet.id,
      securityVersion: Math.max(wallet.securityVersion, packageValue.securityVersion),
      accounts: packageValue.accounts,
      envelopes: [
        ...packageEnvelopes(packageValue).filter((candidate) => candidate.purpose !== "passkey" && candidate.purpose !== "passphrase"),
        {
          envelopeId,
          purpose: "passphrase",
          methodVersion: 1,
          wrappedDek: wrapped.wrappedDek,
          iv: wrapped.iv,
          aad: wrapped.aad,
          keyDerivationMetadata: { kind: "pbkdf2-sha256", version: 1, salt: toBase64Url(salt), iterations: WALLET_PASSPHRASE_KDF_ITERATIONS },
        },
      ],
    }
    const authorization = await authorizeWallet()
    const committed = await client.commitWalletPackage(nextPackage, authorization.walletAuthorizationToken)
    await saveEncryptedWalletPackage(userId, walletId, committed)
    setUnlockedWalletState(userId, walletId, dek)
    return { package: committed, walletAuthorizationToken: authorization.walletAuthorizationToken }
  } finally {
    wipeBytes(dek)
    wipeBytes(secret)
    wipeBytes(salt)
    wipeBytes(wrappingKey)
  }
}

/**
 * Replaces the wallet's passkey envelope using the recovery secret. This is
 * the migration path for a passkey provider that returns UV=false or no PRF
 * output (for example, an old synced password-manager credential).
 */
export async function replaceWalletPasskeyWithRecovery(
  userId: string,
  walletId: string,
  packageValue: CryptoWalletPackageDocument,
  recoverySecret: string,
  client: CryptoBackendClient = cryptoBackendClient,
) {
  const secret = fromBase64Url(recoverySecret)
  const existingRecovery = packageEnvelopes(packageValue).find((candidate) => candidate.purpose === "recovery")
  if (!existingRecovery) {
    secret.fill(0)
    throw new Error("No recovery envelope is configured")
  }

  const dek = await unwrapRecoveryDek(existingRecovery, secret)

  try {
    const registration = await registerNewWalletPasskey(client)
    if (!registration.prfOutput) throw new Error("The new device passkey did not provide WebAuthn PRF output")

    const wallet = await client.getWallet()
    const envelopeId = crypto.randomUUID()
    const aad = `worldstreet:passkey:${wallet.id}:${envelopeId}`
    const wrapped = await wrapDek(dek, await derivePrfWrappingKey(registration.prfOutput), aad)
    const nextPackage = {
      format: packageValue.format,
      version: wallet.version + 1,
      baseVersion: wallet.version,
      walletId: wallet.id,
      securityVersion: Math.max(wallet.securityVersion, packageValue.securityVersion),
      accounts: packageValue.accounts,
      // Append this credential while retaining every existing passkey and the
      // recovery path. A wallet may have passkeys on multiple devices and
      // platforms (iCloud, Android, macOS, Windows, or a security key).
      envelopes: [
        ...packageEnvelopes(packageValue),
        {
          envelopeId,
          purpose: "passkey",
          methodVersion: 1,
          credentialId: registration.credentialId,
          wrappedDek: wrapped.wrappedDek,
          iv: wrapped.iv,
          aad: wrapped.aad,
          keyDerivationMetadata: { kind: "webauthn-prf-sha256", version: 1, salt: toBase64Url(PASSKEY_PRF_SALT) },
        },
      ],
    }

    const committed = await client.commitWalletPackage(nextPackage, registration.walletAuthorizationToken)
    await saveEncryptedWalletPackage(userId, walletId, committed)
    setUnlockedWalletState(userId, walletId, dek)
    return {
      package: committed,
      walletAuthorizationToken: registration.walletAuthorizationToken,
      credentialId: registration.credentialId,
    }
  } finally {
    wipeBytes(dek)
    secret.fill(0)
  }
}

/**
 * Rebuilds a valid next-version package after a recovery proof. Account
 * ciphertext is retained; only the recovery envelope is replaced, so the
 * frontend never needs to expose or re-send plaintext key material.
 */
export async function buildRecoveryPackage(
  packageValue: CryptoWalletPackageDocument,
  recoverySecret: string,
  client: CryptoBackendClient = cryptoBackendClient,
) {
  const wallet = await client.getWallet()
  const secret = fromBase64Url(recoverySecret)
  const existingRecovery = packageEnvelopes(packageValue).find((candidate) => candidate.purpose === "recovery")
  if (!existingRecovery) throw new Error("No recovery envelope is configured")

  const dek = await unwrapRecoveryDek(existingRecovery, secret)
  const envelopeId = crypto.randomUUID()
  const aad = `worldstreet:recovery:${wallet.id}:${envelopeId}`
  const wrapped = await wrapDek(dek, await deriveRecoveryWrappingKey(secret), aad)
  const recoveryPublicKey = nacl.sign.keyPair.fromSeed(secret).publicKey
  const recoveryEnvelope = {
    envelopeId,
    purpose: "recovery",
    methodVersion: 1,
    wrappedDek: wrapped.wrappedDek,
    iv: wrapped.iv,
    aad,
    keyDerivationMetadata: { kind: "recovery-secret-sha256", version: 1 },
    recoveryPublicKey: toBase64Url(recoveryPublicKey),
    verificationFingerprint: await fingerprint(recoveryPublicKey),
  }
  const nextPackage = {
    format: packageValue.format,
    version: wallet.version + 1,
    baseVersion: wallet.version,
    walletId: wallet.id,
    securityVersion: Math.max(wallet.securityVersion, packageValue.securityVersion),
    accounts: packageValue.accounts,
    envelopes: [...packageEnvelopes(packageValue).filter((candidate) => candidate.purpose !== "recovery"), recoveryEnvelope],
  }
  dek.fill(0)
  secret.fill(0)
  return nextPackage
}

export function createRecoveryProof(recoverySecret: string, challenge: string) {
  const secret = fromBase64Url(recoverySecret)
  const keypair = nacl.sign.keyPair.fromSeed(secret)
  const proof = {
    recoveryPublicKey: toBase64Url(keypair.publicKey),
    signature: signEd25519Message(secret, challenge),
  }
  secret.fill(0)
  return proof
}

/** Re-encrypts every account with a fresh DEK and replaces both root envelopes. */
export async function rotateWalletPackage(
  userId: string,
  walletId: string,
  recoverySecret: string,
  passphrase: string,
  authorizeWallet: () => Promise<{ walletAuthorizationToken: string }>,
  client: CryptoBackendClient = cryptoBackendClient,
) {
  const currentPackage = await client.getWalletPackage()
  await unlockWalletWithPassphrase(userId, walletId, currentPackage, passphrase)
  const state = getUnlockedWalletState(userId, walletId)
  if (!state) throw new Error("Wallet could not be unlocked for rotation")

  const wallet = await client.getWallet()
  const recoverySeed = fromBase64Url(recoverySecret)
  const nextDek = randomBytes(32)
  let passphraseSalt: Uint8Array | undefined
  let passphraseWrappingKey: Uint8Array | undefined
  try {
    const accounts = await Promise.all((currentPackage.accounts as Array<Record<string, unknown>>).map(async (account) => {
      const encrypted = account.encryptedKeyMaterial as { ciphertext: string; iv: string; aad: string } | undefined
      if (!encrypted) throw new Error("Account encrypted key material is missing")
      const plaintext = await decryptKeyMaterial(encrypted, new Uint8Array(state.dek))
      try {
        const accountId = String(account.accountId)
        const encryptedKeyMaterial = await encryptKeyMaterial(plaintext, `worldstreet:account:${wallet.id}:${accountId}:v${wallet.version + 1}`, nextDek)
        return { ...account, encryptedKeyMaterial }
      } finally {
        wipeBytes(plaintext)
      }
    }))

    const passphraseEnvelopeId = crypto.randomUUID()
    passphraseSalt = randomBytes(16)
    passphraseWrappingKey = await derivePassphraseWrappingKey(passphrase.trim(), passphraseSalt)
    const passphraseAad = `worldstreet:passphrase:${wallet.id}:${passphraseEnvelopeId}`
    const passphraseWrap = await wrapDek(nextDek, passphraseWrappingKey, passphraseAad)
    const recoveryEnvelopeId = crypto.randomUUID()
    const recoveryAad = `worldstreet:recovery:${wallet.id}:${recoveryEnvelopeId}`
    const recoveryWrap = await wrapDek(nextDek, await deriveRecoveryWrappingKey(recoverySeed), recoveryAad)
    const recoveryPublicKey = nacl.sign.keyPair.fromSeed(recoverySeed).publicKey
    const nextPackage = {
      format: currentPackage.format,
      version: wallet.version + 1,
      baseVersion: wallet.version,
      walletId: wallet.id,
      securityVersion: Math.max(wallet.securityVersion, currentPackage.securityVersion) + 1,
      accounts,
      envelopes: [
        {
          envelopeId: passphraseEnvelopeId,
          purpose: "passphrase",
          methodVersion: 1,
          wrappedDek: passphraseWrap.wrappedDek,
          iv: passphraseWrap.iv,
          aad: passphraseWrap.aad,
          keyDerivationMetadata: { kind: "pbkdf2-sha256", version: 1, salt: toBase64Url(passphraseSalt), iterations: WALLET_PASSPHRASE_KDF_ITERATIONS },
        },
        {
          envelopeId: recoveryEnvelopeId,
          purpose: "recovery",
          methodVersion: 1,
          wrappedDek: recoveryWrap.wrappedDek,
          iv: recoveryWrap.iv,
          aad: recoveryWrap.aad,
          keyDerivationMetadata: { kind: "recovery-secret-sha256", version: 1 },
          recoveryPublicKey: toBase64Url(recoveryPublicKey),
          verificationFingerprint: await fingerprint(recoveryPublicKey),
        },
      ],
    }
    const authorization = await authorizeWallet()
    const committed = await client.commitWalletPackage(nextPackage, authorization.walletAuthorizationToken, true)
    // Do not replace the browser copy until the server's active package has
    // been verified with the fresh DEK. This catches a malformed response or
    // encryption mismatch before the old local package is discarded.
    for (const account of committed.accounts as Array<Record<string, unknown>>) {
      const encrypted = account.encryptedKeyMaterial as { ciphertext: string; iv: string; aad: string } | undefined
      if (!encrypted) throw new Error("Rotated wallet package is missing account key material")
      const verified = await decryptKeyMaterial(encrypted, nextDek)
      wipeBytes(verified)
    }
    return { package: committed, dek: nextDek }
  } catch (error) {
    wipeBytes(nextDek)
    throw error
  } finally {
    wipeBytes(recoverySeed)
    wipeBytes(passphraseSalt)
    wipeBytes(passphraseWrappingKey)
    // The caller receives the fresh DEK and takes ownership of clearing it.
  }
}

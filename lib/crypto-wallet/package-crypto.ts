import { concatBytes, fromBase64Url, randomBytes, toBase64Url, utf8 } from "./encoding"

export const WALLET_PACKAGE_FORMAT = "worldstreet-wallet-package" as const
export const WALLET_PACKAGE_VERSION = 1
export const WALLET_DEK_VERSION = 1
export const PASSKEY_PRF_SALT = utf8("worldstreet-wallet-dek-prf-v1")
export const WALLET_PASSPHRASE_KDF_ITERATIONS = 600_000

async function digest(value: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", value as unknown as BufferSource))
}

async function aesKey(rawKey: Uint8Array, usages: KeyUsage[]) {
  return crypto.subtle.importKey("raw", rawKey as unknown as BufferSource, { name: "AES-GCM" }, false, usages)
}

export async function derivePrfWrappingKey(prfOutput: Uint8Array, salt = PASSKEY_PRF_SALT) {
  return digest(concatBytes(utf8("worldstreet-prf-wrap-v1:"), salt, prfOutput))
}

export async function deriveRecoveryWrappingKey(recoverySecret: Uint8Array) {
  return digest(concatBytes(utf8("worldstreet-recovery-wrap-v1:"), recoverySecret))
}

/**
 * Derives the local wallet wrapping key from a user-controlled passphrase.
 * The passphrase never leaves the browser. PBKDF2 is used because it is
 * available through Web Crypto in the supported browsers; the random salt
 * and high iteration count are stored as non-secret envelope metadata.
 */
export async function derivePassphraseWrappingKey(
  passphrase: string,
  salt: Uint8Array,
  iterations = WALLET_PASSPHRASE_KDF_ITERATIONS,
) {
  const key = await crypto.subtle.importKey(
    "raw",
    utf8(passphrase) as unknown as BufferSource,
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as unknown as BufferSource, iterations },
    key,
    256,
  )
  return new Uint8Array(bits)
}

export async function fingerprint(value: Uint8Array): Promise<string> {
  return toBase64Url(await digest(value))
}

export async function encryptKeyMaterial(secretKey: Uint8Array, aad: string, dek: Uint8Array) {
  const iv = randomBytes(12)
  const key = await aesKey(dek, ["encrypt"])
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource, additionalData: utf8(aad) as unknown as BufferSource, tagLength: 128 },
    key,
    secretKey as unknown as BufferSource,
  )
  return {
    ciphertext: toBase64Url(ciphertext),
    iv: toBase64Url(iv),
    aad,
    dekVersion: WALLET_DEK_VERSION,
    encoding: "base64url" as const,
  }
}

export async function wrapDek(dek: Uint8Array, wrappingKey: Uint8Array, aad: string) {
  const iv = randomBytes(12)
  const key = await aesKey(wrappingKey, ["encrypt"])
  const wrappedDek = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource, additionalData: utf8(aad) as unknown as BufferSource, tagLength: 128 },
    key,
    dek as unknown as BufferSource,
  )
  return { wrappedDek: toBase64Url(wrappedDek), iv: toBase64Url(iv), aad }
}

export async function unwrapDek(wrappedDek: string, iv: string, wrappingKey: Uint8Array, aad: string) {
  const key = await aesKey(wrappingKey, ["decrypt"])
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(iv) as unknown as BufferSource, additionalData: utf8(aad) as unknown as BufferSource, tagLength: 128 },
    key,
    fromBase64Url(wrappedDek) as unknown as BufferSource,
  )
  return new Uint8Array(plaintext)
}

export async function decryptKeyMaterial(
  encrypted: { ciphertext: string; iv: string; aad: string },
  dek: Uint8Array,
) {
  const key = await aesKey(dek, ["decrypt"])
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(encrypted.iv) as unknown as BufferSource, additionalData: utf8(encrypted.aad) as unknown as BufferSource, tagLength: 128 },
    key,
    fromBase64Url(encrypted.ciphertext) as unknown as BufferSource,
  )
  return new Uint8Array(plaintext)
}

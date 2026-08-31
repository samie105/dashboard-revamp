import { describe, expect, it } from "vitest"

import {
  WALLET_PASSPHRASE_KDF_ITERATIONS,
  decryptKeyMaterial,
  derivePassphraseWrappingKey,
  derivePrfWrappingKey,
  deriveRecoveryWrappingKey,
  encryptKeyMaterial,
  fingerprint,
  unwrapDek,
  wrapDek,
} from "../package-crypto"
import { randomBytes, toBase64Url, utf8 } from "../encoding"

/**
 * The encryption underneath the wallet. Everything here was previously
 * untested, including the two properties the whole design rests on: that a
 * wrong passphrase cannot open an envelope, and that AAD actually binds an
 * envelope to the wallet it was made for.
 *
 * PBKDF2 runs at a reduced iteration count except where the real default is
 * the thing under test — 600k iterations per derivation would otherwise turn
 * this file into a minute of waiting.
 */
const FAST_KDF = 1_000
const AAD = "worldstreet:envelope:wallet_1:env_1"

describe("passphrase key derivation", () => {
  it("is deterministic for the same passphrase, salt and iteration count", async () => {
    const salt = randomBytes(16)
    const a = await derivePassphraseWrappingKey("correct horse battery staple", salt, FAST_KDF)
    const b = await derivePassphraseWrappingKey("correct horse battery staple", salt, FAST_KDF)
    expect(toBase64Url(a)).toBe(toBase64Url(b))
    expect(a).toHaveLength(32)
  })

  it("changes with the passphrase, the salt, and the iteration count", async () => {
    const salt = randomBytes(16)
    const base = await derivePassphraseWrappingKey("passphrase-one", salt, FAST_KDF)
    const otherPassphrase = await derivePassphraseWrappingKey("passphrase-two", salt, FAST_KDF)
    const otherSalt = await derivePassphraseWrappingKey("passphrase-one", randomBytes(16), FAST_KDF)
    const otherIterations = await derivePassphraseWrappingKey("passphrase-one", salt, FAST_KDF + 1)
    expect(toBase64Url(otherPassphrase)).not.toBe(toBase64Url(base))
    expect(toBase64Url(otherSalt)).not.toBe(toBase64Url(base))
    expect(toBase64Url(otherIterations)).not.toBe(toBase64Url(base))
  })

  it("works at the shipped iteration count", async () => {
    // Guards against the default being changed to something Web Crypto
    // rejects, which would break wallet creation for everyone at once.
    expect(WALLET_PASSPHRASE_KDF_ITERATIONS).toBe(600_000)
    const key = await derivePassphraseWrappingKey("a real passphrase", randomBytes(16))
    expect(key).toHaveLength(32)
  })
})

describe("recovery and PRF key derivation", () => {
  it("derives the same recovery wrapping key from the same secret", async () => {
    const secret = randomBytes(32)
    expect(toBase64Url(await deriveRecoveryWrappingKey(secret)))
      .toBe(toBase64Url(await deriveRecoveryWrappingKey(secret)))
  })

  it("derives a different recovery wrapping key from a different secret", async () => {
    expect(toBase64Url(await deriveRecoveryWrappingKey(randomBytes(32))))
      .not.toBe(toBase64Url(await deriveRecoveryWrappingKey(randomBytes(32))))
  })

  it("binds the PRF wrapping key to both the PRF output and the salt", async () => {
    const prf = randomBytes(32)
    const base = await derivePrfWrappingKey(prf)
    expect(toBase64Url(await derivePrfWrappingKey(prf))).toBe(toBase64Url(base))
    expect(toBase64Url(await derivePrfWrappingKey(randomBytes(32)))).not.toBe(toBase64Url(base))
    expect(toBase64Url(await derivePrfWrappingKey(prf, utf8("a-different-salt")))).not.toBe(toBase64Url(base))
  })
})

describe("wrapping the data encryption key", () => {
  it("round-trips a DEK through wrap and unwrap", async () => {
    const dek = randomBytes(32)
    const wrappingKey = randomBytes(32)
    const wrapped = await wrapDek(dek, wrappingKey, AAD)
    const recovered = await unwrapDek(wrapped.wrappedDek, wrapped.iv, wrappingKey, AAD)
    expect(toBase64Url(recovered)).toBe(toBase64Url(dek))
  })

  it("refuses the wrong wrapping key", async () => {
    // i.e. a wrong passphrase cannot open the wallet. The single most
    // important property in this file.
    const wrapped = await wrapDek(randomBytes(32), randomBytes(32), AAD)
    await expect(unwrapDek(wrapped.wrappedDek, wrapped.iv, randomBytes(32), AAD)).rejects.toThrow()
  })

  it("refuses a different AAD", async () => {
    // AAD is what binds an envelope to one wallet. If a mismatched AAD still
    // decrypted, an envelope could be lifted from one wallet into another.
    const wrappingKey = randomBytes(32)
    const wrapped = await wrapDek(randomBytes(32), wrappingKey, AAD)
    await expect(
      unwrapDek(wrapped.wrappedDek, wrapped.iv, wrappingKey, "worldstreet:envelope:wallet_2:env_1"),
    ).rejects.toThrow()
  })

  it("refuses a tampered ciphertext", async () => {
    const wrappingKey = randomBytes(32)
    const wrapped = await wrapDek(randomBytes(32), wrappingKey, AAD)
    const flipped = wrapped.wrappedDek.slice(0, -2) + (wrapped.wrappedDek.endsWith("A") ? "B" : "A")
    await expect(unwrapDek(flipped, wrapped.iv, wrappingKey, AAD)).rejects.toThrow()
  })

  it("uses a fresh IV every time", async () => {
    const dek = randomBytes(32)
    const wrappingKey = randomBytes(32)
    const first = await wrapDek(dek, wrappingKey, AAD)
    const second = await wrapDek(dek, wrappingKey, AAD)
    expect(first.iv).not.toBe(second.iv)
    expect(first.wrappedDek).not.toBe(second.wrappedDek)
  })
})

describe("encrypting account key material", () => {
  const ACCOUNT_AAD = "worldstreet:account:wallet_1:acct_1"

  it("round-trips a private key through encrypt and decrypt", async () => {
    const secretKey = randomBytes(32)
    const dek = randomBytes(32)
    const encrypted = await encryptKeyMaterial(secretKey, ACCOUNT_AAD, dek)
    expect(encrypted.encoding).toBe("base64url")
    const recovered = await decryptKeyMaterial(encrypted, dek)
    expect(toBase64Url(recovered)).toBe(toBase64Url(secretKey))
  })

  it("refuses the wrong DEK", async () => {
    const encrypted = await encryptKeyMaterial(randomBytes(32), ACCOUNT_AAD, randomBytes(32))
    await expect(decryptKeyMaterial(encrypted, randomBytes(32))).rejects.toThrow()
  })

  it("refuses an account envelope replayed under another account's AAD", async () => {
    const dek = randomBytes(32)
    const encrypted = await encryptKeyMaterial(randomBytes(32), ACCOUNT_AAD, dek)
    await expect(
      decryptKeyMaterial({ ...encrypted, aad: "worldstreet:account:wallet_1:acct_2" }, dek),
    ).rejects.toThrow()
  })

  it("refuses a tampered ciphertext", async () => {
    const dek = randomBytes(32)
    const encrypted = await encryptKeyMaterial(randomBytes(32), ACCOUNT_AAD, dek)
    const flipped = encrypted.ciphertext.slice(0, -2) + (encrypted.ciphertext.endsWith("A") ? "B" : "A")
    await expect(decryptKeyMaterial({ ...encrypted, ciphertext: flipped }, dek)).rejects.toThrow()
  })

  it("preserves a 64-byte secret, the Solana key length", async () => {
    // Solana secret keys are 64 bytes, not 32 — a length assumption anywhere
    // in this path would corrupt every Solana wallet.
    const secretKey = randomBytes(64)
    const dek = randomBytes(32)
    const recovered = await decryptKeyMaterial(await encryptKeyMaterial(secretKey, ACCOUNT_AAD, dek), dek)
    expect(recovered).toHaveLength(64)
    expect(toBase64Url(recovered)).toBe(toBase64Url(secretKey))
  })
})

describe("fingerprint", () => {
  it("is stable for the same bytes and different for others", async () => {
    const value = randomBytes(32)
    expect(await fingerprint(value)).toBe(await fingerprint(value))
    expect(await fingerprint(randomBytes(32))).not.toBe(await fingerprint(value))
  })
})

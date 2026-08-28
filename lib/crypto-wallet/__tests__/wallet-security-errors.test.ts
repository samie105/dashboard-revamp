import { describe, expect, it } from "vitest"
import type { CryptoWalletPackageDocument } from "@/lib/crypto-backend"

import {
  WalletUnlockError,
  unlockWalletWithPassphrase,
  unlockWalletWithRecoverySecret,
} from "@/lib/crypto-wallet/wallet-security"
import {
  derivePassphraseWrappingKey,
  deriveRecoveryWrappingKey,
  wrapDek,
  WALLET_PASSPHRASE_KDF_ITERATIONS,
} from "@/lib/crypto-wallet/package-crypto"
import { randomBytes, toBase64Url } from "@/lib/crypto-wallet/encoding"

// setWalletPassphraseWithRecovery — wallet-security.ts's only exported
// "create a passphrase envelope" path — hard-requires window.indexedDB (via
// saveEncryptedWalletPackage) and a live CryptoBackendClient, neither of
// which exist in this node test environment (no fake-indexeddb dependency
// in the project). So these fixtures are built with the same *public*
// primitives wallet-security.ts itself uses to construct these envelopes
// (package-crypto.ts's derivePassphraseWrappingKey/deriveRecoveryWrappingKey
// + wrapDek, and encoding.ts's randomBytes/toBase64Url) — real AES-GCM
// wrapped envelopes, not mocks, and no reach into wallet-security.ts's own
// unexported internals.

function walletPackage(envelopes: unknown[]): CryptoWalletPackageDocument {
  return {
    id: "wallet-1",
    walletId: "wallet-1",
    version: 1,
    baseVersion: 1,
    securityVersion: 1,
    format: "worldstreet-wallet-package",
    status: "active",
    accounts: [],
    envelopes,
  }
}

async function buildPassphraseEnvelope(passphrase: string) {
  const dek = randomBytes(32)
  const salt = randomBytes(16)
  const wrappingKey = await derivePassphraseWrappingKey(passphrase, salt)
  const wrapped = await wrapDek(dek, wrappingKey, "worldstreet:passphrase:wallet-1:envelope-1")
  return {
    envelopeId: "envelope-1",
    purpose: "passphrase",
    methodVersion: 1,
    wrappedDek: wrapped.wrappedDek,
    iv: wrapped.iv,
    aad: wrapped.aad,
    keyDerivationMetadata: {
      kind: "pbkdf2-sha256",
      version: 1,
      salt: toBase64Url(salt),
      iterations: WALLET_PASSPHRASE_KDF_ITERATIONS,
    },
  }
}

async function buildRecoveryEnvelope(secret: Uint8Array) {
  const dek = randomBytes(32)
  const wrappingKey = await deriveRecoveryWrappingKey(secret)
  const wrapped = await wrapDek(dek, wrappingKey, "worldstreet:recovery:wallet-1:envelope-1")
  return {
    envelopeId: "envelope-1",
    purpose: "recovery",
    methodVersion: 1,
    wrappedDek: wrapped.wrappedDek,
    iv: wrapped.iv,
    aad: wrapped.aad,
    keyDerivationMetadata: { kind: "recovery-secret-sha256", version: 1 },
  }
}

describe("unlockWalletWithPassphrase — error classification", () => {
  it("rejects the wrong passphrase with a WalletUnlockError reason of 'wrong-passphrase'", async () => {
    const envelope = await buildPassphraseEnvelope("correct horse battery staple 42")
    const packageValue = walletPackage([envelope])

    expect.assertions(3)
    try {
      await unlockWalletWithPassphrase("user-1", "wallet-1", packageValue, "not the right passphrase at all")
    } catch (error) {
      expect(error).toBeInstanceOf(WalletUnlockError)
      expect(error).toBeInstanceOf(Error)
      expect((error as WalletUnlockError).reason).toBe("wrong-passphrase")
    }
  })

  it("rejects a structurally-broken package (no passphrase envelope) with reason 'malformed-package'", async () => {
    const packageValue = walletPackage([]) // no envelopes at all

    expect.assertions(3)
    try {
      await unlockWalletWithPassphrase("user-1", "wallet-1", packageValue, "any passphrase")
    } catch (error) {
      expect(error).toBeInstanceOf(WalletUnlockError)
      expect(error).toBeInstanceOf(Error)
      expect((error as WalletUnlockError).reason).toBe("malformed-package")
    }
  })

  it("rejects invalid key-derivation metadata with reason 'malformed-package'", async () => {
    const packageValue = walletPackage([
      { envelopeId: "envelope-1", purpose: "passphrase", wrappedDek: "x", iv: "y", aad: "z", keyDerivationMetadata: { kind: "not-pbkdf2" } },
    ])

    expect.assertions(3)
    try {
      await unlockWalletWithPassphrase("user-1", "wallet-1", packageValue, "any passphrase")
    } catch (error) {
      expect(error).toBeInstanceOf(WalletUnlockError)
      expect(error).toBeInstanceOf(Error)
      expect((error as WalletUnlockError).reason).toBe("malformed-package")
    }
  })
})

describe("unlockWalletWithRecoverySecret — error classification", () => {
  it("rejects the wrong recovery secret with a WalletUnlockError reason of 'wrong-passphrase'", async () => {
    const secret = randomBytes(32)
    const envelope = await buildRecoveryEnvelope(secret)
    const packageValue = walletPackage([envelope])
    const wrongSecret = toBase64Url(randomBytes(32))

    expect.assertions(3)
    try {
      await unlockWalletWithRecoverySecret("user-1", "wallet-1", packageValue, wrongSecret)
    } catch (error) {
      expect(error).toBeInstanceOf(WalletUnlockError)
      expect(error).toBeInstanceOf(Error)
      expect((error as WalletUnlockError).reason).toBe("wrong-passphrase")
    }
  })

  it("rejects a structurally-broken package (no recovery envelope) with reason 'malformed-package'", async () => {
    const packageValue = walletPackage([])

    expect.assertions(3)
    try {
      await unlockWalletWithRecoverySecret("user-1", "wallet-1", packageValue, toBase64Url(randomBytes(32)))
    } catch (error) {
      expect(error).toBeInstanceOf(WalletUnlockError)
      expect(error).toBeInstanceOf(Error)
      expect((error as WalletUnlockError).reason).toBe("malformed-package")
    }
  })
})

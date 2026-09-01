import { beforeEach, describe, expect, it } from "vitest"
import { recoverTransactionAddress, type TransactionSerializedEIP1559 } from "viem"

import type { CryptoTransactionIntent, CryptoWalletPackageDocument } from "@/lib/crypto-backend"
import { decryptLocalAccountKey } from "../account-secrets"
import { encryptKeyMaterial } from "../package-crypto"
import { generateEvmKey, type GeneratedWalletKey } from "../key-generation"
import { randomBytes, toBase64Url } from "../encoding"
import { signEvmIntent } from "../evm-signing"
import {
  clearUnlockedWalletState,
  getUnlockedWalletState,
  setUnlockedWalletState,
} from "../unlock-state"

/**
 * The path that actually moves money: an encrypted package on disk, a DEK
 * held in memory after unlock, a key decrypted for exactly one signature, and
 * a signed transaction that provably comes from the user's own address.
 *
 * This was the gap the audit called out — the happy path had no automated
 * coverage at all, so nothing proved that a wallet created in the browser can
 * sign anything, or that the fail-closed guards fire when the backend sends
 * an incomplete transaction.
 */

const USER = "user_1"
const WALLET = "wallet_1"
const ACCOUNT = "acct_evm_1"
const accountAad = (walletId: string, accountId: string) => `worldstreet:account:${walletId}:${accountId}`

async function buildPackage(key: GeneratedWalletKey, dek: Uint8Array, walletId = WALLET, accountId = ACCOUNT) {
  return {
    accounts: [
      {
        accountId,
        family: key.family,
        canonicalAddress: key.canonicalAddress,
        encryptedKeyMaterial: await encryptKeyMaterial(key.secretKey, accountAad(walletId, accountId), dek),
      },
    ],
  } as unknown as CryptoWalletPackageDocument
}

/** A complete EIP-1559 request — what the backend is expected to return. */
function evmIntent(overrides: Record<string, unknown> = {}, from?: string): CryptoTransactionIntent {
  return {
    accountId: ACCOUNT,
    chainFamily: "evm",
    unsignedTransaction: {
      family: "evm",
      from: from ?? "0x0000000000000000000000000000000000000000",
      payload: {
        chainId: 1,
        to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        value: "1000000000000000",
        nonce: 7,
        gas: "21000",
        type: "eip1559",
        maxFeePerGas: "30000000000",
        maxPriorityFeePerGas: "1500000000",
        ...overrides,
      },
    },
  } as unknown as CryptoTransactionIntent
}

beforeEach(() => {
  clearUnlockedWalletState()
})

describe("unlock state", () => {
  it("hands back the DEK only for the wallet it was unlocked for", () => {
    const dek = randomBytes(32)
    setUnlockedWalletState(USER, WALLET, dek, 60_000)
    expect(getUnlockedWalletState(USER, WALLET)).toBeDefined()
    expect(getUnlockedWalletState("user_2", WALLET)).toBeUndefined()
    expect(getUnlockedWalletState(USER, "wallet_2")).toBeUndefined()
  })

  it("keeps its own copy, so wiping the caller's DEK doesn't disarm it", () => {
    const dek = randomBytes(32)
    setUnlockedWalletState(USER, WALLET, dek, 60_000)
    dek.fill(0)
    expect(getUnlockedWalletState(USER, WALLET)?.dek.some((b) => b !== 0)).toBe(true)
  })

  it("expires", () => {
    setUnlockedWalletState(USER, WALLET, randomBytes(32), -1)
    expect(getUnlockedWalletState(USER, WALLET)).toBeUndefined()
  })

  it("forgets everything on clear", () => {
    setUnlockedWalletState(USER, WALLET, randomBytes(32), 60_000)
    clearUnlockedWalletState()
    expect(getUnlockedWalletState(USER, WALLET)).toBeUndefined()
  })
})

describe("decryptLocalAccountKey", () => {
  it("returns the exact key that was encrypted into the package", async () => {
    const key = generateEvmKey()
    const dek = randomBytes(32)
    const packageValue = await buildPackage(key, dek)
    setUnlockedWalletState(USER, WALLET, dek, 60_000)

    const recovered = await decryptLocalAccountKey(USER, WALLET, packageValue, ACCOUNT)
    expect(toBase64Url(recovered)).toBe(toBase64Url(key.secretKey))
  })

  it("refuses while the wallet is locked", async () => {
    const packageValue = await buildPackage(generateEvmKey(), randomBytes(32))
    await expect(decryptLocalAccountKey(USER, WALLET, packageValue, ACCOUNT)).rejects.toThrow(/Unlock the wallet/)
  })

  it("refuses once the unlock has expired", async () => {
    const dek = randomBytes(32)
    const packageValue = await buildPackage(generateEvmKey(), dek)
    setUnlockedWalletState(USER, WALLET, dek, -1)
    await expect(decryptLocalAccountKey(USER, WALLET, packageValue, ACCOUNT)).rejects.toThrow(/Unlock the wallet/)
  })

  it("refuses an account that isn't in the package", async () => {
    const dek = randomBytes(32)
    const packageValue = await buildPackage(generateEvmKey(), dek)
    setUnlockedWalletState(USER, WALLET, dek, 60_000)
    await expect(decryptLocalAccountKey(USER, WALLET, packageValue, "acct_missing")).rejects.toThrow(/missing/i)
  })

  it("refuses a DEK from a different unlock", async () => {
    // A stale DEK left over from a rotated package must not decrypt the new
    // one — that's what the AEAD tag is for.
    const packageValue = await buildPackage(generateEvmKey(), randomBytes(32))
    setUnlockedWalletState(USER, WALLET, randomBytes(32), 60_000)
    await expect(decryptLocalAccountKey(USER, WALLET, packageValue, ACCOUNT)).rejects.toThrow()
  })
})

describe("signEvmIntent — end to end", () => {
  it("produces a signature that recovers to the wallet's own address", async () => {
    // The proof that all of it hangs together: generate a key, encrypt it,
    // unlock, sign, and recover the signer from the serialized transaction.
    const key = generateEvmKey()
    const dek = randomBytes(32)
    const packageValue = await buildPackage(key, dek)
    setUnlockedWalletState(USER, WALLET, dek, 60_000)

    const serialized = await signEvmIntent(USER, WALLET, packageValue, evmIntent({}, key.canonicalAddress), ACCOUNT)
    expect(serialized).toMatch(/^0x/)
    const signer = await recoverTransactionAddress({ serializedTransaction: serialized as TransactionSerializedEIP1559 })
    expect(signer.toLowerCase()).toBe(key.canonicalAddress.toLowerCase())
  })

  it("can sign twice — wiping the working copy doesn't damage the package", async () => {
    // signEvmIntent zeroes its decrypted secret in a `finally`. If that ever
    // reached through to the stored ciphertext, the second send of a session
    // would fail.
    const key = generateEvmKey()
    const dek = randomBytes(32)
    const packageValue = await buildPackage(key, dek)
    setUnlockedWalletState(USER, WALLET, dek, 60_000)

    const first = await signEvmIntent(USER, WALLET, packageValue, evmIntent({ nonce: 7 }, key.canonicalAddress), ACCOUNT)
    const second = await signEvmIntent(USER, WALLET, packageValue, evmIntent({ nonce: 8 }, key.canonicalAddress), ACCOUNT)
    expect(first).not.toBe(second)
    const signer = await recoverTransactionAddress({ serializedTransaction: second as TransactionSerializedEIP1559 })
    expect(signer.toLowerCase()).toBe(key.canonicalAddress.toLowerCase())
  })

  it("refuses to sign for an address that isn't this account", async () => {
    // Binds the signature to the intent the user reviewed. Without it, a
    // swapped `from` would be signed by whatever key happened to be unlocked.
    const key = generateEvmKey()
    const dek = randomBytes(32)
    const packageValue = await buildPackage(key, dek)
    setUnlockedWalletState(USER, WALLET, dek, 60_000)

    const intent = evmIntent({}, generateEvmKey().canonicalAddress)
    await expect(signEvmIntent(USER, WALLET, packageValue, intent, ACCOUNT)).rejects.toThrow(/does not match the intent account/)
  })
})

describe("signEvmIntent — fail-closed guards", () => {
  /* These are the guards the security audit leans on: the frontend signs only
     a COMPLETE backend transaction and never fills in a blank itself. Each
     case is a field whose absence would otherwise let a transaction be signed
     with a guessed value. */

  async function unlockedPackage() {
    const key = generateEvmKey()
    const dek = randomBytes(32)
    const packageValue = await buildPackage(key, dek)
    setUnlockedWalletState(USER, WALLET, dek, 60_000)
    return { key, packageValue }
  }

  it.each([
    ["nonce", { nonce: undefined }],
    ["gas", { gas: undefined }],
    ["chainId", { chainId: undefined }],
    ["value", { value: undefined }],
    ["to", { to: undefined }],
    ["type", { type: undefined }],
  ])("refuses when %s is missing", async (_field, patch) => {
    const { key, packageValue } = await unlockedPackage()
    const intent = evmIntent(patch, key.canonicalAddress)
    await expect(signEvmIntent(USER, WALLET, packageValue, intent, ACCOUNT)).rejects.toThrow(/stopped for safety/)
  })

  it("refuses an EIP-1559 request with no fee fields", async () => {
    const { key, packageValue } = await unlockedPackage()
    const intent = evmIntent({ maxFeePerGas: undefined, maxPriorityFeePerGas: undefined }, key.canonicalAddress)
    await expect(signEvmIntent(USER, WALLET, packageValue, intent, ACCOUNT)).rejects.toThrow(/EIP-1559 fee fields/)
  })

  it("refuses a legacy request with no gas price", async () => {
    const { key, packageValue } = await unlockedPackage()
    const intent = evmIntent(
      { type: "legacy", maxFeePerGas: undefined, maxPriorityFeePerGas: undefined, gasPrice: undefined },
      key.canonicalAddress,
    )
    await expect(signEvmIntent(USER, WALLET, packageValue, intent, ACCOUNT)).rejects.toThrow(/legacy gas price/)
  })

  it("refuses an intent that isn't an EVM transaction", async () => {
    const { packageValue } = await unlockedPackage()
    const intent = { unsignedTransaction: { family: "solana", from: "x", payload: {} } } as unknown as CryptoTransactionIntent
    await expect(signEvmIntent(USER, WALLET, packageValue, intent, ACCOUNT)).rejects.toThrow(/does not contain an EVM transaction/)
  })

  it("checks the fields before it ever decrypts the key", async () => {
    // Order matters: a malformed intent must be rejected while the wallet is
    // still locked, so a bad payload can't be used to provoke a decryption.
    const key = generateEvmKey()
    const packageValue = await buildPackage(key, randomBytes(32))
    const intent = evmIntent({ nonce: undefined }, key.canonicalAddress)
    await expect(signEvmIntent(USER, WALLET, packageValue, intent, ACCOUNT)).rejects.toThrow(/stopped for safety/)
  })
})

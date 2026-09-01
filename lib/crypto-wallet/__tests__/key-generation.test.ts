import { describe, expect, it } from "vitest"
import { privateKeyToAccount } from "viem/accounts"
import nacl from "tweetnacl"

import {
  generateAccountKey,
  generateEvmKey,
  generateLocalEd25519Key,
  generateSolanaKey,
  generateSuiKey,
  generateTonKey,
  generateTronKey,
  signEd25519Message,
} from "../key-generation"
import { fromBase64Url, utf8 } from "../encoding"

/**
 * Key generation — the step that decides whether a wallet is the user's.
 *
 * The properties worth holding: every family produces a usable address, the
 * secret genuinely corresponds to the address it claims, and no two wallets
 * come out the same. A generator that quietly returned a constant would pass
 * a "is it a string" check and lose everyone's money.
 */

const FAMILIES = ["evm", "solana", "sui", "ton", "tron"] as const

describe("generateAccountKey", () => {
  it.each(FAMILIES)("produces a complete %s key", (family) => {
    const key = generateAccountKey(family)
    expect(key.family).toBe(family)
    expect(key.keyType).toBe("private-key")
    expect(key.canonicalAddress).toBeTruthy()
    expect(key.secretKey.byteLength).toBeGreaterThanOrEqual(32)
    // A key of all zeros means the generator silently failed.
    expect(key.secretKey.some((byte) => byte !== 0)).toBe(true)
  })

  it.each(FAMILIES)("never repeats a %s key or address", (family) => {
    const a = generateAccountKey(family)
    const b = generateAccountKey(family)
    expect(a.canonicalAddress).not.toBe(b.canonicalAddress)
    expect(Array.from(a.secretKey)).not.toEqual(Array.from(b.secretKey))
  })

  it("rejects an unknown family rather than inventing one", () => {
    expect(() => generateAccountKey("bitcoin")).toThrow(/Unsupported wallet family/)
  })
})

describe("per-family key shapes", () => {
  it("gives an EVM key whose secret really controls the address it reports", () => {
    // The load-bearing one: signing later re-derives the account from these
    // bytes and refuses if it doesn't match the intent's `from`.
    const key = generateEvmKey()
    const hex = `0x${Array.from(key.secretKey, (b) => b.toString(16).padStart(2, "0")).join("")}` as const
    expect(privateKeyToAccount(hex).address).toBe(key.canonicalAddress)
    expect(key.secretKey).toHaveLength(32)
    expect(key.algorithm).toBe("secp256k1")
    expect(key.canonicalAddress).toMatch(/^0x[0-9a-fA-F]{40}$/)
  })

  it("gives a Solana key as the 64-byte secret the SDK expects", () => {
    const key = generateSolanaKey()
    expect(key.secretKey).toHaveLength(64)
    expect(key.algorithm).toBe("ed25519")
    expect(key.canonicalAddress).toBe(key.publicKey)
  })

  it("gives a Sui key with a 32-byte seed and a 0x address", () => {
    const key = generateSuiKey()
    expect(key.secretKey).toHaveLength(32)
    expect(key.canonicalAddress).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it("gives a TON key with a 32-byte seed and a URL-safe address", () => {
    const key = generateTonKey()
    expect(key.secretKey).toHaveLength(32)
    // urlSafe: true — the address must survive being put in a link.
    expect(key.canonicalAddress).not.toMatch(/[+/]/)
    expect(fromBase64Url(key.publicKey as string)).toHaveLength(32)
  })

  it("gives a TRON key with a base58 address", () => {
    const key = generateTronKey()
    expect(key.secretKey).toHaveLength(32)
    expect(key.canonicalAddress).toMatch(/^T[1-9A-HJ-NP-Za-km-z]{33}$/)
    expect(key.algorithm).toBe("secp256k1")
  })
})

describe("local Ed25519 key (device and recovery proofs)", () => {
  it("produces a seed and the matching public key", () => {
    const key = generateLocalEd25519Key()
    expect(key.seed).toHaveLength(32)
    expect(key.publicKey).toHaveLength(32)
    expect(fromBase64Url(key.publicKeyBase64Url)).toEqual(key.publicKey)
  })

  it("signs a message verifiably under that public key", () => {
    // This proof is what the backend checks during recovery, so a signature
    // that doesn't verify would lock people out of their own wallets.
    const key = generateLocalEd25519Key()
    const message = "challenge-from-the-service"
    const signature = fromBase64Url(signEd25519Message(key.seed, message))
    expect(nacl.sign.detached.verify(utf8(message), signature, key.publicKey)).toBe(true)
  })

  it("does not verify a signature against a different message", () => {
    const key = generateLocalEd25519Key()
    const signature = fromBase64Url(signEd25519Message(key.seed, "challenge-a"))
    expect(nacl.sign.detached.verify(utf8("challenge-b"), signature, key.publicKey)).toBe(false)
  })

  it("does not verify under another key's public key", () => {
    const key = generateLocalEd25519Key()
    const other = generateLocalEd25519Key()
    const signature = fromBase64Url(signEd25519Message(key.seed, "challenge"))
    expect(nacl.sign.detached.verify(utf8("challenge"), signature, other.publicKey)).toBe(false)
  })
})

import { beforeEach, describe, expect, it } from "vitest"
import {
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js"
import nacl from "tweetnacl"

import type { CryptoTransactionIntent, CryptoWalletPackageDocument } from "@/lib/crypto-backend"
import { encryptKeyMaterial } from "../package-crypto"
import { generateSolanaKey, type GeneratedWalletKey } from "../key-generation"
import { randomBytes } from "../encoding"
import { signSolanaIntent } from "../solana-signing"
import { clearUnlockedWalletState, setUnlockedWalletState } from "../unlock-state"

/**
 * Solana signs differently from EVM: the backend hands over a fully built
 * VersionedTransaction and the rule is to sign it as-is, never to rebuild it.
 * These tests hold that rule — including the fee-payer check, which is what
 * stops a transaction that spends someone else's account from being signed.
 */

const USER = "user_1"
const WALLET = "wallet_1"
const ACCOUNT = "acct_sol_1"
/** A valid 32-byte base58 value; nothing here touches a cluster. */
const BLOCKHASH = PublicKey.default.toBase58()

async function buildPackage(key: GeneratedWalletKey, dek: Uint8Array) {
  return {
    accounts: [
      {
        accountId: ACCOUNT,
        family: "solana",
        canonicalAddress: key.canonicalAddress,
        encryptedKeyMaterial: await encryptKeyMaterial(
          key.secretKey,
          `worldstreet:account:${WALLET}:${ACCOUNT}`,
          dek,
        ),
      },
    ],
  } as unknown as CryptoWalletPackageDocument
}

/** A real transfer, compiled the way the backend would compile one. */
function buildTransaction(payer: PublicKey) {
  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: BLOCKHASH,
    instructions: [
      SystemProgram.transfer({ fromPubkey: payer, toPubkey: Keypair.generate().publicKey, lamports: 1_000 }),
    ],
  }).compileToV0Message()
  return Buffer.from(new VersionedTransaction(message).serialize()).toString("base64")
}

function solanaIntent(serializedTransaction: string, from: string): CryptoTransactionIntent {
  return {
    accountId: ACCOUNT,
    chainFamily: "solana",
    unsignedTransaction: { family: "solana", from, payload: { serializedTransaction } },
  } as unknown as CryptoTransactionIntent
}

beforeEach(() => {
  clearUnlockedWalletState()
})

describe("signSolanaIntent", () => {
  it("returns a transaction carrying a signature that verifies under the wallet's key", async () => {
    const key = generateSolanaKey()
    const dek = randomBytes(32)
    const packageValue = await buildPackage(key, dek)
    setUnlockedWalletState(USER, WALLET, dek, 60_000)
    const payer = new PublicKey(key.canonicalAddress)

    const signed = await signSolanaIntent(
      USER,
      WALLET,
      packageValue,
      solanaIntent(buildTransaction(payer), key.canonicalAddress),
      ACCOUNT,
    )

    const transaction = VersionedTransaction.deserialize(Buffer.from(signed, "base64"))
    const signature = transaction.signatures[0]
    expect(signature.some((byte) => byte !== 0)).toBe(true)
    expect(nacl.sign.detached.verify(transaction.message.serialize(), signature, payer.toBytes())).toBe(true)
  })

  it("preserves the transaction it was given rather than rebuilding it", async () => {
    // The backend's compiled message is what was quoted and reviewed. Signing
    // must not alter it, or the user approves one transaction and sends another.
    const key = generateSolanaKey()
    const dek = randomBytes(32)
    const packageValue = await buildPackage(key, dek)
    setUnlockedWalletState(USER, WALLET, dek, 60_000)
    const payer = new PublicKey(key.canonicalAddress)
    const serialized = buildTransaction(payer)

    const signed = await signSolanaIntent(USER, WALLET, packageValue, solanaIntent(serialized, key.canonicalAddress), ACCOUNT)

    const before = VersionedTransaction.deserialize(Buffer.from(serialized, "base64")).message.serialize()
    const after = VersionedTransaction.deserialize(Buffer.from(signed, "base64")).message.serialize()
    expect(Buffer.from(after).equals(Buffer.from(before))).toBe(true)
  })

  it("refuses when the fee payer isn't this account", async () => {
    // A transaction built to spend a different account must never be signed
    // just because the intent's `from` says otherwise.
    const key = generateSolanaKey()
    const dek = randomBytes(32)
    const packageValue = await buildPackage(key, dek)
    setUnlockedWalletState(USER, WALLET, dek, 60_000)

    const someoneElse = Keypair.generate().publicKey
    const intent = solanaIntent(buildTransaction(someoneElse), key.canonicalAddress)
    await expect(signSolanaIntent(USER, WALLET, packageValue, intent, ACCOUNT)).rejects.toThrow(/fee payer does not match/)
  })

  it("refuses when the intent's account isn't the local key", async () => {
    const key = generateSolanaKey()
    const dek = randomBytes(32)
    const packageValue = await buildPackage(key, dek)
    setUnlockedWalletState(USER, WALLET, dek, 60_000)

    const other = generateSolanaKey()
    const intent = solanaIntent(buildTransaction(new PublicKey(other.canonicalAddress)), other.canonicalAddress)
    await expect(signSolanaIntent(USER, WALLET, packageValue, intent, ACCOUNT)).rejects.toThrow(/does not match the intent account/)
  })

  it("refuses an intent with no serialized transaction", async () => {
    const key = generateSolanaKey()
    const dek = randomBytes(32)
    const packageValue = await buildPackage(key, dek)
    setUnlockedWalletState(USER, WALLET, dek, 60_000)
    await expect(signSolanaIntent(USER, WALLET, packageValue, solanaIntent("", key.canonicalAddress), ACCOUNT))
      .rejects.toThrow(/does not contain a Solana transaction/)
  })

  it("refuses while the wallet is locked", async () => {
    const key = generateSolanaKey()
    const packageValue = await buildPackage(key, randomBytes(32))
    const intent = solanaIntent(buildTransaction(new PublicKey(key.canonicalAddress)), key.canonicalAddress)
    await expect(signSolanaIntent(USER, WALLET, packageValue, intent, ACCOUNT)).rejects.toThrow(/Unlock the wallet/)
  })
})

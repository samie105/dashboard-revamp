import { Keypair, PublicKey, VersionedTransaction } from "@solana/web3.js"

import type { CryptoTransactionIntent, CryptoWalletPackageDocument } from "@/lib/crypto-backend"
import { decryptLocalAccountKey } from "./account-secrets"
import { wipeBytes } from "./encoding"

function fromBase64(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function toBase64(bytes: Uint8Array) {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export async function signSolanaIntent(
  userId: string,
  walletId: string,
  packageValue: CryptoWalletPackageDocument,
  intent: CryptoTransactionIntent,
  accountId: string,
) {
  const unsigned = intent.unsignedTransaction
  const serialized = typeof unsigned?.payload.serializedTransaction === "string" ? unsigned.payload.serializedTransaction : ""
  if (!unsigned || unsigned.family !== "solana" || !serialized) throw new Error("This intent does not contain a Solana transaction")

  const secret = await decryptLocalAccountKey(userId, walletId, packageValue, accountId)
  try {
    const keypair = Keypair.fromSecretKey(secret)
    if (keypair.publicKey.toBase58() !== unsigned.from) throw new Error("Local key does not match the intent account")
    const transaction = VersionedTransaction.deserialize(fromBase64(serialized))
    const feePayer = transaction.message.staticAccountKeys[0]
    if (!feePayer || !feePayer.equals(new PublicKey(unsigned.from))) throw new Error("Solana fee payer does not match the intent account")
    transaction.sign([keypair])
    return toBase64(transaction.serialize())
  } finally {
    wipeBytes(secret)
  }
}

/** Signs only the user's authority on a sponsor-fee-payer transaction. */
export async function signSponsoredSolanaTransaction(
  userId: string,
  walletId: string,
  packageValue: CryptoWalletPackageDocument,
  signingPayload: Record<string, unknown>,
  accountId: string,
) {
  const serialized = typeof signingPayload.serializedTransaction === "string" ? signingPayload.serializedTransaction : ""
  const userAddress = typeof signingPayload.userAddress === "string" ? signingPayload.userAddress : ""
  const sponsorAddress = typeof signingPayload.sponsorAddress === "string" ? signingPayload.sponsorAddress : ""
  if (signingPayload.kind !== "solana-transaction" || !serialized || !userAddress || !sponsorAddress) {
    throw new Error("The sponsorship provider returned an incomplete Solana signing payload")
  }

  const secret = await decryptLocalAccountKey(userId, walletId, packageValue, accountId)
  try {
    const keypair = Keypair.fromSecretKey(secret)
    if (keypair.publicKey.toBase58() !== userAddress) throw new Error("Local key does not match the sponsored Solana signer")
    const transaction = VersionedTransaction.deserialize(fromBase64(serialized))
    const feePayer = transaction.message.staticAccountKeys[0]
    if (!feePayer || feePayer.toBase58() !== sponsorAddress) throw new Error("Sponsored Solana transaction fee payer does not match the provider payload")
    const requiredSigners = transaction.message.staticAccountKeys.slice(0, transaction.message.header.numRequiredSignatures)
    if (!requiredSigners.some((signer) => signer.equals(keypair.publicKey))) throw new Error("Sponsored Solana transaction does not require this wallet signer")
    transaction.sign([keypair])
    const bytes = transaction.serialize()
    return { kind: signingPayload.kind, userAddress, sponsorAddress, serializedTransaction: toBase64(bytes) }
  } finally {
    wipeBytes(secret)
  }
}

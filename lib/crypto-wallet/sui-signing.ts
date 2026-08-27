import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519"
import { Buffer } from "buffer"

import type { CryptoTransactionIntent, CryptoWalletPackageDocument } from "@/lib/crypto-backend"
import { decryptLocalAccountKey } from "./account-secrets"
import { wipeBytes } from "./encoding"

export async function signSuiIntent(
  userId: string,
  walletId: string,
  packageValue: CryptoWalletPackageDocument,
  intent: CryptoTransactionIntent,
  accountId: string,
) {
  const unsigned = intent.unsignedTransaction
  const transactionBytes = typeof unsigned?.payload.transactionBytes === "string" ? unsigned.payload.transactionBytes : ""
  if (!unsigned || unsigned.family !== "sui" || !transactionBytes) throw new Error("This intent does not contain a Sui transaction")

  const secret = await decryptLocalAccountKey(userId, walletId, packageValue, accountId)
  try {
    const keypair = Ed25519Keypair.fromSecretKey(secret)
    if (keypair.toSuiAddress() !== unsigned.from) throw new Error("Local key does not match the intent account")
    const signed = await keypair.signTransaction(Buffer.from(transactionBytes, "base64"))
    return JSON.stringify({ transactionBytes: signed.bytes, signatures: [signed.signature] })
  } finally {
    wipeBytes(secret)
  }
}

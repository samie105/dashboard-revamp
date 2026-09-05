import * as btc from "@scure/btc-signer"
import { hex } from "@scure/base"
import { secp256k1 } from "@noble/curves/secp256k1.js"
import type { CryptoTransactionIntent, CryptoWalletPackageDocument } from "@/lib/crypto-backend"
import { decryptLocalAccountKey } from "./account-secrets"
import { wipeBytes } from "./encoding"

export async function signBitcoinIntent(userId: string, walletId: string, packageValue: CryptoWalletPackageDocument, intent: CryptoTransactionIntent, accountId: string) {
  const unsigned = intent.unsignedTransaction
  const psbt = typeof unsigned?.payload.psbt === "string" ? unsigned.payload.psbt : ""
  if (!unsigned || unsigned.family !== "bitcoin" || !psbt) throw new Error("This intent does not contain a Bitcoin PSBT")
  const secret = await decryptLocalAccountKey(userId, walletId, packageValue, accountId)
  try {
    const address = btc.p2wpkh(secp256k1.getPublicKey(secret, true), btc.NETWORK).address
    if (address !== unsigned.from) throw new Error("Local key does not match the Bitcoin intent account")
    const transaction = btc.Transaction.fromPSBT(Buffer.from(psbt, "base64"))
    transaction.sign(secret)
    transaction.finalize()
    return hex.encode(transaction.extract())
  } finally { wipeBytes(secret) }
}

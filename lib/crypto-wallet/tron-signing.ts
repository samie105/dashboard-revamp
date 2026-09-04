import { TronWeb } from "tronweb"

import type { CryptoTransactionIntent, CryptoWalletPackageDocument } from "@/lib/crypto-backend"
import { decryptLocalAccountKey } from "./account-secrets"
import { wipeBytes } from "./encoding"

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")
}

export async function signTronIntent(
  userId: string,
  walletId: string,
  packageValue: CryptoWalletPackageDocument,
  intent: CryptoTransactionIntent,
  accountId: string,
) {
  const unsigned = intent.unsignedTransaction
  const transaction = unsigned?.payload.transaction
  if (!unsigned || unsigned.family !== "tron" || !transaction || typeof transaction !== "object") throw new Error("This intent does not contain a TRON transaction")

  const secret = await decryptLocalAccountKey(userId, walletId, packageValue, accountId)
  try {
    const privateKey = bytesToHex(secret)
    const derived = TronWeb.address.fromPrivateKey(privateKey)
    if (!derived || derived !== unsigned.from) throw new Error("Local key does not match the intent account")
    // LI.FI returns a mainnet transaction. Signing is local, but using the
    // mainnet provider keeps TronWeb's address/transaction handling aligned
    // with the network being signed.
    const tron = new TronWeb({ fullHost: "https://api.trongrid.io" })
    const signed = await tron.trx.sign(transaction as never, privateKey)
    return JSON.stringify(signed)
  } finally {
    wipeBytes(secret)
  }
}

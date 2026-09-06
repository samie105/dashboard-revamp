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
    const transaction = btc.Transaction.fromPSBT(Buffer.from(psbt, "base64"), {
      strictPrevoutValidation: true,
      allowUnknownOutputs: false,
    })
    const reviewedUnsigned = new Uint8Array(transaction.unsignedTx)
    const ownerScript = btc.p2wpkh(secp256k1.getPublicKey(secret, true), btc.NETWORK).script
    for (let index = 0; index < transaction.inputsLength; index++) {
      const input = transaction.getInput(index)
      if (!input.witnessUtxo || input.witnessUtxo.script.length !== ownerScript.length || !input.witnessUtxo.script.every((value, offset) => value === ownerScript[offset])) {
        throw new Error(`Bitcoin intent input ${index} is not owned by the wallet account`)
      }
      if (input.sighashType !== undefined && input.sighashType !== 0 && input.sighashType !== 1) throw new Error(`Bitcoin intent input ${index} uses an unsupported sighash mode`)
    }
    transaction.sign(secret, [btc.SigHash.DEFAULT])
    transaction.finalize()
    if (!reviewedUnsigned.every((value, index) => value === transaction.unsignedTx[index]) || reviewedUnsigned.length !== transaction.unsignedTx.length) throw new Error("Bitcoin transaction changed while signing")
    return hex.encode(transaction.extract())
  } finally { wipeBytes(secret) }
}

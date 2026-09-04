import { Address, Cell, SendMode, beginCell, domainSign, external, internal, storeMessage } from "@ton/core"
import { keyPairFromSeed } from "@ton/crypto"
import { WalletContractV4 } from "@ton/ton"
import { Buffer } from "buffer"

import type { CryptoTransactionIntent, CryptoWalletPackageDocument } from "@/lib/crypto-backend"
import { decryptLocalAccountKey } from "./account-secrets"
import { fromBase64Url, wipeBytes } from "./encoding"

export async function signTonIntent(
  userId: string,
  walletId: string,
  packageValue: CryptoWalletPackageDocument,
  intent: CryptoTransactionIntent,
  accountId: string,
) {
  const unsigned = intent.unsignedTransaction
  const payload = unsigned?.payload
  if (!unsigned || unsigned.family !== "ton" || !payload || !["ton-native-transfer", "omniston-ton-swap"].includes(String(payload.kind))) throw new Error("This intent does not contain a TON transaction")

  const secret = await decryptLocalAccountKey(userId, walletId, packageValue, accountId)
  try {
    const keypair = keyPairFromSeed(Buffer.from(secret))
    const wallet = WalletContractV4.create({ workchain: 0, publicKey: keypair.publicKey, walletId: Number(payload.walletId) })
    if (wallet.address.toString({ bounceable: true, testOnly: String(unsigned.networkId).includes("testnet") }) !== String(unsigned.from)) throw new Error("Local key does not match the intent account")
    const messages = payload.kind === "omniston-ton-swap"
      ? (Array.isArray(payload.messages) ? payload.messages : []).map((message) => {
          if (!message || typeof message !== "object") throw new Error("Omniston returned an invalid TON message")
          const item = message as Record<string, unknown>
          const payloadHex = String(item.payload ?? "")
          const body = Cell.fromBoc(Buffer.from(payloadHex, "hex"))[0]
          if (!body) throw new Error("Omniston returned an empty TON message body")
          return internal({ to: Address.parse(String(item.targetAddress)), value: BigInt(String(item.sendAmount)), body, bounce: true })
        })
      : [internal({ to: Address.parse(String(payload.recipient)), value: BigInt(String(payload.amountNano)), bounce: true })]
    if (messages.length === 0) throw new Error("Omniston returned no TON messages")
    const body = await wallet.createTransfer({
      seqno: Number(payload.seqno),
      timeout: Number(payload.timeout),
      messages,
      sendMode: Number(payload.sendMode) as SendMode,
      signer: async (message) => domainSign({ data: message.hash(), secretKey: keypair.secretKey }),
    })
    return Buffer.from(beginCell().store(storeMessage(external({ to: wallet.address, body }))).endCell().toBoc({ idx: false })).toString("base64")
  } finally {
    wipeBytes(secret)
  }
}

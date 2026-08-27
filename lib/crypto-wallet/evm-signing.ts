import { privateKeyToAccount } from "viem/accounts"
import type { Hex } from "viem"

import type { CryptoTransactionIntent, CryptoWalletPackageDocument } from "@/lib/crypto-backend"
import { decryptLocalAccountKey } from "./account-secrets"
import { wipeBytes } from "./encoding"

function bytesToHex(bytes: Uint8Array): Hex {
  return `0x${Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")}` as Hex
}

function transactionField(payload: Record<string, unknown>, name: string) {
  const value = payload[name]
  return typeof value === "string" || typeof value === "number" || typeof value === "bigint" ? value : undefined
}

function bigintField(payload: Record<string, unknown>, name: string) {
  const value = transactionField(payload, name)
  return value === undefined ? undefined : BigInt(String(value))
}

/** Signs only the complete transaction request returned by the backend. */
export async function signEvmIntent(
  userId: string,
  walletId: string,
  packageValue: CryptoWalletPackageDocument,
  intent: CryptoTransactionIntent,
  accountId: string,
) {
  const unsigned = intent.unsignedTransaction
  if (!unsigned || unsigned.family !== "evm") throw new Error("This intent does not contain an EVM transaction")
  const payload = unsigned.payload
  const required = ["chainId", "to", "value", "nonce", "gas", "type"]
  if (required.some((field) => payload[field] === undefined)) {
    throw new Error("The backend intent is missing complete EVM nonce/fee fields; signing was stopped for safety")
  }
  if (payload.type === "eip1559" && (payload.maxFeePerGas === undefined || payload.maxPriorityFeePerGas === undefined)) {
    throw new Error("The EVM intent is missing EIP-1559 fee fields; signing was stopped for safety")
  }
  if (payload.type === "legacy" && payload.gasPrice === undefined) {
    throw new Error("The EVM intent is missing the legacy gas price; signing was stopped for safety")
  }

  const secret = await decryptLocalAccountKey(userId, walletId, packageValue, accountId)
  try {
    const account = privateKeyToAccount(bytesToHex(secret))
    if (account.address.toLowerCase() !== unsigned.from.toLowerCase()) throw new Error("Local key does not match the intent account")
    const transaction = {
      chainId: Number(payload.chainId),
      to: String(payload.to) as Hex,
      value: BigInt(String(payload.value)),
      data: typeof payload.data === "string" ? payload.data as Hex : undefined,
      nonce: Number(transactionField(payload, "nonce")),
      gas: bigintField(payload, "gas") ?? bigintField(payload, "gasLimit"),
      gasPrice: bigintField(payload, "gasPrice"),
      maxFeePerGas: bigintField(payload, "maxFeePerGas"),
      maxPriorityFeePerGas: bigintField(payload, "maxPriorityFeePerGas"),
      type: typeof payload.type === "string" ? payload.type as "legacy" | "eip2930" | "eip1559" : undefined,
    }
    return account.signTransaction(transaction as never)
  } finally {
    wipeBytes(secret)
  }
}

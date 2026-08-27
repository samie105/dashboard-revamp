import { privateKeyToAccount, serializeSignature } from "viem/accounts"
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

/**
 * Signs an Alchemy Wallet APIs prepared call.
 *
 * The first sponsored operation for an EOA can contain both an EIP-7702
 * delegation authorization and a user-operation request. Later operations
 * contain only the user-operation request. Both are signed locally from the
 * decrypted modern-wallet key; no private key leaves the browser.
 */
export async function signSponsoredEvmOperation(
  userId: string,
  walletId: string,
  packageValue: CryptoWalletPackageDocument,
  signingPayload: Record<string, unknown>,
  accountId: string,
) {
  const kind = signingPayload.kind
  const signerAddress = typeof signingPayload.signerAddress === "string" ? signingPayload.signerAddress : ""
  const preparedCalls = signingPayload.preparedCalls
  if (kind !== "evm-prepared-calls" || !signerAddress || !preparedCalls || typeof preparedCalls !== "object") {
    throw new Error("Alchemy returned an incomplete EVM prepared-calls payload")
  }

  const secret = await decryptLocalAccountKey(userId, walletId, packageValue, accountId)
  try {
    const account = privateKeyToAccount(bytesToHex(secret))
    if (account.address.toLowerCase() !== signerAddress.toLowerCase()) throw new Error("Local key does not match the sponsored operation signer")
    const prepared = preparedCalls as Record<string, unknown>
    const rawItems = prepared.type === "array" ? prepared.data : [prepared]
    if (!Array.isArray(rawItems) || rawItems.length === 0) throw new Error("Alchemy returned no EVM signature requests")

    const signedItems: Record<string, unknown>[] = []
    for (const rawItem of rawItems) {
      if (!rawItem || typeof rawItem !== "object") throw new Error("Alchemy returned an invalid EVM signature request")
      const item = { ...(rawItem as Record<string, unknown>) }
      const signatureRequest = item.signatureRequest
      if (!signatureRequest || typeof signatureRequest !== "object") throw new Error("Alchemy returned an EVM request without a signature prompt")
      const request = signatureRequest as Record<string, unknown>
      let signature: string

      if (request.type === "eth_signAuthorization") {
        const authData = item.data
        if (!authData || typeof authData !== "object") throw new Error("Alchemy returned an invalid EIP-7702 authorization")
        const auth = authData as Record<string, unknown>
        if (typeof auth.address !== "string" || auth.chainId === undefined || auth.nonce === undefined) {
          throw new Error("Alchemy returned an incomplete EIP-7702 authorization")
        }
        const signedAuthorization = await account.signAuthorization({
          address: auth.address as `0x${string}`,
          chainId: Number(auth.chainId),
          nonce: Number(auth.nonce),
        })
        signature = serializeSignature(signedAuthorization)
      } else if (request.type === "personal_sign") {
        const requestData = request.data
        const rawValue = requestData && typeof requestData === "object" ? (requestData as Record<string, unknown>).raw : undefined
        const raw = typeof rawValue === "string" && rawValue.startsWith("0x")
          ? rawValue
          : typeof request.rawPayload === "string" ? request.rawPayload : undefined
        if (!raw || !raw.startsWith("0x")) throw new Error("Alchemy returned an incomplete personal-sign request")
        signature = await account.signMessage({ message: { raw: raw as Hex } })
      } else {
        throw new Error(`Alchemy returned unsupported EVM signature request: ${String(request.type)}`)
      }

      delete item.signatureRequest
      item.signature = { type: "secp256k1", data: signature }
      signedItems.push(item)
    }

    const signedPreparedCalls = prepared.type === "array"
      ? { ...prepared, data: signedItems }
      : signedItems[0]
    return {
      kind,
      signerAddress: account.address,
      preparedCalls,
      signedPreparedCalls,
    }
  } finally {
    wipeBytes(secret)
  }
}

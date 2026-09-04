import { bech32m } from "@scure/base"
import nacl from "tweetnacl"

import type { CryptoTransactionIntent, CryptoWalletPackageDocument } from "@/lib/crypto-backend"
import { decryptLocalAccountKey } from "./account-secrets"
import { fromBase64Url, toBase64Url, utf8, wipeBytes } from "./encoding"

const PROTOCOL_CHAIN_ID = "intertrain-1"

/** Signs the canonical Intertrain native-transfer payload produced by the
 * backend. The backend re-validates the complete unsigned payload and the
 * Ed25519 signature before broadcasting it. */
export async function signIntertrainIntent(
  userId: string,
  walletId: string,
  packageValue: CryptoWalletPackageDocument,
  intent: CryptoTransactionIntent,
  accountId: string,
) {
  const unsigned = intent.unsignedTransaction
  const payload = unsigned?.payload
  if (!unsigned || unsigned.family !== "intertrain" || payload?.kind !== "intertrain-native-transfer") {
    throw new Error("This intent does not contain an Intertrain transaction")
  }
  if (payload.chainId !== PROTOCOL_CHAIN_ID) throw new Error("This is not an Intertrain mainnet transaction")

  const secret = await decryptLocalAccountKey(userId, walletId, packageValue, accountId)
  try {
    const keypair = nacl.sign.keyPair.fromSeed(secret)
    const expectedPublicKey = toBase64Url(keypair.publicKey)
    if (expectedPublicKey !== String(payload.publicKey)) throw new Error("Local key does not match the intent account")
    validateAddress(String(payload.recipient))
    // Older intents omitted `payload.from` even though the canonical sender
    // lives on the unsigned transaction envelope. Accept both during the
    // rollout; new backend intents include the field for schema parity.
    const sender = String(payload.from ?? unsigned.from)
    if (sender !== String(unsigned.from)) throw new Error("Intertrain sender does not match the reviewed intent")
    const signingPayload = { ...payload, from: sender }
    if (String(payload.recipient) !== String(unsigned.to)) throw new Error("Intertrain recipient does not match the intent")
    const signature = nacl.sign.detached(signingBytes(signingPayload), keypair.secretKey)
    return JSON.stringify({ unsigned: payload, signature: toHex(signature) })
  } finally {
    wipeBytes(secret)
  }
}

function signingBytes(payload: Record<string, unknown>): Uint8Array {
  const out: number[] = [Number(payload.version)]
  out.push(...lengthPrefixed(String(payload.chainId)))
  out.push(...varint(Number(payload.nonce)))
  out.push(...decodeAddress(String(payload.from), "sender"))
  out.push(...decodeAddress(String(payload.recipient), "recipient"))
  out.push(...varint(BigInt(String(payload.amount))))
  out.push(...varint(BigInt(String(payload.fee))))
  out.push(...fromBase64Url(String(payload.publicKey)))
  out.push(...lengthPrefixed(String(payload.memo ?? "")))
  return new Uint8Array(out)
}

function decodeAddress(value: string, label: string): number[] {
  try {
    const decoded = bech32m.decode(value as `${string}1${string}`, 90)
    const bytes = bech32m.fromWords(decoded.words)
    if (decoded.prefix !== "mna" || bytes.length !== 21 || bytes[0] !== 1) throw new Error()
    return [...bytes.slice(1)]
  } catch {
    throw new Error(`Invalid Intertrain ${label} address`)
  }
}

function validateAddress(value: string) { decodeAddress(value, "recipient") }

function varint(value: number | bigint): number[] {
  let current = BigInt(value)
  if (current < BigInt(0)) throw new Error("Invalid negative Intertrain integer")
  const out: number[] = []
  while (current >= BigInt(0x80)) { out.push(Number((current & BigInt(0x7f)) | BigInt(0x80))); current >>= BigInt(7) }
  out.push(Number(current))
  return out
}

function lengthPrefixed(value: string): number[] {
  const bytes = utf8(value)
  return [...varint(bytes.length), ...bytes]
}

function toHex(value: Uint8Array): string {
  return [...value].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

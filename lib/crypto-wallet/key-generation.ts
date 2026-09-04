import { privateKeyToAccount, generatePrivateKey } from "viem/accounts"
import { Keypair } from "@solana/web3.js"
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519"
import { keyPairFromSeed } from "@ton/crypto"
import { WalletContractV4 } from "@ton/ton"
import TronWeb from "tronweb"
import { Buffer } from "buffer"
import nacl from "tweetnacl"
import { sha256 } from "@noble/hashes/sha2"
import { bech32m } from "@scure/base"

import { fromBase64Url, randomBytes, toBase64Url, utf8 } from "./encoding"

export type GeneratedWalletKey = {
  family: "evm" | "solana" | "sui" | "ton" | "tron" | "intertrain"
  algorithm: "secp256k1" | "ed25519"
  keyType: "private-key"
  secretKey: Uint8Array
  publicKey?: string
  canonicalAddress: string
}

export function generateEvmKey(): GeneratedWalletKey {
  const privateKey = generatePrivateKey()
  const account = privateKeyToAccount(privateKey)
  return {
    family: "evm",
    algorithm: "secp256k1",
    keyType: "private-key",
    secretKey: fromBase64Url(toBase64Url(hexToBytes(privateKey.slice(2)))),
    publicKey: account.address,
    canonicalAddress: account.address,
  }
}

export function generateSolanaKey(): GeneratedWalletKey {
  const keypair = Keypair.generate()
  return {
    family: "solana",
    algorithm: "ed25519",
    keyType: "private-key",
    secretKey: new Uint8Array(keypair.secretKey),
    publicKey: keypair.publicKey.toBase58(),
    canonicalAddress: keypair.publicKey.toBase58(),
  }
}

export function generateSuiKey(): GeneratedWalletKey {
  const secretKey = randomBytes(32)
  const keypair = Ed25519Keypair.fromSecretKey(secretKey)
  const publicKey = keypair.getPublicKey().toRawBytes()
  return {
    family: "sui",
    algorithm: "ed25519",
    keyType: "private-key",
    secretKey,
    publicKey: toBase64Url(publicKey),
    canonicalAddress: keypair.toSuiAddress(),
  }
}

export function generateTonKey(): GeneratedWalletKey {
  const secretKey = randomBytes(32)
  const keypair = keyPairFromSeed(Buffer.from(secretKey))
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keypair.publicKey })
  return {
    family: "ton",
    algorithm: "ed25519",
    keyType: "private-key",
    secretKey,
    publicKey: toBase64Url(new Uint8Array(keypair.publicKey)),
    canonicalAddress: wallet.address.toString({ urlSafe: true, bounceable: false }),
  }
}

export function generateTronKey(): GeneratedWalletKey {
  const generated = TronWeb.utils.accounts.generateAccount()
  if (!generated || !generated.address.base58) throw new Error("TRON account generation failed")
  const secretKey = hexToBytes(generated.privateKey)
  return {
    family: "tron",
    algorithm: "secp256k1",
    keyType: "private-key",
    secretKey,
    publicKey: generated.publicKey,
    canonicalAddress: generated.address.base58,
  }
}

/** Intertrain mainnet uses an ed25519 account encoded as a bech32m `mna1...`
 * address. Keep the protocol domain and version byte aligned with the chain;
 * WSK is the asset name, not a replacement for the address namespace. */
export function generateIntertrainKey(): GeneratedWalletKey {
  const secretKey = randomBytes(32)
  const keypair = nacl.sign.keyPair.fromSeed(secretKey)
  const domain = utf8("MNA/address/v1")
  const digestInput = new Uint8Array(domain.length + keypair.publicKey.length)
  digestInput.set(domain)
  digestInput.set(keypair.publicKey, domain.length)
  const addressBytes = new Uint8Array([1, ...sha256(digestInput).slice(0, 20)])
  const canonicalAddress = bech32m.encode("mna", bech32m.toWords(addressBytes), 90)
  return {
    family: "intertrain",
    algorithm: "ed25519",
    keyType: "private-key",
    secretKey,
    publicKey: toBase64Url(keypair.publicKey),
    canonicalAddress,
  }
}

export function generateAccountKey(family: string): GeneratedWalletKey {
  if (family === "evm") return generateEvmKey()
  if (family === "solana") return generateSolanaKey()
  if (family === "sui") return generateSuiKey()
  if (family === "ton") return generateTonKey()
  if (family === "tron") return generateTronKey()
  if (family === "intertrain") return generateIntertrainKey()
  throw new Error(`Unsupported wallet family: ${family}`)
}

export type LocalEd25519Key = {
  seed: Uint8Array
  publicKey: Uint8Array
  publicKeyBase64Url: string
}

export function generateLocalEd25519Key(): LocalEd25519Key {
  const seed = randomBytes(32)
  const keypair = nacl.sign.keyPair.fromSeed(seed)
  return {
    seed,
    publicKey: keypair.publicKey,
    publicKeyBase64Url: toBase64Url(keypair.publicKey),
  }
}

export function signEd25519Message(seed: Uint8Array, message: string): string {
  const keypair = nacl.sign.keyPair.fromSeed(seed)
  return toBase64Url(nacl.sign.detached(utf8(message), keypair.secretKey))
}

function hexToBytes(value: string): Uint8Array {
  const output = new Uint8Array(value.length / 2)
  for (let index = 0; index < output.length; index += 1) {
    output[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16)
  }
  return output
}

import { privateKeyToAccount } from "viem/accounts"
import { signL1Action, type Signature } from "@nktkas/hyperliquid/signing"

import type { HyperliquidIntent, HyperliquidTradingAgent, CryptoWalletPackageDocument } from "@/lib/crypto-backend"
import { cryptoBackendClient } from "@/lib/crypto-backend"
import { decryptKeyMaterial, encryptKeyMaterial } from "./package-crypto"
import { generateEvmKey } from "./key-generation"
import { getUnlockedWalletState } from "./unlock-state"
import { signHyperliquidIntent } from "./hyperliquid-signing"
import { wipeBytes } from "./encoding"

function bytesToHex(bytes: Uint8Array): `0x${string}` { return `0x${Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")}` }

/** Creates a separate agent key, stores only its DEK-encrypted ciphertext,
 * then prepares the master-wallet approval intent for Hyperliquid. */
export async function prepareHyperliquidAgent(userId: string, walletId: string, packageValue: CryptoWalletPackageDocument, walletAuthorizationToken: string, options: { agentName?: string; markets?: string[]; maxOrderUsd?: string; maxDailyNotionalUsd?: string; maxLeverage?: number } = {}) {
  const state = getUnlockedWalletState(userId, walletId)
  if (!state) throw new Error("Unlock the wallet before creating a trading agent")
  const key = generateEvmKey()
  try {
    const encryptedKeyMaterial = await encryptKeyMaterial(key.secretKey, `worldstreet:hyperliquid-agent:${walletId}:${key.canonicalAddress}`, new Uint8Array(state.dek))
    const agent = await cryptoBackendClient.registerHyperliquidAgent({
      agentAddress: key.canonicalAddress,
      agentName: options.agentName ?? "Worldstreet trading",
      encryptedKeyMaterial,
      permissions: { network: "mainnet", markets: options.markets ?? [], maxOrderUsd: options.maxOrderUsd, maxDailyNotionalUsd: options.maxDailyNotionalUsd, maxLeverage: options.maxLeverage },
    }, walletAuthorizationToken)
    const approval = await cryptoBackendClient.createHyperliquidIntent({ type: "approveAgent", agentAddress: key.canonicalAddress, agentName: options.agentName ?? "Worldstreet trading", idempotencyKey: crypto.randomUUID() })
    return { agent, approval }
  } finally { wipeBytes(key.secretKey) }
}

export async function signHyperliquidAgentIntentWithWallet(userId: string, walletId: string, agent: HyperliquidTradingAgent, steps: Array<{ action: Record<string, unknown>; nonce: number; expiresAfter?: number }>): Promise<Signature[]> {
  const state = getUnlockedWalletState(userId, walletId)
  if (!state) throw new Error("Unlock the wallet before trading")
  const secret = await decryptKeyMaterial(agent.encryptedKeyMaterial, new Uint8Array(state.dek))
  try {
    const wallet = privateKeyToAccount(bytesToHex(secret))
    return Promise.all(steps.map((step) => signL1Action({ wallet, action: step.action, nonce: step.nonce, isTestnet: false, ...(step.expiresAfter === undefined ? {} : { expiresAfter: step.expiresAfter }) })))
  } finally { wipeBytes(secret) }
}

export async function approvePreparedHyperliquidAgent(userId: string, walletId: string, packageValue: CryptoWalletPackageDocument, accountId: string, approval: HyperliquidIntent) {
  const signatures = await signHyperliquidIntent(userId, walletId, packageValue, accountId, approval.steps)
  return cryptoBackendClient.submitHyperliquidIntent(approval.id, signatures)
}

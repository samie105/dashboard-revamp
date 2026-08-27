import { privateKeyToAccount } from "viem/accounts"
import { signL1Action, signUserSignedAction, type Signature } from "@nktkas/hyperliquid/signing"

import type { CryptoWalletPackageDocument } from "@/lib/crypto-backend"
import { decryptLocalAccountKey } from "./account-secrets"
import { wipeBytes } from "./encoding"

function bytesToHex(bytes: Uint8Array): `0x${string}` {
  return `0x${Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")}`
}

/** Sign the exact action(s) prepared by the crypto backend. */
export async function signHyperliquidIntent(
  userId: string,
  walletId: string,
  packageValue: CryptoWalletPackageDocument,
  accountId: string,
  steps: Array<{ action: Record<string, unknown>; nonce: number; expiresAfter?: number; signingMode?: "l1" | "user"; types?: Record<string, Array<{ name: string; type: string }>> }>,
): Promise<Signature[]> {
  const secret = await decryptLocalAccountKey(userId, walletId, packageValue, accountId)
  try {
    const wallet = privateKeyToAccount(bytesToHex(secret))
    return Promise.all(steps.map((step) => {
      if (step.signingMode === "user") {
        if (!step.types) throw new Error("The backend did not provide the Hyperliquid typed-data schema")
        return signUserSignedAction({ wallet, action: step.action as { signatureChainId: `0x${string}`; [key: string]: unknown }, types: step.types })
      }
      return signL1Action({
        wallet,
        action: step.action,
        nonce: step.nonce,
        isTestnet: false,
        ...(step.expiresAfter === undefined ? {} : { expiresAfter: step.expiresAfter }),
      })
    }))
  } finally {
    wipeBytes(secret)
  }
}

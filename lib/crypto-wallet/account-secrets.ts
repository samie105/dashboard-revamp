import type { CryptoWalletPackageDocument } from "@/lib/crypto-backend"

import { decryptKeyMaterial } from "./package-crypto"
import { getUnlockedWalletState } from "./unlock-state"

type PackagedAccount = {
  accountId?: string
  encryptedKeyMaterial?: { ciphertext: string; iv: string; aad: string }
}

export async function decryptLocalAccountKey(
  userId: string,
  walletId: string,
  packageValue: CryptoWalletPackageDocument,
  accountId: string,
) {
  const state = getUnlockedWalletState(userId, walletId)
  if (!state) throw new Error("Unlock the wallet before signing")
  const account = (packageValue.accounts as PackagedAccount[]).find((candidate) => candidate.accountId === accountId)
  if (!account?.encryptedKeyMaterial) throw new Error("Encrypted key material is missing for this account")
  return decryptKeyMaterial(account.encryptedKeyMaterial, new Uint8Array(state.dek))
}

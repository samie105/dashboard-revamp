type UnlockedWalletState = {
  userId: string
  walletId: string
  dek: Uint8Array
  expiresAt: number
}

let unlockedState: UnlockedWalletState | undefined

export function setUnlockedWalletState(userId: string, walletId: string, dek: Uint8Array, ttlMs: number) {
  clearUnlockedWalletState()
  unlockedState = { userId, walletId, dek: new Uint8Array(dek), expiresAt: Date.now() + ttlMs }
}

export function getUnlockedWalletState(userId: string, walletId: string) {
  if (!unlockedState || unlockedState.userId !== userId || unlockedState.walletId !== walletId) return undefined
  if (unlockedState.expiresAt <= Date.now()) {
    clearUnlockedWalletState()
    return undefined
  }
  return unlockedState
}

export function clearUnlockedWalletState() {
  if (unlockedState) unlockedState.dek.fill(0)
  unlockedState = undefined
}

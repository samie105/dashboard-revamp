type UnlockedWalletState = {
  userId: string
  walletId: string
  dek: Uint8Array
  lastActivityAt: number
  idleTimeoutMs: number
  maxExpiresAt: number
  expiresAt: number
}

let unlockedState: UnlockedWalletState | undefined

export const WALLET_UNLOCK_IDLE_TIMEOUT_MS = 30 * 60_000
export const WALLET_UNLOCK_MAX_LIFETIME_MS = 24 * 60 * 60_000

export function setUnlockedWalletState(userId: string, walletId: string, dek: Uint8Array, idleTimeoutMs = WALLET_UNLOCK_IDLE_TIMEOUT_MS, maxLifetimeMs = WALLET_UNLOCK_MAX_LIFETIME_MS) {
  clearUnlockedWalletState()
  const now = Date.now()
  unlockedState = { userId, walletId, dek: new Uint8Array(dek), lastActivityAt: now, idleTimeoutMs, maxExpiresAt: now + maxLifetimeMs, expiresAt: Math.min(now + idleTimeoutMs, now + maxLifetimeMs) }
}

export function getUnlockedWalletState(userId: string, walletId: string) {
  if (!unlockedState || unlockedState.userId !== userId || unlockedState.walletId !== walletId) return undefined
  const now = Date.now()
  if (unlockedState.expiresAt <= now || unlockedState.maxExpiresAt <= now) {
    clearUnlockedWalletState()
    return undefined
  }
  touchUnlockedWalletState(userId, walletId)
  return unlockedState
}

/** Extends only the idle window; the absolute session lifetime never moves. */
export function touchUnlockedWalletState(userId: string, walletId: string) {
  if (!unlockedState || unlockedState.userId !== userId || unlockedState.walletId !== walletId) return false
  const now = Date.now()
  if (unlockedState.maxExpiresAt <= now) { clearUnlockedWalletState(); return false }
  unlockedState.lastActivityAt = now
  unlockedState.expiresAt = Math.min(now + unlockedState.idleTimeoutMs, unlockedState.maxExpiresAt)
  return true
}

export function clearUnlockedWalletState() {
  if (unlockedState) unlockedState.dek.fill(0)
  unlockedState = undefined
}

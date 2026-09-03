"use client"

/**
 * The in-flight money move, remembered across unmounts.
 *
 * The money-flow modal renders inside a Base UI portal that unmounts on close,
 * and the X button stays live even while a transfer is in flight (an explicit
 * close is a choice, unlike a stray backdrop tap). That was fine for the
 * server — the order carries on regardless — but the *reference* lived only in
 * React state, so closing the modal at the wrong moment left the user with a
 * charge in progress and nothing to quote. The same hole swallowed a page
 * refresh, a navigation, and a phone locking mid-flow.
 *
 * So the reference is written down the instant it exists, and every flow looks
 * for one when it mounts. Recovery re-fetches the real status from the service
 * — this file never claims to know how a transfer ended, only that one was
 * started and hasn't been seen through yet.
 *
 * localStorage rather than sessionStorage: closing the tab is exactly the
 * accident worth surviving. Entries self-expire, and are cleared the moment a
 * flow reaches a terminal state.
 */

export type PendingFlowKind = "buy" | "sell" | "fund" | "trading-withdraw" | "hyperliquid-deposit" | "hyperliquid-withdrawal"

export interface PendingFlow {
  reference: string
  /** Epoch ms the order was accepted — seeds the elapsed counter on recovery. */
  startedAt: number
}

const KEY_PREFIX = "ws:pending-flow:"

/** Past this, a transfer is a history question, not a live one. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000

function key(kind: PendingFlowKind) {
  return `${KEY_PREFIX}${kind}`
}

export function savePendingFlow(kind: PendingFlowKind, reference: string, startedAt = Date.now()) {
  try {
    localStorage.setItem(key(kind), JSON.stringify({ reference, startedAt }))
  } catch {
    /* Private mode, quota, disabled storage — recovery is a safety net, not a
       dependency. The flow still works; it just can't be resumed. */
  }
}

export function readPendingFlow(kind: PendingFlowKind): PendingFlow | null {
  try {
    const raw = localStorage.getItem(key(kind))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PendingFlow>
    if (typeof parsed?.reference !== "string" || !parsed.reference) return null
    const startedAt = typeof parsed.startedAt === "number" ? parsed.startedAt : 0
    // A clock that moved backwards (timezone change, NTP correction) would
    // otherwise make a fresh order look ancient and silently drop it.
    const age = Date.now() - startedAt
    if (startedAt <= 0 || age > MAX_AGE_MS) {
      clearPendingFlow(kind)
      return null
    }
    return { reference: parsed.reference, startedAt: age < 0 ? Date.now() : startedAt }
  } catch {
    clearPendingFlow(kind)
    return null
  }
}

export function clearPendingFlow(kind: PendingFlowKind) {
  try {
    localStorage.removeItem(key(kind))
  } catch {
    /* nothing to do */
  }
}

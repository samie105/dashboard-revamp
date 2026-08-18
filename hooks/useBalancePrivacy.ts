"use client"

/**
 * "Hide my balances" — one flag for the whole app.
 *
 * The eye button on the dashboard used to own this as local state, which was
 * fine while the dashboard hero was the only place a balance appeared. It isn't
 * any more: the navbar carries the cash figure on every route. A privacy toggle
 * that only blanks one of the two is not a privacy toggle — the number the user
 * is hiding stays on screen.
 *
 * Persisted, because a preference that resets on refresh doesn't survive the
 * situation it exists for (someone reading over your shoulder).
 */

import * as React from "react"

const KEY = "ws:balances-hidden"

let hidden = false
let hydrated = false
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function hydrate() {
  if (hydrated) return
  hydrated = true
  try {
    hidden = localStorage.getItem(KEY) === "1"
  } catch {
    /* private mode — default to showing */
  }
}

function subscribe(cb: () => void) {
  // First subscriber reads the stored preference. Server render always reports
  // `false`, so React re-renders once after hydration if it differs — the
  // sanctioned useSyncExternalStore pattern, not a hydration mismatch.
  hydrate()
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function setBalancesHidden(next: boolean) {
  if (next === hidden) return
  hidden = next
  try {
    localStorage.setItem(KEY, next ? "1" : "0")
  } catch {
    /* preference is best-effort */
  }
  emit()
}

export function useBalancePrivacy() {
  const isHidden = React.useSyncExternalStore(subscribe, () => hidden, () => false)
  const toggle = React.useCallback(() => setBalancesHidden(!hidden), [])
  return { hidden: isHidden, setHidden: setBalancesHidden, toggle }
}

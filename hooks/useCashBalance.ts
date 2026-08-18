"use client"

/**
 * The Dollar Account balance, shared by every surface that shows it.
 *
 * This used to be a `useState` + 30s `setInterval` living inside the dashboard's
 * user card. The moment a second surface wants the figure (the navbar), that
 * shape means two polls, two clocks, and two answers that drift apart between
 * ticks. So the poll lives here instead: one interval for the whole app no
 * matter how many components subscribe, and it stops entirely when the last one
 * unmounts.
 *
 * USD only. NGN is a different currency and is never silently folded into a
 * USD figure.
 */

import * as React from "react"
import { fetchDollarBalances } from "@/lib/crypto-api"

const POLL_MS = 30_000

let cash = 0
let loaded = false
let timer: ReturnType<typeof setInterval> | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

async function load() {
  try {
    const res = await fetchDollarBalances()
    const next = res.balances.USD.available + res.balances.USD.locked
    // Only wake subscribers when something actually moved.
    if (next !== cash || !loaded) {
      cash = next
      loaded = true
      emit()
    }
  } catch {
    /* A failed poll isn't a zero balance — keep the last good figure. */
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  if (listeners.size === 1) {
    void load()
    timer = setInterval(load, POLL_MS)
  }
  return () => {
    listeners.delete(cb)
    if (listeners.size === 0 && timer) {
      clearInterval(timer)
      timer = null
    }
  }
}

/** Force a refetch now — for an explicit "Refresh" press. */
export function refreshCashBalance() {
  return load()
}

export function useCashBalance() {
  const value = React.useSyncExternalStore(subscribe, () => cash, () => 0)
  // `loaded` separates "no answer yet" from a real $0.00, so callers can hold
  // back rather than flash a zero they'd have to correct.
  const isLoaded = React.useSyncExternalStore(subscribe, () => loaded, () => false)
  return { cash: value, loaded: isLoaded }
}

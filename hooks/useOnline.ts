"use client"

/**
 * Whether the browser thinks it has a network.
 *
 * The money flows poll for their own status and swallow every failed poll on
 * purpose — a poll that fails is not an order that failed. That's right, but
 * it meant a user who walked into a lift watched a spinner promising "updates
 * automatically" while nothing was updating and nothing said so.
 *
 * `navigator.onLine` is famously optimistic: true means "there is an
 * interface", not "the internet works". It is still perfectly reliable in the
 * direction that matters here — false really does mean nothing will get
 * through — so it's used only to explain a stall, never to claim health.
 *
 * Server render always reports online, then corrects after hydration: the
 * sanctioned useSyncExternalStore pattern, not a mismatch.
 */

import * as React from "react"

function subscribe(cb: () => void) {
  window.addEventListener("online", cb)
  window.addEventListener("offline", cb)
  return () => {
    window.removeEventListener("online", cb)
    window.removeEventListener("offline", cb)
  }
}

export function useOnline() {
  return React.useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  )
}

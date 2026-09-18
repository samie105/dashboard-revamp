"use client"

/**
 * The launch that is in flight, kept outside the component that started it.
 *
 * Stage 4's requirement: a launch outlives the tab. In production that record
 * is `TokenLaunch.status` on the server, advanced by the reconciler. The
 * preview has no server, so it keeps the same record in sessionStorage — which
 * is enough to review the behaviour that matters: close the page mid-launch,
 * come back, and find the launch where you left it rather than an empty form.
 *
 * Read through `useSyncExternalStore`, not an effect that copies storage into
 * state. That is hydration-safe by construction (the server snapshot is
 * always `null`), and it is the shape this repo's lint asks for — it rejects
 * a synchronous setState inside an effect, and it is right to.
 *
 * Every storage call is wrapped: a private window, a full quota or blocked
 * site data must cost the resume, never the page.
 */

import * as React from "react"
import type { Draft } from "@/components/launchpad-unauth/launch-data"

const KEY = "ws:launchpad-preview:pending"
const EVENT = "ws-launchpad-pending"

export type LifecycleState = "signing" | "confirming" | "live" | "failed"

export type PendingLaunch = {
  /** Without `iconUrl`: an object URL does not survive a reload. */
  draft: Omit<Draft, "iconUrl">
  state: LifecycleState
  /** When the CURRENT state began, epoch ms — read in event handlers only. */
  startedAt: number
}

export const IN_FLIGHT: LifecycleState[] = ["signing", "confirming"]

function readRaw(): string | null {
  try {
    return window.sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function savePending(pending: PendingLaunch) {
  try {
    const { draft, ...rest } = pending
    // Strip the object URL even if a caller passed one through.
    const safe = { ...rest, draft: { ...draft, iconUrl: undefined } }
    window.sessionStorage.setItem(KEY, JSON.stringify(safe))
  } catch {
    /* see the header */
  }
  window.dispatchEvent(new Event(EVENT))
}

export function clearPending() {
  try {
    window.sessionStorage.removeItem(KEY)
  } catch {
    /* see the header */
  }
  window.dispatchEvent(new Event(EVENT))
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange)
  window.addEventListener("storage", onChange)
  return () => {
    window.removeEventListener(EVENT, onChange)
    window.removeEventListener("storage", onChange)
  }
}

/** The pending launch, or null. Null on the server and on first paint. */
export function usePendingLaunch(): PendingLaunch | null {
  const raw = React.useSyncExternalStore(subscribe, readRaw, () => null)
  return React.useMemo(() => {
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw) as PendingLaunch
      // Defensive: another build, another tab or a hand-edit can all write
      // this key. A malformed record is treated as no record.
      if (!parsed?.draft?.symbol || !parsed.state) return null
      return parsed
    } catch {
      return null
    }
  }, [raw])
}

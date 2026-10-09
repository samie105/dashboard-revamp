"use client"

/**
 * Trading preferences — per DEVICE, in localStorage, read through
 * useSyncExternalStore (hydration-safe: the server snapshot is the defaults,
 * so the first paint matches the server and the saved value lands right
 * after). Set in Settings → Preferences, read by the Trade page.
 *
 *  · defaultVenue — which market /trade opens on when the link doesn't say.
 *    An explicit ?market= always wins.
 *  · confirmSpot — a review step before a spot swap is sent. Futures orders
 *    are ALWAYS reviewed before signing (trading spec §9); this never turns
 *    that off.
 */

import * as React from "react"

export type TradePrefs = { defaultVenue: "spot" | "futures"; confirmSpot: boolean }

export const DEFAULT_TRADE_PREFS: TradePrefs = { defaultVenue: "spot", confirmSpot: false }

const KEY = "ws:trade-prefs"
const EVENT = "ws-trade-prefs"

/** Whatever is stored, as valid prefs — junk and missing keys fall back. */
export function parseTradePrefs(raw: string | null): TradePrefs {
  if (!raw) return DEFAULT_TRADE_PREFS
  try {
    const p = JSON.parse(raw) as Partial<TradePrefs>
    return {
      defaultVenue: p.defaultVenue === "futures" ? "futures" : "spot",
      confirmSpot: p.confirmSpot === true,
    }
  } catch {
    return DEFAULT_TRADE_PREFS
  }
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(KEY)
  } catch {
    return null
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb)
  window.addEventListener("storage", cb)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener("storage", cb)
  }
}

export function useTradePrefs(): TradePrefs {
  const raw = React.useSyncExternalStore(subscribe, readRaw, () => null)
  return React.useMemo(() => parseTradePrefs(raw), [raw])
}

/** Merge a change into the saved prefs. False if storage refused it. */
export function setTradePrefs(patch: Partial<TradePrefs>): boolean {
  const next = { ...parseTradePrefs(readRaw()), ...patch }
  let ok = true
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    ok = false
  }
  window.dispatchEvent(new Event(EVENT))
  return ok
}

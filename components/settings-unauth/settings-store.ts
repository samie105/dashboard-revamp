"use client"

/**
 * The settings preview's saved state — localStorage, read through
 * useSyncExternalStore (hydration-safe; the server snapshot is the defaults).
 * Every switch on the page writes here, so a reload shows what you set.
 *
 * Nothing leaves the browser: no account is changed, no email is sent.
 */

import * as React from "react"

export type Channel = "push" | "email" | "sms"
export type NotifyKey = "money" | "orders" | "alerts" | "launchpad" | "security" | "news"

export type Settings = {
  profile: { displayName: string; username: string; country: string; timezone: string; avatarUrl?: string }
  security: { twoFactor: boolean; passkey: boolean; whitelist: boolean; loginAlerts: boolean; antiPhishing: string }
  notify: Record<NotifyKey, Record<Channel, boolean>>
  prefs: { currency: string; language: string; defaultVenue: "spot" | "futures"; confirmOrders: boolean; hideBalances: boolean; changeBasis: "rolling" | "utc" }
  /** Session ids the user has signed out of, this demo. */
  revoked: string[]
}

export const DEFAULTS: Settings = {
  profile: { displayName: "Raphael Tomiwa", username: "raphael", country: "Nigeria", timezone: "Africa/Lagos (GMT+1)" },
  security: { twoFactor: true, passkey: false, whitelist: false, loginAlerts: true, antiPhishing: "GOLD-OWL" },
  notify: {
    money: { push: true, email: true, sms: false },
    orders: { push: true, email: false, sms: false },
    alerts: { push: true, email: false, sms: false },
    launchpad: { push: false, email: false, sms: false },
    // Security alerts can't be fully switched off — see the page.
    security: { push: true, email: true, sms: true },
    news: { push: false, email: false, sms: false },
  },
  prefs: { currency: "USD", language: "English", defaultVenue: "spot", confirmOrders: true, hideBalances: false, changeBasis: "rolling" },
  revoked: [],
}

const KEY = "ws:settings-preview"
const EVENT = "ws-settings-preview"

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

function parse(raw: string | null): Settings {
  if (!raw) return DEFAULTS
  try {
    const p = JSON.parse(raw) as Partial<Settings>
    return {
      profile: { ...DEFAULTS.profile, ...p.profile },
      security: { ...DEFAULTS.security, ...p.security },
      notify: { ...DEFAULTS.notify, ...p.notify },
      prefs: { ...DEFAULTS.prefs, ...p.prefs },
      revoked: Array.isArray(p.revoked) ? p.revoked : [],
    }
  } catch {
    return DEFAULTS
  }
}

export function useSettings(): Settings {
  const raw = React.useSyncExternalStore(subscribe, readRaw, () => null)
  return React.useMemo(() => parse(raw), [raw])
}

/** Apply an updater to the saved settings. Returns false if storage refused. */
export function updateSettings(fn: (s: Settings) => Settings): boolean {
  const next = fn(parse(readRaw()))
  let ok = true
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    ok = false
  }
  window.dispatchEvent(new Event(EVENT))
  return ok
}

export function resetSettings() {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    /* blocked storage costs the reset, never the page */
  }
  window.dispatchEvent(new Event(EVENT))
}

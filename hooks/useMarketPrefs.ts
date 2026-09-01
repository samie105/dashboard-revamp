"use client"

/**
 * Pinned markets and recently traded pairs — one store for the whole app.
 *
 * Picking a pair was a scroll through several hundred registry rows every
 * single time, including for the two or three pairs a given user actually
 * trades. Pinning is the fix, and it has to persist: a favourite that resets on
 * refresh is a favourite you stop using.
 *
 * Recents are kept alongside because they cost nothing — the picker already
 * knows which row was selected — and they answer the far more common question
 * ("the thing I was just looking at") without the user having to have planned
 * ahead by pinning it.
 *
 * Same shape as `useBalancePrivacy`: a module-level store over
 * `useSyncExternalStore`, so every mounted picker agrees and the server render
 * is deterministic.
 */

import * as React from "react"

const FAV_KEY = "ws:market-favorites"
const RECENT_KEY = "ws:market-recents"
const RECENT_LIMIT = 6

/** Row keys — `marketRowKey`, never bare symbols: two rows can share a symbol. */
let favorites: ReadonlySet<string> = new Set()
let recents: readonly string[] = []
let hydrated = false
const listeners = new Set<() => void>()

/** Server render and first client render must agree; both see the empties. */
const EMPTY_SET: ReadonlySet<string> = new Set()
const EMPTY_LIST: readonly string[] = []

function emit() {
  for (const l of listeners) l()
}

function readList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []
  } catch {
    /* private mode, or someone else's data in our key — start empty */
    return []
  }
}

function hydrate() {
  if (hydrated) return
  hydrated = true
  favorites = new Set(readList(FAV_KEY))
  recents = readList(RECENT_KEY)
}

function persist(key: string, value: readonly string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* best effort — the in-memory store still holds for this session */
  }
}

function subscribe(cb: () => void) {
  hydrate()
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function toggleFavorite(rowKey: string) {
  hydrate()
  const next = new Set(favorites)
  if (!next.delete(rowKey)) next.add(rowKey)
  favorites = next
  persist(FAV_KEY, [...next])
  emit()
}

/** Record a pair the user actually opened. Most recent first, deduped. */
export function noteRecentMarket(rowKey: string) {
  hydrate()
  if (recents[0] === rowKey) return
  recents = [rowKey, ...recents.filter((k) => k !== rowKey)].slice(0, RECENT_LIMIT)
  persist(RECENT_KEY, recents)
  emit()
}

export function useMarketPrefs() {
  const favs = React.useSyncExternalStore(
    subscribe,
    () => favorites,
    () => EMPTY_SET,
  )
  const recent = React.useSyncExternalStore(
    subscribe,
    () => recents,
    () => EMPTY_LIST,
  )
  return { favorites: favs, recents: recent, toggleFavorite, noteRecentMarket }
}

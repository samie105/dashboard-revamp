"use client"

import * as React from "react"

import { useAuth } from "@/components/auth-provider"
import {
  parseUiMode,
  resolveUiMode,
  simpleTradeView,
  simpleWalletView,
  uiModeStorageKey,
  type UiMode,
} from "@/lib/ui-mode"

/**
 * The Simple / Pro preference, shared by every screen that reads it.
 *
 * A module-level store behind `useSyncExternalStore` rather than component
 * state, for the reason `useBalancePrivacy` gives: the switch is rendered in
 * more than one place (the wallet header, the trade top bar) and a
 * preference that only updates the control you pressed is not a preference.
 * The `storage` listener extends that to other tabs — someone who switches
 * to Pro on the wallet finds the trade screen in Pro too.
 */
const uiModeStore = (() => {
  const cache = new Map<string, UiMode | null>()
  const listeners = new Set<() => void>()
  let storageListenerAttached = false

  function notify() {
    for (const listener of listeners) listener()
  }

  function ensureStorageListener() {
    if (storageListenerAttached || typeof window === "undefined") return
    storageListenerAttached = true
    window.addEventListener("storage", (event) => {
      // localStorage.clear() fires with a null key — drop everything so the
      // next read starts from the real state rather than a stale cache.
      if (event.key === null) {
        cache.clear()
        notify()
        return
      }
      if (!event.key.startsWith("ws:ui-mode:")) return
      cache.set(event.key, parseUiMode(event.newValue))
      notify()
    })
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      ensureStorageListener()
      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot(key: string): UiMode | null {
      if (!cache.has(key)) {
        if (typeof window === "undefined") return null
        try {
          cache.set(key, parseUiMode(window.localStorage.getItem(key)))
        } catch {
          // Private mode: the preference just won't persist. Simple is the
          // default it falls back to, which is the safe direction to fail.
          cache.set(key, null)
        }
      }
      return cache.get(key) ?? null
    },
    /** Server render has no preference to read, so it renders the default —
     *  the sanctioned useSyncExternalStore shape, not a hydration mismatch. */
    getServerSnapshot(): UiMode | null {
      return null
    },
    set(key: string, mode: UiMode) {
      cache.set(key, mode)
      try {
        window.localStorage.setItem(key, mode)
      } catch {
        /* best effort — the choice still holds for this session */
      }
      notify()
    },
  }
})()

type UiModeContextValue = {
  mode: UiMode
  setMode: (mode: UiMode) => void
  /** True while the switch has never been touched — the guide's fourth card
   *  reads this to decide whether to introduce the control or just mention it. */
  isDefault: boolean
}

const UiModeContext = React.createContext<UiModeContextValue | null>(null)

export function UiModeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const key = uiModeStorageKey(user?.userId)

  const getSnapshot = React.useCallback(() => uiModeStore.getSnapshot(key), [key])
  const stored = React.useSyncExternalStore(
    uiModeStore.subscribe,
    getSnapshot,
    uiModeStore.getServerSnapshot,
  )

  const setMode = React.useCallback((mode: UiMode) => uiModeStore.set(key, mode), [key])

  const value = React.useMemo<UiModeContextValue>(
    () => ({ mode: resolveUiMode({ stored }), setMode, isDefault: stored === null }),
    [stored, setMode],
  )

  return <UiModeContext.Provider value={value}>{children}</UiModeContext.Provider>
}

/**
 * The mode, plus the view descriptors the two heavy screens read.
 *
 * Returns Simple's descriptors outside the provider rather than throwing.
 * The wallet and trade screens are always inside it, but this hook is the
 * kind of thing that gets reached for from a component rendered in a
 * portal or a test harness, and crashing a money screen over a missing
 * context is a worse failure than quietly showing the calmer view.
 */
export function useUiMode(): UiModeContextValue & {
  wallet: ReturnType<typeof simpleWalletView>
  trade: ReturnType<typeof simpleTradeView>
  isSimple: boolean
} {
  const context = React.useContext(UiModeContext)
  const mode = context?.mode ?? "simple"
  return {
    mode,
    setMode: context?.setMode ?? (() => {}),
    isDefault: context?.isDefault ?? true,
    wallet: simpleWalletView(mode),
    trade: simpleTradeView(mode),
    isSimple: mode === "simple",
  }
}

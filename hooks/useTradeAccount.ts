"use client"

/**
 * The user's Hyperliquid trading account via GET /api/trade/account — spot
 * balances, perps value, positions and open orders in one call. This is the
 * single source for every "Spot"/"Futures" figure in the dashboard, replacing
 * the spotv2 ledger reads and the old /api/hyperliquid/* hooks.
 *
 * ONE POLL, HOWEVER MANY SUBSCRIBERS. This was a `useState` + `setInterval`
 * per call site, which meant every component that wanted a figure opened its
 * own clock against the same endpoint. There are four callers today — the
 * dashboard hero, `usePortfolioTotal`, and the two `useHyperliquid*` wrappers
 * that themselves have callers — so a single screen could hit
 * `/api/trade/account` three or four times every thirty seconds and then show
 * figures that disagreed between ticks.
 *
 * The store below is the same shape `useCashBalance` uses, and for the same
 * reason: one interval for the whole app no matter how many components
 * subscribe, stopped entirely when the last one unmounts. The public API is
 * unchanged, so no call site had to be touched.
 *
 * `refreshMs` is now a REQUEST rather than a private clock: the store polls at
 * the shortest interval any live subscriber asked for. The positions view wants
 * 10s and everything else wants 30s, and the fast one must not be slowed down
 * by whichever component happened to mount first.
 */

import * as React from "react"
import { fetchHlAccount, type HlAccount } from "@/lib/crypto-api"

const DEFAULT_MS = 30_000

type State = {
  account: HlAccount | null
  isLoading: boolean
  error: string | null
}

/* One frozen object per change. `useSyncExternalStore` compares snapshots by
   identity, so building a fresh object on every read would re-render forever. */
let state: State = { account: null, isLoading: true, error: null }

const listeners = new Set<() => void>()
/** Every live subscriber's requested cadence, so the shortest one wins. */
const cadences = new Map<symbol, number>()
let timer: ReturnType<typeof setInterval> | null = null
let inFlight: Promise<void> | null = null

function emit() {
  for (const l of listeners) l()
}

function set(next: Partial<State>) {
  state = { ...state, ...next }
  emit()
}

async function load(): Promise<void> {
  /* Collapse concurrent callers onto one request: several components mounting
     in the same commit would otherwise each fire their initial fetch. */
  if (inFlight) return inFlight
  inFlight = (async () => {
    try {
      const data = await fetchHlAccount()
      set({ account: data, error: null, isLoading: false })
    } catch (err) {
      /* A failed poll is not an empty account — keep the last good figures and
         report the error alongside them. */
      set({
        error: err instanceof Error ? err.message : "Failed to load account",
        isLoading: false,
      })
    } finally {
      inFlight = null
    }
  })()
  return inFlight
}

function currentCadence(): number {
  let shortest = Infinity
  for (const ms of cadences.values()) if (ms > 0 && ms < shortest) shortest = ms
  return Number.isFinite(shortest) ? shortest : 0
}

function restartTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  const ms = currentCadence()
  if (ms > 0 && listeners.size > 0) timer = setInterval(() => void load(), ms)
}

function subscribe(cb: () => void, key: symbol, refreshMs: number) {
  listeners.add(cb)
  cadences.set(key, refreshMs)
  if (listeners.size === 1) void load()
  restartTimer()
  return () => {
    listeners.delete(cb)
    cadences.delete(key)
    if (listeners.size === 0) {
      if (timer) clearInterval(timer)
      timer = null
    } else {
      /* The fastest subscriber may have just left — fall back to the next. */
      restartTimer()
    }
  }
}

/** Server render has no account to read, so it renders the loading state —
 *  the sanctioned useSyncExternalStore shape, not a hydration mismatch. */
const SERVER_STATE: State = { account: null, isLoading: true, error: null }

export function useTradeAccount(refreshMs = DEFAULT_MS) {
  /* One identity per hook instance, so two components asking for different
     cadences are tracked separately and unsubscribing removes only its own. */
  const key = React.useRef<symbol>(null as unknown as symbol)
  if (key.current == null) key.current = Symbol("useTradeAccount")

  const doSubscribe = React.useCallback(
    (cb: () => void) => subscribe(cb, key.current, refreshMs),
    [refreshMs],
  )

  const snapshot = React.useSyncExternalStore(
    doSubscribe,
    () => state,
    () => SERVER_STATE,
  )

  const { account, isLoading, error } = snapshot
  const balances = account?.balances ?? null

  return React.useMemo(() => {
    // Spot = USDC in spot + market value of spot token holdings (positions in
    // spot tokens are priced by the account's own mark data when present).
    const spotUsd = balances ? balances.spotUsdc + (balances.spotUsdcHold ?? 0) : 0
    const futuresUsd = balances?.perpsAccountValueUsdc ?? 0
    return {
      account,
      ready: account?.ready ?? false,
      balances,
      positions: account?.positions ?? [],
      openOrders: account?.openOrders ?? [],
      spotUsd,
      futuresUsd,
      isLoading,
      error,
      refetch: load,
    }
  }, [account, balances, isLoading, error])
}

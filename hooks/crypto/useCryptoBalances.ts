"use client"

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/components/auth-provider"
import { CryptoBackendError, cryptoBackendClient, cryptoQueryKeys, isCryptoBackendEnabled } from "@/lib/crypto-backend"
import { flattenSnapshot, unavailableNetworksOf } from "@/hooks/crypto/balance-policy"

export type { CryptoBalanceResult } from "@/hooks/crypto/balance-policy"

// Spec §5: balances refresh only on initial load, explicit user refresh,
// after a confirmed transaction, or a wallet/network context change — never
// on a poll or window focus. The last snapshot stays on screen while a
// refresh is in flight, and its `generatedAt` timestamp is exposed so
// callers can show it.
export function useCryptoBalances() {
  const { user, isLoaded, isSignedIn } = useAuth()
  const userId = user?.userId ?? "anonymous"
  const enabled = isCryptoBackendEnabled && isLoaded && isSignedIn
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: cryptoQueryKeys.balanceSnapshot(userId),
    // Spec §5: reads hit the backend cache; refresh=true is reserved for the
    // explicit triggers (user refresh, post-transaction invalidation).
    queryFn: ({ signal }) => cryptoBackendClient.listBalanceSnapshot(false, signal),
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    // Keep the last snapshot on screen while refetching, but only when the
    // previous query belonged to this same user — `keepPreviousData` would
    // otherwise carry a stale user's balances into the new user's query key
    // for a moment after a Clerk user switch, ahead of the provider's cache
    // clear.
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey.includes(userId) ? previousData : undefined,
    retry: (failureCount, error) =>
      failureCount < 2 && !(error instanceof CryptoBackendError && error.status < 500),
  })

  const refresh = React.useCallback(async () => {
    // Never fire an unauthenticated/mid-load refresh — it would hit the
    // backend without a session and could write into the "anonymous" cache
    // slot.
    if (!enabled) return
    const fresh = await cryptoBackendClient.listBalanceSnapshot(true)
    queryClient.setQueryData(cryptoQueryKeys.balanceSnapshot(userId), fresh)
  }, [enabled, queryClient, userId])

  return {
    balances: flattenSnapshot(query.data),
    unavailableNetworks: unavailableNetworksOf(query.data),
    snapshot: query.data ?? null,
    generatedAt: query.data?.generatedAt ?? null,
    isLoading: query.isLoading,
    isRefreshing: query.isFetching && !query.isLoading,
    error: query.error,
    refresh,
  }
}

/** Precision-preserving display formatter. The raw value remains authoritative. */
export function formatCryptoAmount(amountBaseUnits: string, decimals: number, maxFractionDigits = 6) {
  if (!/^\d+$/.test(amountBaseUnits) || decimals < 0) return "0"
  const normalized = amountBaseUnits.replace(/^0+(?=\d)/, "")
  if (decimals === 0) return normalized
  const padded = normalized.padStart(decimals + 1, "0")
  const whole = padded.slice(0, -decimals) || "0"
  const fraction = padded.slice(-decimals).replace(/0+$/, "").slice(0, maxFractionDigits)
  return fraction ? `${whole}.${fraction}` : whole
}

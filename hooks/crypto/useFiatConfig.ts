"use client"

/**
 * Capability discovery (guide §5). Guide lines 215-216: "Cache it for no
 * longer than the returned cacheExpiresAt; refetch after that time or after
 * a provider-related error." Reads retry only per guide §12.3.
 */

import { useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/components/auth-provider"
import {
  cryptoBackendClient,
  cryptoQueryKeys,
  isCryptoBackendEnabled,
} from "@/lib/crypto-backend"
import { fiatReadRetry } from "@/lib/crypto-backend/fiat-errors"
import { fiatConfigRefetchDelayMs } from "@/lib/crypto-backend/fiat-poll-schedule"

export function useFiatConfig() {
  const { isLoaded, isSignedIn } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: cryptoQueryKeys.fiatConfig(),
    queryFn: ({ signal }) => cryptoBackendClient.getFiatConfig(signal),
    enabled: isCryptoBackendEnabled && isLoaded && isSignedIn,
    // Never serve a cached snapshot as fresh; the interval below refetches
    // at cacheExpiresAt, so a kill-switch flip is picked up (guide §15).
    staleTime: 0,
    refetchInterval: (q) => fiatConfigRefetchDelayMs(q.state.data?.cacheExpiresAt),
    retry: fiatReadRetry,
  })

  /** Call after any FIAT_PROVIDER_NOT_READY response (guide §5). */
  const refetchOnProviderError = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.fiatConfig() })
  }, [queryClient])

  return { ...query, refetchOnProviderError }
}

"use client"

/**
 * Poll a Bridge USD virtual account and its activity (CP2 / CP6).
 *
 * Guide §11 lines 982-984: "For virtual-account activity, poll less
 * frequently (15-30s while the account screen is open) and refresh on
 * focus. The user can leave the screen; backend reconciliation continues
 * independently."
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
import { nextFiatVirtualAccountPollDelayMs } from "@/lib/crypto-backend/fiat-poll-schedule"

export function useFiatVirtualAccountPoll(accountId: string | undefined) {
  const { user, isLoaded, isSignedIn } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.userId ?? "anonymous"
  const enabled = isCryptoBackendEnabled && isLoaded && isSignedIn && Boolean(accountId)

  const query = useQuery({
    queryKey: cryptoQueryKeys.fiatVirtualAccount(userId, accountId ?? "none"),
    queryFn: ({ signal }) =>
      cryptoBackendClient.getBridgeVirtualAccount(accountId as string, signal),
    enabled,
    refetchInterval: (q) => nextFiatVirtualAccountPollDelayMs(q.state.data?.status) ?? false,
    refetchOnWindowFocus: true,
    retry: fiatReadRetry,
  })

  const refresh = useCallback(() => {
    if (!accountId) return
    void queryClient.invalidateQueries({
      queryKey: cryptoQueryKeys.fiatVirtualAccount(userId, accountId),
    })
  }, [accountId, queryClient, userId])

  return { data: query.data, isLoading: query.isLoading, error: query.error, refresh }
}

export function useFiatVirtualAccountActivityPoll(accountId: string | undefined) {
  const { user, isLoaded, isSignedIn } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.userId ?? "anonymous"
  const enabled = isCryptoBackendEnabled && isLoaded && isSignedIn && Boolean(accountId)

  const query = useQuery({
    queryKey: cryptoQueryKeys.fiatVirtualAccountActivity(userId, accountId ?? "none"),
    queryFn: ({ signal }) =>
      cryptoBackendClient.listBridgeVirtualAccountActivity(accountId as string, 100, signal),
    enabled,
    refetchInterval: () => nextFiatVirtualAccountPollDelayMs(undefined) ?? false,
    refetchOnWindowFocus: true,
    retry: fiatReadRetry,
  })

  const refresh = useCallback(() => {
    if (!accountId) return
    void queryClient.invalidateQueries({
      queryKey: cryptoQueryKeys.fiatVirtualAccountActivity(userId, accountId),
    })
  }, [accountId, queryClient, userId])

  return { data: query.data, isLoading: query.isLoading, error: query.error, refresh }
}

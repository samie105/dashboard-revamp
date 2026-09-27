"use client"

/**
 * Poll a fiat order via GET /fiat/orders/:id with the guide §11 backoff
 * ladder (docs/fiat-frontend-integration-guide.md lines 976-980). Terminal
 * states stop the poll; `manual_review` / `blocked` stop automatic polling
 * too. Focus refetch stays on, and `refresh()` is for "after a wallet
 * transaction submit". The schedule itself is the pure
 * nextFiatOrderPollDelayMs in lib/crypto-backend/fiat-poll-schedule.ts.
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
import { nextFiatOrderPollDelayMs } from "@/lib/crypto-backend/fiat-poll-schedule"

export function useFiatOrderPoll(orderId: string | undefined) {
  const { user, isLoaded, isSignedIn } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.userId ?? "anonymous"
  const enabled = isCryptoBackendEnabled && isLoaded && isSignedIn && Boolean(orderId)

  const query = useQuery({
    queryKey: cryptoQueryKeys.fiatOrder(userId, orderId ?? "none"),
    queryFn: ({ signal }) => cryptoBackendClient.getFiatOrder(orderId as string, signal),
    enabled,
    // The key includes orderId, so dataUpdateCount restarts at 0 for each
    // order: after the nth successful read the next poll waits ladder[n-1].
    refetchInterval: (q) =>
      nextFiatOrderPollDelayMs(q.state.data?.state, Math.max(q.state.dataUpdateCount - 1, 0)) ?? false,
    refetchOnWindowFocus: true,
    // Guide §12.3: only retry status 0/502/503/504. Everything else
    // (400/401/403/404/409/422/429) is not auto-retried per §12.1; 401 is
    // already handled by the client's one-shot Clerk refresh.
    retry: fiatReadRetry,
  })

  const refresh = useCallback(() => {
    if (!orderId) return
    void queryClient.invalidateQueries({
      queryKey: cryptoQueryKeys.fiatOrder(userId, orderId),
    })
  }, [orderId, queryClient, userId])

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refresh,
  }
}

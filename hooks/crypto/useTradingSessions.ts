"use client"

import { useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/components/auth-provider"
import { cryptoBackendClient, cryptoQueryKeys, isCryptoBackendEnabled } from "@/lib/crypto-backend"
import type { WalletTradingSession } from "@/lib/crypto-backend"

/** Phase 6 session lifecycle. The master wallet authorization is required only
 * to create/revoke a session; the returned token is for scoped trading. */
export function useTradingSessions() {
  const { user, isLoaded, isSignedIn } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.userId ?? "anonymous"
  const query = useQuery({
    queryKey: [...cryptoQueryKeys.all, "trading-sessions", userId],
    queryFn: () => cryptoBackendClient.listTradingSessions(),
    enabled: isCryptoBackendEnabled && isLoaded && isSignedIn,
    staleTime: 30_000,
  })

  const refresh = useCallback(() => queryClient.invalidateQueries({ queryKey: [...cryptoQueryKeys.all, "trading-sessions", userId] }), [queryClient, userId])

  const create = useCallback(async (input: Parameters<typeof cryptoBackendClient.createTradingSession>[0], authorizationToken: string) => {
    const result = await cryptoBackendClient.createTradingSession(input, authorizationToken)
    await refresh()
    return result
  }, [refresh])

  const revoke = useCallback(async (sessionId: string, authorizationToken: string) => {
    await cryptoBackendClient.revokeTradingSession(sessionId, authorizationToken)
    await refresh()
  }, [refresh])

  const revokeAll = useCallback(async (authorizationToken: string) => {
    await cryptoBackendClient.revokeAllTradingSessions(authorizationToken)
    await refresh()
  }, [refresh])

  return { sessions: (query.data ?? []) as WalletTradingSession[], loading: query.isLoading, error: query.error, create, revoke, revokeAll, refresh }
}

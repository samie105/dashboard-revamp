"use client"

/** Read the signed-in user's fiat order list for recovery and history. */

import { useQuery } from "@tanstack/react-query"

import { useAuth } from "@/components/auth-provider"
import {
  cryptoBackendClient,
  cryptoQueryKeys,
  isCryptoBackendEnabled,
} from "@/lib/crypto-backend"
import { fiatReadRetry } from "@/lib/crypto-backend/fiat-errors"

export function useFiatOrders(limit = 50) {
  const { user, isLoaded, isSignedIn } = useAuth()
  const userId = user?.userId ?? "anonymous"

  return useQuery({
    queryKey: cryptoQueryKeys.fiatOrders(userId, limit),
    queryFn: ({ signal }) => cryptoBackendClient.listFiatOrders(limit, signal),
    enabled: isCryptoBackendEnabled && isLoaded && isSignedIn,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: fiatReadRetry,
  })
}


"use client"

/**
 * GET /fiat/bridge/virtual-accounts (guide §10.2 line 863), plus the create
 * mutation (guide §10.1). Reads use the guide §12.3 retry policy; the create
 * never auto-retries: a user retry goes back through runIdempotentMutation.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/components/auth-provider"
import {
  cryptoBackendClient,
  cryptoQueryKeys,
  isCryptoBackendEnabled,
} from "@/lib/crypto-backend"
import { createBridgeUsdAccount } from "@/lib/crypto-backend/fiat-bridge-onramp"
import { fiatReadRetry } from "@/lib/crypto-backend/fiat-errors"

export function useFiatVirtualAccounts() {
  const { user, isLoaded, isSignedIn } = useAuth()
  const userId = user?.userId ?? "anonymous"
  return useQuery({
    queryKey: cryptoQueryKeys.fiatVirtualAccounts(userId),
    queryFn: ({ signal }) => cryptoBackendClient.listBridgeVirtualAccounts(signal),
    enabled: isCryptoBackendEnabled && isLoaded && isSignedIn,
    refetchOnWindowFocus: true,
    retry: fiatReadRetry,
  })
}

export function useCreateBridgeUsdAccount() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const userId = user?.userId ?? "anonymous"
  return useMutation({
    mutationFn: (input: { walletId: string; networkId: string }) =>
      createBridgeUsdAccount(cryptoBackendClient, input),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.fiatVirtualAccounts(userId) })
    },
  })
}

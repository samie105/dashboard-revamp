"use client"

import { useQuery } from "@tanstack/react-query"

import { useAuth } from "@/components/auth-provider"
import { cryptoBackendClient, cryptoQueryKeys, isCryptoBackendEnabled } from "@/lib/crypto-backend"
import { CryptoBackendError } from "@/lib/crypto-backend"

export function useCryptoWallet() {
  const { user, isLoaded, isSignedIn } = useAuth()
  const userId = user?.userId ?? "anonymous"

  return useQuery({
    queryKey: cryptoQueryKeys.wallet(userId),
    queryFn: ({ signal }) => cryptoBackendClient.getWallet(signal),
    enabled: isCryptoBackendEnabled && isLoaded && isSignedIn,
    staleTime: 3 * 60_000,
  })
}

export function useCryptoWalletState() {
  const query = useCryptoWallet()
  const notFound = query.error instanceof CryptoBackendError && query.error.status === 404
  return {
    ...query,
    data: notFound ? null : query.data,
    needsSetup: notFound,
  }
}

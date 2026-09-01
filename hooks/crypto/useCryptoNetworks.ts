"use client"

import { useQuery } from "@tanstack/react-query"

import { useAuth } from "@/components/auth-provider"
import { cryptoBackendClient, cryptoQueryKeys, isCryptoBackendEnabled } from "@/lib/crypto-backend"

export function useCryptoNetworks() {
  const { isLoaded, isSignedIn } = useAuth()

  return useQuery({
    queryKey: cryptoQueryKeys.networks(),
    queryFn: ({ signal }) => cryptoBackendClient.listNetworks(signal),
    enabled: isCryptoBackendEnabled && isLoaded && isSignedIn,
    staleTime: 5 * 60_000,
  })
}

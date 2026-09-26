"use client"

import { useQuery } from "@tanstack/react-query"

import { useAuth } from "@/components/auth-provider"
import { cryptoBackendClient, cryptoQueryKeys, isCryptoBackendEnabled } from "@/lib/crypto-backend"

export function useFiatConfig() {
  const { isLoaded, isSignedIn } = useAuth()

  return useQuery({
    queryKey: cryptoQueryKeys.fiatConfig(),
    queryFn: ({ signal }) => cryptoBackendClient.getFiatConfig(signal),
    enabled: isCryptoBackendEnabled && isLoaded && isSignedIn,
    staleTime: 60_000,
  })
}


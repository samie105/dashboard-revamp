"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/components/auth-provider"
import {
  cryptoBackendClient,
  cryptoQueryKeys,
  isCryptoBackendEnabled,
} from "@/lib/crypto-backend"
import { createOnswitchBeneficiary } from "@/lib/crypto-backend/fiat-offramp"
import { fiatReadRetry } from "@/lib/crypto-backend/fiat-errors"

function useBeneficiaryKey() {
  const { user, isLoaded, isSignedIn } = useAuth()
  const userId = user?.userId ?? "anonymous"
  return {
    userId,
    key: cryptoQueryKeys.fiatBeneficiaries(userId),
    enabled: isCryptoBackendEnabled && isLoaded && isSignedIn,
  }
}

export function useFiatBeneficiaries() {
  const { key, enabled } = useBeneficiaryKey()
  return useQuery({
    queryKey: key,
    queryFn: ({ signal }) => cryptoBackendClient.listFiatBeneficiaries(signal),
    enabled,
    retry: fiatReadRetry,
    refetchOnWindowFocus: true,
  })
}

export function useCreateOnswitchBeneficiary() {
  const queryClient = useQueryClient()
  const { userId, key } = useBeneficiaryKey()
  return useMutation({
    mutationFn: (input: Parameters<typeof createOnswitchBeneficiary>[1]) =>
      createOnswitchBeneficiary(cryptoBackendClient, input),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: key })
      void queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.fiatBeneficiaries(userId) })
    },
  })
}

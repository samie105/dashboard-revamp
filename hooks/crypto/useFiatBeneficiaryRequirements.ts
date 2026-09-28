"use client"

import { useQuery } from "@tanstack/react-query"

import { useAuth } from "@/components/auth-provider"
import {
  cryptoBackendClient,
  cryptoQueryKeys,
  isCryptoBackendEnabled,
} from "@/lib/crypto-backend"
import { fiatReadRetry } from "@/lib/crypto-backend/fiat-errors"

export function useFiatBeneficiaryRequirements(input: {
  country?: string
  currency?: string
  channel?: string
  holderType?: string
  enabled?: boolean
}) {
  const { user, isLoaded, isSignedIn } = useAuth()
  const userId = user?.userId ?? "anonymous"
  const query = {
    country: input.country ?? "",
    currency: input.currency ?? "",
    channel: input.channel ?? "",
    ...(input.holderType ? { holderType: input.holderType } : {}),
  }
  const enabled = Boolean(
    isCryptoBackendEnabled &&
      isLoaded &&
      isSignedIn &&
      input.enabled !== false &&
      query.country &&
      query.currency &&
      query.channel,
  )

  return useQuery({
    queryKey: cryptoQueryKeys.fiatBeneficiaryRequirements(userId, query),
    queryFn: ({ signal }) => cryptoBackendClient.listFiatBeneficiaryRequirements(query, signal),
    enabled,
    retry: fiatReadRetry,
    staleTime: 5 * 60_000,
  })
}

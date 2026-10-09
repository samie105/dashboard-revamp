"use client"

/**
 * Read an owned quote: GET /fiat/quotes/:quoteId. "Use this to reload an
 * owned quote after navigation or a browser refresh. It returns the same
 * quote shape." (docs/fiat-frontend-integration-guide.md lines 769-771)
 *
 * Read-only, one request per quote, cached: order history uses it for the
 * amount an order was quoted to deliver. No polling, no focus refetch.
 */

import { useQuery } from "@tanstack/react-query"

import { useAuth } from "@/components/auth-provider"
import { cryptoBackendClient, cryptoQueryKeys, isCryptoBackendEnabled } from "@/lib/crypto-backend"
import { fiatReadRetry } from "@/lib/crypto-backend/fiat-errors"

export function useFiatQuote(quoteId: string | undefined) {
  const { user, isLoaded, isSignedIn } = useAuth()
  const userId = user?.userId ?? "anonymous"
  return useQuery({
    queryKey: cryptoQueryKeys.fiatQuote(userId, quoteId ?? "none"),
    queryFn: ({ signal }) => cryptoBackendClient.getFiatQuote(quoteId as string, signal),
    enabled: isCryptoBackendEnabled && isLoaded && isSignedIn && Boolean(quoteId),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: fiatReadRetry,
  })
}

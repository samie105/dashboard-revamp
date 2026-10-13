"use client"

import { useQuery } from "@tanstack/react-query"
import { cryptoBackendClient, isCryptoBackendEnabled } from "@/lib/crypto-backend"

/** GET /launchpad/availability — the same query and key the old pages used. */
export function useLaunchAvailability() {
  return useQuery({
    queryKey: ["launchpad", "availability"],
    queryFn: ({ signal }) => cryptoBackendClient.getLaunchpadAvailability(signal),
    enabled: isCryptoBackendEnabled,
    refetchInterval: 60_000,
  })
}

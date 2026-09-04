"use client"

import { useMemo } from "react"
import { useAuth } from "@clerk/nextjs"
import { CryptoApi } from "@/lib/crypto/api"
import { cryptoBackendUrl } from "@/lib/crypto/config"

/**
 * One CryptoApi per Clerk session. In local development the backend runs
 * with CLERK_AUTH_ENABLED=false and accepts any bearer token, so a missing
 * Clerk session falls back to a synthetic token instead of hard-failing —
 * production builds never take that branch.
 */
export function useCryptoApi(): CryptoApi {
  const { getToken } = useAuth()
  return useMemo(
    () =>
      new CryptoApi({
        baseUrl: cryptoBackendUrl(),
        getClerkToken: async () =>
          (await getToken()) ??
          (process.env.NODE_ENV === "development" ? "dev-local-token" : undefined),
      }),
    [getToken],
  )
}

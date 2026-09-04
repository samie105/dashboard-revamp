"use client"

import { useEffect, useRef, useState } from "react"
import { useUser } from "@clerk/nextjs"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { CryptoBackendError } from "@/lib/crypto-backend"
import { clearUnlockedWalletState } from "@/lib/crypto-wallet/unlock-state"

export function CryptoQueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 15 * 60_000,
            networkMode: "offlineFirst",
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            retry: (failureCount, error) => {
              if (error instanceof CryptoBackendError && error.status >= 400 && error.status < 500) return false
              return failureCount < 2
            },
          },
          mutations: {
            networkMode: "online",
            retry: 0,
          },
        },
      }),
  )
  const { user, isLoaded } = useUser()
  const previousUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isLoaded) return

    const userId = user?.id ?? null
    if (previousUserIdRef.current !== null && previousUserIdRef.current !== userId) {
      // Wallet, intent, and balance data is user-scoped. Never allow a
      // signed-out user's cache to become visible to the next Clerk user.
      queryClient.clear()
      clearUnlockedWalletState()
    }
    previousUserIdRef.current = userId
  }, [isLoaded, queryClient, user?.id])

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

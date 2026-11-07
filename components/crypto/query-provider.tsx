"use client"

import { useEffect, useRef, useState } from "react"
import { useUser as useClerkUser } from "@clerk/nextjs"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { CryptoBackendError } from "@/lib/crypto-backend"
import { clearUnlockedWalletState } from "@/lib/crypto-wallet/unlock-state"
import { DEV_AUTH_BYPASS, DEV_BYPASS_USER } from "@/lib/dev-auth-bypass"
import { DASHBOARD_TEST_MODE, DASHBOARD_TEST_USER } from "@/lib/dashboard-test-mode"
import { useClerkEnabled } from "@/components/conditional-clerk-provider"

export function CryptoQueryProvider({ children }: { children: React.ReactNode }) {
  const clerkEnabled = useClerkEnabled()

  if (!clerkEnabled) {
    const userId = DASHBOARD_TEST_MODE ? DASHBOARD_TEST_USER.userId : DEV_AUTH_BYPASS ? DEV_BYPASS_USER.userId : null
    return <CryptoQueryProviderFrame userId={userId} isLoaded={true}>{children}</CryptoQueryProviderFrame>
  }

  return <ClerkCryptoQueryProvider>{children}</ClerkCryptoQueryProvider>
}

function ClerkCryptoQueryProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useClerkUser()
  return <CryptoQueryProviderFrame userId={user?.id ?? null} isLoaded={isLoaded}>{children}</CryptoQueryProviderFrame>
}

function CryptoQueryProviderFrame({
  children,
  userId,
  isLoaded,
}: {
  children: React.ReactNode
  userId: string | null
  isLoaded: boolean
}) {
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
  const previousUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isLoaded) return

    if (previousUserIdRef.current !== null && previousUserIdRef.current !== userId) {
      // Wallet, intent, and balance data is user-scoped. Never allow a
      // signed-out user's cache to become visible to the next Clerk user.
      queryClient.clear()
      clearUnlockedWalletState()
    }
    previousUserIdRef.current = userId
  }, [isLoaded, queryClient, userId])

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

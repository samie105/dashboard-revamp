"use client"

import * as React from "react"
import { PrivyProvider, useLinkJwtAccount, usePrivy, useSubscribeToJwtAuthWithFlag } from "@privy-io/react-auth"
import { useAuth } from "@/components/auth-provider"

type PendingLink = {
  resolve: () => void
  reject: (error: unknown) => void
}

type LegacyPrivyLinkContextValue = {
  ensureLinked: () => Promise<void>
  configured: boolean
}

const LegacyPrivyLinkContext = React.createContext<LegacyPrivyLinkContextValue>({
  configured: false,
  ensureLinked: async () => {
    throw new Error("Legacy Privy linking is not configured")
  },
})

/**
 * The legacy wallet is authenticated by Clerk today, but Privy requires the
 * Clerk JWT to be linked to the already-existing Privy email user before its
 * wallet can sign. This provider keeps that bridge in the browser, where the
 * Privy React SDK can authenticate the user and complete the link.
 */
export function LegacyPrivyProvider({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID

  if (!appId) return <>{children}</>

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email"],
        embeddedWallets: {
          ethereum: { createOnLogin: "off" },
          solana: { createOnLogin: "off" },
        },
      }}
    >
      <LegacyPrivyLinkInner>{children}</LegacyPrivyLinkInner>
    </PrivyProvider>
  )
}

function LegacyPrivyLinkInner({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user: privyUser } = usePrivy()
  const { linkWithCustomJwt } = useLinkJwtAccount()
  const { getToken, user: clerkUser } = useAuth()
  const pendingLink = React.useRef<PendingLink | null>(null)
  const linking = React.useRef(false)
  const clerkAuthenticated = Boolean(clerkUser)
  const getExternalJwt = React.useCallback(async () => {
    return (await getToken()) ?? undefined
  }, [getToken])

  // Clerk is the primary login system. Sync its JWT into Privy instead of
  // opening Privy's email login modal (which is intentionally disabled in the
  // current Privy app configuration).
  const { state: jwtState } = useSubscribeToJwtAuthWithFlag({
    isAuthenticated: clerkAuthenticated,
    isLoading: !clerkAuthenticated,
    enabled: clerkAuthenticated,
    getExternalJwt,
  })

  const linkCurrentClerkUser = React.useCallback(async () => {
    if (linking.current) return
    const alreadyLinked = privyUser?.linkedAccounts?.some(
      (account) => account.type === "custom_auth" && account.customUserId === clerkUser?.userId,
    )
    if (alreadyLinked) return

    linking.current = true
    try {
      const clerkJwt = await getToken()
      if (!clerkJwt) throw new Error("Your Clerk session has expired. Please sign in again.")
      await linkWithCustomJwt(clerkJwt)
    } finally {
      linking.current = false
    }
  }, [clerkUser?.userId, getToken, linkWithCustomJwt, privyUser?.linkedAccounts])

  React.useEffect(() => {
    const pending = pendingLink.current
    if (!pending || !ready) return

    if (!authenticated) {
      if (jwtState.status === "error") {
        pendingLink.current = null
        pending.reject(jwtState.error ?? new Error("Privy could not authenticate the Clerk session."))
      } else if (jwtState.status === "not-enabled") {
        pendingLink.current = null
        pending.reject(new Error("Privy JWT authentication is not enabled for this app."))
      }
      return
    }

    pendingLink.current = null
    void linkCurrentClerkUser().then(pending.resolve, pending.reject)
  }, [authenticated, jwtState, linkCurrentClerkUser, ready])

  const ensureLinked = React.useCallback(async () => {
    if (!ready) throw new Error("Privy is still loading. Please try again in a moment.")

    if (!authenticated) {
      if (pendingLink.current) {
        throw new Error("Privy sign-in is already in progress.")
      }

      await new Promise<void>((resolve, reject) => {
        pendingLink.current = { resolve, reject }
      })
      return
    }

    await linkCurrentClerkUser()
  }, [authenticated, linkCurrentClerkUser, ready])

  return (
    <LegacyPrivyLinkContext.Provider value={{ configured: true, ensureLinked }}>
      {children}
    </LegacyPrivyLinkContext.Provider>
  )
}

export function useLegacyPrivyLink() {
  return React.useContext(LegacyPrivyLinkContext)
}

"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { ClerkProvider } from "@clerk/nextjs"
import { DEV_AUTH_BYPASS } from "@/lib/dev-auth-bypass"
import { DASHBOARD_TEST_MODE } from "@/lib/dashboard-test-mode"
import {
  CLERK_AFTER_SIGN_IN_URL,
  CLERK_AFTER_SIGN_UP_URL,
  CLERK_DOMAIN,
  CLERK_IS_SATELLITE,
  CLERK_SIGN_IN_URL,
  CLERK_SIGN_UP_URL,
} from "@/lib/clerk-config"

const ClerkEnabledContext = React.createContext(false)

export function useClerkEnabled() {
  return React.useContext(ClerkEnabledContext)
}

/**
 * The admin console has its own email-link/session identity plane. Do not
 * initialize Clerk for an admin navigation: Clerk can reject an unrelated
 * production key before the admin page has a chance to render.
 */
export function ConditionalClerkProvider({
  children,
  publishableKey,
}: {
  children: React.ReactNode
  publishableKey?: string
}) {
  const pathname = usePathname()

  if (pathname?.startsWith("/admin") || DEV_AUTH_BYPASS || DASHBOARD_TEST_MODE) {
    return <ClerkEnabledContext.Provider value={false}>{children}</ClerkEnabledContext.Provider>
  }

  return (
    <ClerkEnabledContext.Provider value={true}>
      <ClerkProvider
        publishableKey={publishableKey}
        domain={CLERK_DOMAIN}
        isSatellite={CLERK_IS_SATELLITE}
        signInUrl={CLERK_SIGN_IN_URL}
        signUpUrl={CLERK_SIGN_UP_URL}
        signInFallbackRedirectUrl={CLERK_AFTER_SIGN_IN_URL}
        signUpFallbackRedirectUrl={CLERK_AFTER_SIGN_UP_URL}
      >
        {children}
      </ClerkProvider>
    </ClerkEnabledContext.Provider>
  )
}

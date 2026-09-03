"use client"

import * as React from "react"
import { useUser, useClerk } from "@clerk/nextjs"
import { useProfile } from "@/components/profile-provider"
import { DEV_AUTH_BYPASS, DEV_BYPASS_USER } from "@/lib/dev-auth-bypass"

export type AuthUser = {
  userId: string
  email: string
  firstName: string
  lastName: string
  imageUrl: string
  isLoaded: boolean
}

type AuthContextType = {
  user: AuthUser | null
  isSignedIn: boolean
  isLoaded: boolean
  signOut: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextType>({
  user: null,
  isSignedIn: false,
  isLoaded: false,
  signOut: async () => {},
})

export function useAuth() {
  return React.useContext(AuthContext)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Two components, not one branch: under the bypass ClerkProvider isn't in
  // the tree at all (see app/layout.tsx), so Clerk's hooks would throw before
  // clerk-js even got the chance to fail its domain check. The flag is a
  // module-level constant, so the same component mounts for the app's lifetime.
  if (DEV_AUTH_BYPASS) return <BypassAuthProvider>{children}</BypassAuthProvider>
  return <ClerkAuthProvider>{children}</ClerkAuthProvider>
}

function BypassAuthProvider({ children }: { children: React.ReactNode }) {
  const { fetchProfile } = useProfile()

  React.useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const value = React.useMemo(
    () => ({
      user: { ...DEV_BYPASS_USER, isLoaded: true },
      isSignedIn: true,
      isLoaded: true,
      signOut: async () => {},
    }),
    [],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function ClerkAuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isSignedIn, isLoaded } = useUser()
  const { signOut: clerkSignOut } = useClerk()
  const { fetchProfile } = useProfile()
  const lastFetchedUserId = React.useRef<string | null>(null)

  const authUser: AuthUser | null = React.useMemo(() => {
    if (!user) return null
    return {
      userId: user.id,
      email: user.primaryEmailAddress?.emailAddress ?? "",
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
      imageUrl: user.imageUrl ?? "",
      isLoaded: true,
    }
  }, [user])

  // Auto-fetch profile when user signs in (matches old dashboard behavior)
  React.useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn || !user?.id) {
      lastFetchedUserId.current = null
      return
    }
    if (lastFetchedUserId.current !== user.id) {
      lastFetchedUserId.current = user.id
      fetchProfile()
    }
  }, [isLoaded, isSignedIn, user?.id, fetchProfile])

  const signOut = React.useCallback(async () => {
    // Clear any cached data from localStorage
    if (typeof window !== "undefined") {
      localStorage.removeItem("worldstreet_temp_pin")
    }
    const redirectUrl = typeof window !== "undefined" && window.location.hostname === "localhost"
      ? `${window.location.origin}/login`
      : "https://www.worldstreetgold.com/login"
    await clerkSignOut({ redirectUrl })
  }, [clerkSignOut])

  const value = React.useMemo(
    () => ({
      user: authUser,
      isSignedIn: isSignedIn ?? false,
      isLoaded,
      signOut,
    }),
    [authUser, isSignedIn, isLoaded, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

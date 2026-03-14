"use client"

import * as React from "react"
import { useUser, useClerk } from "@clerk/nextjs"
import { useProfile } from "@/components/profile-provider"

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
    await clerkSignOut()
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

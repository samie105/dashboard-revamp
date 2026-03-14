"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  fetchProfile as fetchProfileAction,
  updateProfile as updateProfileAction,
  type ProfileData,
} from "@/lib/profile-actions"

// ── Context ──────────────────────────────────────────────────────────────

interface ProfileContextType {
  profile: ProfileData | null
  profileLoading: boolean
  profileError: string | null
  fetchProfile: () => Promise<void>
  updateProfile: (updates: Parameters<typeof updateProfileAction>[0]) => Promise<boolean>
}

const ProfileContext = React.createContext<ProfileContextType>({
  profile: null,
  profileLoading: false,
  profileError: null,
  fetchProfile: async () => {},
  updateProfile: async () => false,
})

export function useProfile() {
  return React.useContext(ProfileContext)
}

// ── Provider ─────────────────────────────────────────────────────────────

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = React.useState<ProfileData | null>(null)
  const [profileLoading, setProfileLoading] = React.useState(false)
  const [profileError, setProfileError] = React.useState<string | null>(null)
  const router = useRouter()

  const fetchProfile = React.useCallback(async () => {
    try {
      setProfileLoading(true)
      setProfileError(null)

      const data = await fetchProfileAction()

      if (data.success && data.profile) {
        setProfile(data.profile)
      } else {
        const err = data.error ?? "Failed to load profile"
        setProfileError(err)
        // Server says the session is invalid — force redirect to login
        if (err === "Unauthorized") {
          router.replace("/login")
        }
      }
    } catch {
      setProfileError("Network error loading profile")
    } finally {
      setProfileLoading(false)
    }
  }, [router])

  const updateProfile = React.useCallback(
    async (updates: Parameters<typeof updateProfileAction>[0]): Promise<boolean> => {
      try {
        setProfileError(null)
        const data = await updateProfileAction(updates)

        if (data.success && data.profile) {
          setProfile(data.profile)
          return true
        }
        setProfileError(data.error ?? "Failed to update profile")
        return false
      } catch {
        setProfileError("Network error updating profile")
        return false
      }
    },
    [],
  )

  const value = React.useMemo(
    () => ({ profile, profileLoading, profileError, fetchProfile, updateProfile }),
    [profile, profileLoading, profileError, fetchProfile, updateProfile],
  )

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

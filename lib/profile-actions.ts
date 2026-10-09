"use server"

import { auth, currentUser } from "@clerk/nextjs/server"
import { connectDB } from "@/lib/mongodb"
import DashboardProfile from "@/models/DashboardProfile"
import { DEV_AUTH_BYPASS } from "@/lib/dev-auth-bypass"
import { isCountry, isTimezone, normalizeUsername, usernameProblem } from "@/lib/profile-fields"
import {
  getDevMockProfile,
  updateDevMockProfile,
  addDevMockOnboarding,
} from "@/lib/dev-mock-data"

// ── Types ────────────────────────────────────────────────────────────────

export type ProfileData = {
  _id: string
  authUserId: string
  email: string
  displayName: string
  username?: string
  country: string
  timezone: string
  avatarUrl: string
  bio: string
  preferredCurrency: string
  watchlist: string[]
  defaultChartInterval: string
  notifications: {
    priceAlerts: boolean
    tradeConfirmations: boolean
    marketNews: boolean
    email: boolean
    push: boolean
  }
  theme: "light" | "dark" | "system"
  dashboardLayout: "vertical" | "horizontal"
  savedBankDetails: { bankName: string; accountNumber: string; accountName: string; isDefault?: boolean }[]
  onboardingCompleted: string[]
  createdAt: string
  updatedAt: string
}

export type ProfileResult = {
  success: boolean
  profile?: ProfileData
  error?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────

function toPlain(doc: unknown): ProfileData {
  const obj = (doc as { toObject?: () => Record<string, unknown> }).toObject
    ? (doc as { toObject: () => Record<string, unknown> }).toObject()
    : (doc as Record<string, unknown>)
  return {
    ...obj,
    _id: String(obj._id),
    createdAt: obj.createdAt instanceof Date ? obj.createdAt.toISOString() : String(obj.createdAt ?? ""),
    updatedAt: obj.updatedAt instanceof Date ? obj.updatedAt.toISOString() : String(obj.updatedAt ?? ""),
  } as ProfileData
}


export async function fetchProfile(): Promise<ProfileResult> {
  // Dev-only bypass (inert in production builds — see lib/dev-auth-bypass.ts):
  // Clerk auth() has no session on localhost and the profile lives in Mongo,
  // so serve the in-memory mock profile instead.
  if (DEV_AUTH_BYPASS) {
    return { success: true, profile: getDevMockProfile() }
  }

  try {
    let userId: string | null = null
    try {
      const authResult = await auth()
      userId = authResult.userId
    } catch {
      return { success: false, error: "Unauthorized" }
    }

    if (!userId) return { success: false, error: "Unauthorized" }

    await connectDB()

    // Always check MongoDB first — avoids calling Clerk API for returning users
    const existing = await DashboardProfile.findOne({ authUserId: userId })
    if (existing) {
      return { success: true, profile: toPlain(existing) }
    }

    // New user — try to get details from Clerk to seed the profile
    let email = ""
    let displayName = ""
    let avatarUrl = ""

    try {
      const clerkUser = await currentUser()
      if (clerkUser) {
        email = clerkUser.emailAddresses[0]?.emailAddress ?? ""
        displayName = `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim()
        avatarUrl = clerkUser.imageUrl ?? ""

        // Guard against email collision from a different auth provider
        if (email) {
          const emailCollision = await DashboardProfile.findOne({ email: email.toLowerCase() })
          if (emailCollision) {
            return { success: false, error: "A profile with this email already exists" }
          }
        }
      }
    } catch (clerkErr) {
      // Clerk API unreachable — still create a minimal profile so the user can proceed
      console.warn("[fetchProfile] currentUser() failed, creating minimal profile:", clerkErr)
    }

    const profile = await DashboardProfile.create({
      authUserId: userId,
      email,
      displayName,
      avatarUrl,
    })

    return { success: true, profile: toPlain(profile) }
  } catch (error) {
    console.error("[fetchProfile] Error:", error)
    return { success: false, error: "Internal server error" }
  }
}

export async function updateProfile(
  updates: Partial<Pick<ProfileData, "displayName" | "username" | "country" | "timezone" | "avatarUrl" | "bio" | "preferredCurrency" | "watchlist" | "defaultChartInterval" | "notifications" | "theme" | "dashboardLayout" | "onboardingCompleted">>,
): Promise<ProfileResult> {
  // Username, country and time zone are checked here, not just on the page:
  // the page's rules are a convenience, this is the guard.
  if (updates.username !== undefined) {
    const problem = usernameProblem(updates.username)
    if (problem) return { success: false, error: `Username: ${problem}` }
    updates = { ...updates, username: normalizeUsername(updates.username) }
  }
  if (updates.country !== undefined && !isCountry(updates.country)) return { success: false, error: "Pick a country from the list." }
  if (updates.timezone !== undefined && !isTimezone(updates.timezone)) return { success: false, error: "Pick a time zone from the list." }

  // Dev-only bypass (inert in production builds — see lib/dev-auth-bypass.ts)
  if (DEV_AUTH_BYPASS) {
    return { success: true, profile: updateDevMockProfile(updates) as ProfileData }
  }

  try {
    const { userId } = await auth()
    if (!userId) return { success: false, error: "Unauthorized" }

    const allowedFields = [
      "displayName", "username", "country", "timezone", "avatarUrl", "bio", "preferredCurrency",
      "watchlist", "defaultChartInterval", "notifications",
      "theme", "dashboardLayout", "onboardingCompleted",
    ] as const

    const safe: Record<string, unknown> = {}
    const unset: Record<string, ""> = {}
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        safe[field] = updates[field]
      }
    }
    // Clearing a username REMOVES the field rather than storing "" — an empty
    // string would count as a value under the unique index, and the second
    // person to clear theirs would collide with the first.
    if (safe.username === "") {
      delete safe.username
      unset.username = ""
    }

    if (Object.keys(safe).length === 0 && Object.keys(unset).length === 0) {
      return { success: false, error: "No valid fields to update" }
    }

    await connectDB()

    let profile
    try {
      profile = await DashboardProfile.findOneAndUpdate(
        { authUserId: userId },
        { ...(Object.keys(safe).length ? { $set: safe } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) },
        { new: true, runValidators: true },
      )
    } catch (err) {
      // Mongo's duplicate-key error: the unique username index said no.
      if ((err as { code?: number }).code === 11000) return { success: false, error: "That username is taken." }
      throw err
    }

    if (!profile) return { success: false, error: "Profile not found" }

    return { success: true, profile: toPlain(profile) }
  } catch (error) {
    console.error("[updateProfile] Error:", error)
    return { success: false, error: "Internal server error" }
  }
}

/**
 * Mark a specific onboarding flow as completed for the current user.
 * Uses $addToSet so duplicates are ignored automatically.
 */
export async function markOnboardingComplete(
  key: string,
): Promise<{ success: boolean; error?: string }> {
  // Dev-only bypass (inert in production builds — see lib/dev-auth-bypass.ts)
  if (DEV_AUTH_BYPASS) {
    addDevMockOnboarding(key)
    return { success: true }
  }

  try {
    const { userId } = await auth()
    if (!userId) return { success: false, error: "Unauthorized" }

    await connectDB()

    const result = await DashboardProfile.findOneAndUpdate(
      { authUserId: userId },
      { $addToSet: { onboardingCompleted: key } },
    )

    if (!result) return { success: false, error: "Profile not found" }
    return { success: true }
  } catch (error) {
    console.error("[markOnboardingComplete] Error:", error)
    return { success: false, error: "Internal server error" }
  }
}

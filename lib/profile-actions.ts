"use server"

import { auth, currentUser } from "@clerk/nextjs/server"
import { connectDB } from "@/lib/mongodb"
import DashboardProfile from "@/models/DashboardProfile"

// ── Types ────────────────────────────────────────────────────────────────

export type ProfileData = {
  _id: string
  authUserId: string
  email: string
  displayName: string
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

// ── Server Actions ───────────────────────────────────────────────────────

export async function fetchProfile(): Promise<ProfileResult> {
  try {
    let userId: string | null = null
    try {
      const authResult = await auth()
      userId = authResult.userId
    } catch {
      // auth() itself failed — treat as unauthenticated
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
  updates: Partial<Pick<ProfileData, "displayName" | "avatarUrl" | "bio" | "preferredCurrency" | "watchlist" | "defaultChartInterval" | "notifications" | "theme" | "dashboardLayout" | "onboardingCompleted">>,
): Promise<ProfileResult> {
  try {
    const { userId } = await auth()
    if (!userId) return { success: false, error: "Unauthorized" }

    const allowedFields = [
      "displayName", "avatarUrl", "bio", "preferredCurrency",
      "watchlist", "defaultChartInterval", "notifications",
      "theme", "dashboardLayout", "onboardingCompleted",
    ] as const

    const safe: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        safe[field] = updates[field]
      }
    }

    if (Object.keys(safe).length === 0) {
      return { success: false, error: "No valid fields to update" }
    }

    await connectDB()

    const profile = await DashboardProfile.findOneAndUpdate(
      { authUserId: userId },
      { $set: safe },
      { new: true, runValidators: true },
    )

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

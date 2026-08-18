/**
 * Clerk Auth Helper
 *
 * Provides a consistent `getAuthUser()` function for API routes,
 * replacing the old cookie-based `verifyToken()` pattern.
 */

import { auth, currentUser } from "@clerk/nextjs/server"
import { UserWallet } from "@/models/UserWallet"
import { connectDB } from "@/lib/mongodb"

export interface AuthUser {
  userId: string
  email: string
  firstName: string
  lastName: string
  privy_type?: number // 0 = old privy, 1 = new privy
}

/**
 * Get the authenticated Clerk user in a server context (API routes, server components).
 * Returns null if not authenticated.
 * Optionally fetches privy_type from database if fetchPrivyType is true.
 */
export async function getAuthUser(fetchPrivyType: boolean = false): Promise<AuthUser | null> {
  const { userId } = await auth()
  if (!userId) return null

  const user = await currentUser()
  if (!user) return null

  let privy_type: number | undefined

  if (fetchPrivyType) {
    try {
      await connectDB()
      const userWallet = await UserWallet.findOne({ clerkUserId: userId })
      privy_type = userWallet?.privy_type
    } catch (error) {
      console.error("[Auth] Error fetching privy_type:", error)
    }
  }

  return {
    userId: user.id,
    email: user.emailAddresses[0]?.emailAddress || "",
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    privy_type,
  }
}

/**
 * Clerk Auth Helper
 *
 * Provides a consistent `getAuthUser()` function for API routes,
 * replacing the old cookie-based `verifyToken()` pattern.
 */

import { auth, currentUser } from "@clerk/nextjs/server"
import { UserWallet } from "@/models/UserWallet"
import { connectDB } from "@/lib/mongodb"
import { DEV_AUTH_BYPASS, DEV_BYPASS_USER } from "@/lib/dev-auth-bypass"
import { SERVER_DASHBOARD_TEST_MODE, DASHBOARD_TEST_USER } from "@/lib/dashboard-test-mode"

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
  // Dev-only bypass (inert in production builds — see lib/dev-auth-bypass.ts)
  if (DEV_AUTH_BYPASS) {
    return {
      userId: DEV_BYPASS_USER.userId,
      email: DEV_BYPASS_USER.email,
      firstName: DEV_BYPASS_USER.firstName,
      lastName: DEV_BYPASS_USER.lastName,
    }
  }

  if (SERVER_DASHBOARD_TEST_MODE) {
    return {
      userId: DASHBOARD_TEST_USER.userId,
      email: DASHBOARD_TEST_USER.email,
      firstName: DASHBOARD_TEST_USER.firstName,
      lastName: DASHBOARD_TEST_USER.lastName,
    }
  }

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

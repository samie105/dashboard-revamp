/**
 * Clerk Auth Helper
 *
 * Provides a consistent `getAuthUser()` function for API routes,
 * replacing the old cookie-based `verifyToken()` pattern.
 */

import { auth, currentUser } from "@clerk/nextjs/server"

export interface AuthUser {
  userId: string
  email: string
  firstName: string
  lastName: string
}

/**
 * Get the authenticated Clerk user in a server context (API routes, server components).
 * Returns null if not authenticated.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  const { userId } = await auth()
  if (!userId) return null

  const user = await currentUser()
  if (!user) return null

  return {
    userId: user.id,
    email: user.emailAddresses[0]?.emailAddress || "",
    firstName: user.firstName || "",
    lastName: user.lastName || "",
  }
}

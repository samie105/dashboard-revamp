import { auth } from "@clerk/nextjs/server"
import { NextRequest } from "next/server"

/**
 * Verify Clerk session and get JWT token.
 * Works with Clerk session cookies - no Authorization header needed.
 */
export async function verifyClerkJWT(request: NextRequest) {
  try {
    const { userId, getToken } = await auth()

    if (!userId) {
      throw new Error("Unauthorized - No user session found")
    }

    const token = await getToken()

    if (!token) {
      console.warn("No Clerk token available, using userId as identifier")
      return {
        userId,
        token: userId,
      }
    }

    return {
      userId,
      token,
    }
  } catch (error) {
    console.error("Clerk auth error:", error)
    throw new Error("Invalid or expired session")
  }
}

/**
 * Get current user from Clerk session
 */
export async function getCurrentUser() {
  const { userId } = await auth()

  if (!userId) {
    throw new Error("Not authenticated")
  }

  return { userId }
}

import { auth } from "@clerk/nextjs/server"
import { NextRequest } from "next/server"
import { DEV_AUTH_BYPASS, DEV_BYPASS_USER } from "@/lib/dev-auth-bypass"

/**
 * Verify Clerk session and get JWT token.
 * Works with Clerk session cookies - no Authorization header needed.
 */
export async function verifyClerkJWT(request: NextRequest) {
  // Dev-only bypass (inert in production builds — see lib/dev-auth-bypass.ts).
  // External services will reject this token; callers get empty/error states.
  if (DEV_AUTH_BYPASS) {
    return { userId: DEV_BYPASS_USER.userId, token: "dev-bypass-token" }
  }

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
  // Dev-only bypass (inert in production builds — see lib/dev-auth-bypass.ts)
  if (DEV_AUTH_BYPASS) {
    return { userId: DEV_BYPASS_USER.userId }
  }

  const { userId } = await auth()

  if (!userId) {
    throw new Error("Not authenticated")
  }

  return { userId }
}

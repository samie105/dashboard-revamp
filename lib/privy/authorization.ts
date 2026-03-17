/**
 * Privy Authorization Context Utilities
 *
 * Authenticates with Privy using the user's Clerk JWT to obtain
 * a per-session authorization key for wallet operations.
 */

export interface AuthorizationContext {
  authorization_private_keys?: string[]
  user_jwts?: string[]
}

/**
 * Create authorization context for Privy wallet operations.
 *
 * Uses the Clerk JWT directly via `user_jwts` — the same pattern used
 * successfully in bridge-actions.ts and the chain-specific send functions.
 */
export async function createAuthorizationContext(
  clerkJwt: string,
): Promise<AuthorizationContext> {
  if (!clerkJwt) {
    throw new Error("Clerk JWT is required for Privy authorization")
  }

  return {
    user_jwts: [clerkJwt],
  }
}

/**
 * Validate authorization context has the required key
 */
export function validateAuthorizationContext(
  context: AuthorizationContext,
): boolean {
  return !!(
    context &&
    ((context.authorization_private_keys &&
      context.authorization_private_keys.length > 0 &&
      context.authorization_private_keys[0]) ||
      (context.user_jwts &&
        context.user_jwts.length > 0 &&
        context.user_jwts[0]))
  )
}

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
 * The Node SDK accepts the external user's JWT directly in its authorization
 * context. It verifies the JWT and obtains the time-bound user signing key
 * internally, which is the supported server-side flow for custom JWT auth.
 */
export function createAuthorizationContext(clerkJwt: string): AuthorizationContext {
  if (!clerkJwt) throw new Error("Missing Clerk JWT")
  return { user_jwts: [clerkJwt] }
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

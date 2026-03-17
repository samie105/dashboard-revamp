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
 * Call Privy's authenticate endpoint with a Clerk JWT to get
 * a per-session authorization key for wallet operations.
 */
async function getUserAuthKey(clerkJwt: string): Promise<string> {
  const appId = process.env.PRIVY_APP_ID
  const appSecret = process.env.PRIVY_APP_SECRET

  if (!appId || !appSecret) {
    throw new Error("PRIVY_APP_ID or PRIVY_APP_SECRET is not set")
  }

  const authResponse = await fetch(
    "https://api.privy.io/v1/wallets/authenticate",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${appId}:${appSecret}`,
        ).toString("base64")}`,
        "Content-Type": "application/json",
        "privy-app-id": appId,
      },
      body: JSON.stringify({
        user_jwt: clerkJwt,
      }),
    },
  )

  if (!authResponse.ok) {
    const authError = await authResponse.text()
    console.error("[Privy Auth] Authentication failed:", authError)
    throw new Error(
      `Failed to authenticate with Privy: ${authResponse.status}`,
    )
  }

  const authData = await authResponse.json()
  const userKey = authData.authorization_key

  if (!userKey) {
    throw new Error(
      "No authorization key returned from Privy authentication",
    )
  }

  return userKey
}

/**
 * Create authorization context for Privy wallet operations.
 * Uses the Clerk JWT to authenticate with Privy and obtain an authorization key.
 */
export async function createAuthorizationContext(
  clerkJwt: string,
): Promise<AuthorizationContext> {
  const userKey = await getUserAuthKey(clerkJwt)
  return {
    authorization_private_keys: [userKey],
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

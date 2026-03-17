import { privyClient } from "./client"

/**
 * Create a Privy user linked to a Clerk user ID
 */
export async function createPrivyUser(clerkUserId: string): Promise<string> {
  try {
    const existingUser = await privyClient.users().getByCustomAuthID({
      custom_user_id: clerkUserId,
    })
    if (existingUser) {
      return existingUser.id
    }
  } catch {
    // User doesn't exist, continue to create
  }

  const user = await privyClient.users().create({
    linked_accounts: [
      {
        type: "custom_auth",
        custom_user_id: clerkUserId,
      },
    ],
  })

  return user.id
}

/**
 * Get Privy user by Clerk user ID
 */
export async function getPrivyUserByClerkId(clerkUserId: string) {
  const user = await privyClient.users().getByCustomAuthID({
    custom_user_id: clerkUserId,
  })
  return user
}

/**
 * Get Privy user by Privy user ID
 */
export async function getPrivyUser(privyUserId: string) {
  const user = await privyClient.users()._get(privyUserId)
  return user
}

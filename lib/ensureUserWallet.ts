import { currentUser } from "@clerk/nextjs/server"
import { connectDB } from "@/lib/mongodb"
import { UserWallet } from "@/models/UserWallet"
import { privyClient } from "@/lib/privy/client"

/**
 * Ensures a UserWallet document exists for the given clerkUserId.
 *
 * Lookup order:
 * 1. By clerkUserId in MongoDB
 * 2. By email (from Clerk) in MongoDB, then backfill clerkUserId
 * 3. Look up existing Privy user by custom_id, list wallets, create UserWallet
 * 4. Create brand new Privy user + wallets + UserWallet
 *
 * Returns the UserWallet document or null if creation fails.
 */
export async function ensureUserWallet(clerkUserId: string) {
  await connectDB()

  // 1. Try by clerkUserId
  let userWallet = await UserWallet.findOne({ clerkUserId })
  if (userWallet) {
    // Auto-populate tradingWallet from ethereum wallet if missing
    if (
      (!userWallet.tradingWallet?.walletId ||
        !userWallet.tradingWallet?.address) &&
      userWallet.wallets?.ethereum?.walletId &&
      userWallet.wallets?.ethereum?.address
    ) {
      userWallet.tradingWallet = {
        walletId: userWallet.wallets.ethereum.walletId,
        address: userWallet.wallets.ethereum.address,
        chainType: "ethereum",
        initialized: false,
      }
      await userWallet.save()
      console.log(
        "[ensureUserWallet] Auto-populated tradingWallet from ethereum:",
        userWallet.tradingWallet.address,
      )
    }
    return userWallet
  }

  // 2. Get email from Clerk
  let email: string | undefined
  try {
    const clerkUser = await currentUser()
    email = clerkUser?.emailAddresses?.[0]?.emailAddress
  } catch (e) {
    console.error(
      "[ensureUserWallet] currentUser() failed, trying clerkClient:",
      e,
    )
    try {
      const { clerkClient } = await import("@clerk/nextjs/server")
      const client = await clerkClient()
      const user = await client.users.getUser(clerkUserId)
      email = user.emailAddresses[0]?.emailAddress
    } catch (e2) {
      console.error(
        "[ensureUserWallet] clerkClient fallback also failed:",
        e2,
      )
    }
  }

  if (!email) {
    console.error(
      "[ensureUserWallet] No email found for clerk user:",
      clerkUserId,
    )
    return null
  }

  // 3. Try by email
  userWallet = await UserWallet.findOne({ email })
  if (userWallet) {
    if (!userWallet.clerkUserId || userWallet.clerkUserId !== clerkUserId) {
      userWallet.clerkUserId = clerkUserId
    }
    // Auto-populate tradingWallet
    if (
      (!userWallet.tradingWallet?.walletId ||
        !userWallet.tradingWallet?.address) &&
      userWallet.wallets?.ethereum?.walletId &&
      userWallet.wallets?.ethereum?.address
    ) {
      userWallet.tradingWallet = {
        walletId: userWallet.wallets.ethereum.walletId,
        address: userWallet.wallets.ethereum.address,
        chainType: "ethereum",
        initialized: false,
      }
    }
    await userWallet.save()
    console.log(
      "[ensureUserWallet] Found by email, backfilled clerkUserId for:",
      email,
    )
    return userWallet
  }

  // 4. No DB record — find or create Privy user
  console.log(
    "[ensureUserWallet] No wallet in DB, looking up Privy user for:",
    email,
  )

  let privyUser: any = null

  // 4a. Try to find existing Privy user by custom_id (Clerk user ID)
  try {
    privyUser = await privyClient.users().getByCustomAuthID({ custom_user_id: clerkUserId })
    console.log(
      "[ensureUserWallet] Found existing Privy user by custom_id:",
      privyUser.id,
    )
  } catch {
    // Not found by custom ID, try creating
  }

  // 4b. Create if not found
  if (!privyUser) {
    try {
      privyUser = await privyClient.users().create({
        linked_accounts: [
          { type: "custom_auth", custom_user_id: clerkUserId },
          { type: "email", address: email },
        ],
        wallets: [{ chain_type: "ethereum" }, { chain_type: "solana" }],
      })
      console.log(
        "[ensureUserWallet] Created new Privy user:",
        privyUser.id,
      )
    } catch (error: any) {
      if (
        error.message?.includes("Input conflict") ||
        error.status === 422
      ) {
        // Extract DID from error and fall back
        const conflictMatch = error.message?.match(/did:privy:[a-z0-9]+/i)
        const existingDid = conflictMatch?.[0]
        if (existingDid) {
          try {
            privyUser = await privyClient.users()._get(existingDid)
            console.log(
              "[ensureUserWallet] Retrieved conflict user:",
              existingDid,
            )
          } catch (e2) {
            console.error(
              "[ensureUserWallet] Failed to get conflict user:",
              existingDid,
              e2,
            )
            return null
          }
        } else {
          console.error(
            "[ensureUserWallet] Conflict but no DID in error:",
            error.message,
          )
          return null
        }
      } else {
        console.error(
          "[ensureUserWallet] Privy user creation failed:",
          error.message,
        )
        return null
      }
    }
  }

  if (!privyUser) return null

  // 5. List wallets from Privy (reliable, unlike parsing linked_accounts)
  const wallets: Record<string, any> = {}
  for (const chainType of ["ethereum", "solana"]) {
    try {
      const walletList: any[] = []
      for await (const w of privyClient.wallets().list({
        user_id: privyUser.id,
        chain_type: chainType as any,
      })) {
        walletList.push(w)
      }
      if (walletList.length > 0) {
        const w = walletList[0]
        wallets[chainType] = {
          walletId: w.id,
          address: w.address,
          publicKey: w.public_key || null,
        }
        console.log(
          `[ensureUserWallet] Found ${chainType} wallet:`,
          w.address,
        )
      }
    } catch (e) {
      console.error(
        `[ensureUserWallet] Failed to list ${chainType} wallets:`,
        e,
      )
    }
  }

  // Build tradingWallet (unified = ethereum)
  const tradingWallet = wallets.ethereum
    ? {
        walletId: wallets.ethereum.walletId,
        address: wallets.ethereum.address,
        chainType: "ethereum",
        initialized: false,
      }
    : undefined

  userWallet = await UserWallet.findOneAndUpdate(
    { email },
    {
      email,
      clerkUserId,
      privyUserId: privyUser.id,
      wallets,
      ...(tradingWallet && { tradingWallet }),
    },
    { upsert: true, new: true },
  )

  console.log(
    "[ensureUserWallet] Created wallet for:",
    email,
    "address:",
    tradingWallet?.address,
  )
  return userWallet
}

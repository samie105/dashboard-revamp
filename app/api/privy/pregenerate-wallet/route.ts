import { NextRequest, NextResponse } from "next/server"
import { PrivyClient } from "@privy-io/node"
import { UserWallet } from "@/models/UserWallet"
import { connectDB } from "@/lib/mongodb"
import { auth } from "@clerk/nextjs/server"

const privy = new PrivyClient({
  appId: process.env.PRIVY_APP_ID!,
  appSecret: process.env.PRIVY_APP_SECRET!,
})

const basicAuth = Buffer.from(
  `${process.env.PRIVY_APP_ID}:${process.env.PRIVY_APP_SECRET}`,
).toString("base64")

export async function POST(request: NextRequest) {
  try {
    const { userId: authUserId, getToken } = await auth()
    const clerkToken = await getToken()

    const { email } = await request.json()

    if (!email || !authUserId || !clerkToken) {
      return NextResponse.json(
        { error: "Authentication and email are required" },
        { status: 400 },
      )
    }

    const clerkUserId = authUserId

    await connectDB()

    // Fetch a Privy user by DID — SDK first, HTTP fallback
    const getExistingUser = async (did: string) => {
      try {
        return await privy.users()._get(did)
      } catch {
        const res = await fetch(`https://api.privy.io/v1/users/${encodeURIComponent(did)}`, {
          method: "GET",
          headers: {
            Authorization: `Basic ${basicAuth}`,
            "privy-app-id": process.env.PRIVY_APP_ID!,
            "privy-user-jwt": clerkToken,
          },
        })
        if (!res.ok) {
          const text = await res.text()
          throw new Error(`Privy API failed: ${res.status} - ${text}`)
        }
        return await res.json()
      }
    }

    // 1. Check DB
    let userWallet = await UserWallet.findOne({ email })
    if (userWallet?.privyUserId) {
      try {
        const verified = await getExistingUser(userWallet.privyUserId)
        if (verified) {
          return NextResponse.json({
            success: true,
            privyUserId: userWallet.privyUserId,
            wallets: userWallet.wallets,
            tradingWallet: userWallet.tradingWallet ?? null,
          })
        }
      } catch {
        // DB record stale — fall through to create/get
      }
    }

    // 2. Create or resolve conflict
    let privyUser
    try {
      privyUser = await privy.users().create({
        linked_accounts: [
          { type: "custom_auth", custom_user_id: clerkUserId },
          { type: "email", address: email },
        ],
        wallets: [
          { chain_type: "ethereum" },
          { chain_type: "solana" },
          { chain_type: "sui" },
          { chain_type: "ton" },
          { chain_type: "tron" },
        ],
      })
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : ""
      if (msg.includes("Input conflict") || (error as { status?: number }).status === 422) {
        const match = msg.match(/did:privy:[a-z0-9]+/i)
        const existingDid = match?.[0] ?? (error as { cause?: string }).cause ?? null
        if (existingDid) {
          privyUser = await getExistingUser(existingDid)
        } else {
          throw error
        }
      } else {
        throw error
      }
    }

    // 3. Extract wallets
    const wallets: Record<string, { walletId: string; address: string; publicKey: string | null }> = {}
    const chainTypes = ["ethereum", "solana", "sui", "ton", "tron"] as const
    const accounts: Array<Record<string, string>> =
      (privyUser as Record<string, unknown>).linkedAccounts as Array<Record<string, string>> ??
      (privyUser as Record<string, unknown>).linked_accounts as Array<Record<string, string>> ??
      []

    for (const chain of chainTypes) {
      const wallet = accounts.find(
        (a) => a.type === "wallet" && (a.chainType === chain || a.chain_type === chain),
      )
      if (wallet) {
        wallets[chain] = {
          walletId: wallet.id,
          address: wallet.address,
          publicKey: wallet.publicKey ?? wallet.public_key ?? null,
        }
      }
    }

    // 4. Upsert DB
    userWallet = await UserWallet.findOneAndUpdate(
      { email },
      { email, clerkUserId, privyUserId: (privyUser as { id: string }).id, wallets },
      { upsert: true, new: true },
    )

    return NextResponse.json({
      success: true,
      privyUserId: (privyUser as { id: string }).id,
      wallets: userWallet.wallets,
      tradingWallet: userWallet.tradingWallet ?? null,
    })
  } catch (error: unknown) {
    console.error("[Privy Pregenerate] Error:", error)
    return NextResponse.json(
      { error: "Failed to process wallet request", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    )
  }
}

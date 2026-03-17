import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { UserWallet } from "@/models/UserWallet"
import { connectDB } from "@/lib/mongodb"

/**
 * POST /api/privy/link-clerk
 * Link Clerk user ID to existing Privy wallet
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 },
      )
    }

    const { clerkClient } = await import("@clerk/nextjs/server")
    const client = await clerkClient()
    const user = await client.users.getUser(userId)
    const email = user.emailAddresses[0]?.emailAddress

    if (!email) {
      return NextResponse.json(
        { error: "No email found for user" },
        { status: 400 },
      )
    }

    await connectDB()

    const userWallet = await UserWallet.findOne({ email })

    if (!userWallet) {
      return NextResponse.json(
        {
          error: "Wallet not found for this email",
          hint: "Call /api/privy/get-wallet first to create wallets",
        },
        { status: 404 },
      )
    }

    userWallet.clerkUserId = userId
    await userWallet.save()

    console.log(
      "[Privy Link] Linked Clerk user",
      userId,
      "to Privy wallet",
    )

    return NextResponse.json({
      success: true,
      message: "Clerk user linked to Privy wallet",
      clerkUserId: userId,
      privyUserId: userWallet.privyUserId,
      wallets: userWallet.wallets,
    })
  } catch (error: any) {
    console.error("Link Clerk error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to link Clerk user" },
      { status: 500 },
    )
  }
}

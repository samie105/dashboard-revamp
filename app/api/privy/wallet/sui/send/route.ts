import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { sendSui } from "@/lib/privy/sui"
import { UserWallet } from "@/models/UserWallet"
import { connectDB } from "@/lib/mongodb"

/**
 * POST /api/privy/wallet/sui/send
 * Send SUI from user's Privy wallet using Clerk authentication
 */
export async function POST(request: NextRequest) {
  try {
    console.log("[Sui Send] Starting transaction request")

    const { userId, getToken } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized - No active session found" },
        { status: 401 },
      )
    }

    const clerkJwt = await getToken()
    if (!clerkJwt) {
      return NextResponse.json(
        { error: "Authentication token not available" },
        { status: 401 },
      )
    }

    let requestBody
    try {
      requestBody = await request.json()
    } catch (parseError) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      )
    }

    const { to, amount } = requestBody

    if (!to || !amount) {
      return NextResponse.json(
        { error: "Missing required fields: to, amount" },
        { status: 400 },
      )
    }

    if (!/^0x[a-fA-F0-9]{64}$/.test(to)) {
      return NextResponse.json(
        { error: "Invalid Sui address format" },
        { status: 400 },
      )
    }

    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        { error: "Invalid amount - must be a positive number" },
        { status: 400 },
      )
    }

    const { clerkClient } = await import("@clerk/nextjs/server")
    const client = await clerkClient()
    const clerkUser = await client.users.getUser(userId)
    const email = clerkUser.emailAddresses[0]?.emailAddress

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
        { error: "Wallet not found for this user" },
        { status: 404 },
      )
    }

    if (!userWallet.wallets?.sui) {
      return NextResponse.json(
        { error: "Sui wallet not found" },
        { status: 404 },
      )
    }

    const walletId = userWallet.wallets.sui.walletId

    if (!walletId) {
      return NextResponse.json(
        { error: "Sui wallet ID not found in database" },
        { status: 500 },
      )
    }

    const result = await sendSui(
      walletId,
      to,
      amount.toString(),
      clerkJwt,
    )

    return NextResponse.json({
      success: true,
      digest: result.digest,
      status: result.status,
      from: userWallet.wallets.sui.address,
      to,
      amount: amountNum,
      explorerUrl: `https://suiscan.xyz/mainnet/tx/${result.digest}`,
    })
  } catch (error: any) {
    console.error("[Sui Send] Unexpected error:", error)

    if (error.message?.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Authentication failed", details: error.message },
        { status: 401 },
      )
    }

    return NextResponse.json(
      {
        error: "Failed to send SUI transaction",
        details: error.message || "An unexpected error occurred",
      },
      { status: 500 },
    )
  }
}

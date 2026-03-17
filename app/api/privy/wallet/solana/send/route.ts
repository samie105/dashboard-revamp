import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { sendSol } from "@/lib/privy/solana"
import { UserWallet } from "@/models/UserWallet"
import { connectDB } from "@/lib/mongodb"

/**
 * POST /api/privy/wallet/solana/send
 * Send SOL from user's Privy wallet using Clerk authentication
 */
export async function POST(request: NextRequest) {
  try {
    console.log("[Solana Send] Starting transaction request")

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

    if (typeof to !== "string" || to.length < 32 || to.length > 44) {
      return NextResponse.json(
        { error: "Invalid Solana address format" },
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

    if (!userWallet.wallets?.solana) {
      return NextResponse.json(
        { error: "Solana wallet not found" },
        { status: 404 },
      )
    }

    const walletId = userWallet.wallets.solana.walletId

    if (!walletId) {
      return NextResponse.json(
        { error: "Solana wallet ID not found in database" },
        { status: 500 },
      )
    }

    const result = await sendSol(walletId, to, amount.toString(), clerkJwt)

    return NextResponse.json({
      success: true,
      signature: result.signature,
      status: result.status,
      from: userWallet.wallets.solana.address,
      to,
      amount: amountNum,
    })
  } catch (error: any) {
    console.error("[Solana Send] Unexpected error:", error)

    if (error.message?.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Authentication failed", details: error.message },
        { status: 401 },
      )
    }

    return NextResponse.json(
      {
        error: "Failed to send SOL transaction",
        details: error.message || "An unexpected error occurred",
      },
      { status: 500 },
    )
  }
}

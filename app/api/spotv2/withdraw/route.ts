import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { connectDB } from "@/lib/mongodb"
import SpotV2Ledger from "@/models/SpotV2Ledger"
import { ensureUserWallet } from "@/lib/ensureUserWallet"

const ADMIN_URL = process.env.ADMIN_BACKEND_URL
const ADMIN_KEY = process.env.ADMIN_BACKEND_API_KEY

const VALID_CHAINS = ["ethereum", "solana", "tron"] as const
const VALID_TOKENS = ["USDT", "USDC"] as const
const MIN_WITHDRAW = 5

export async function POST(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!ADMIN_URL || !ADMIN_KEY) {
      return NextResponse.json(
        { error: "Admin backend not configured" },
        { status: 503 },
      )
    }

    const body = await request.json()
    const {
      amount,
      chain = "ethereum",
      token = "USDC",
    } = body

    // Validate chain
    if (!VALID_CHAINS.includes(chain)) {
      return NextResponse.json(
        { error: "Invalid chain. Supported: ethereum, solana, tron" },
        { status: 400 },
      )
    }

    // Validate token
    if (!VALID_TOKENS.includes(token)) {
      return NextResponse.json(
        { error: "Invalid token. Supported: USDT, USDC" },
        { status: 400 },
      )
    }

    // Validate amount
    if (
      !amount ||
      typeof amount !== "number" ||
      amount < MIN_WITHDRAW
    ) {
      return NextResponse.json(
        { error: `Minimum withdrawal is ${MIN_WITHDRAW} ${token}` },
        { status: 400 },
      )
    }

    await connectDB()

    // Check ledger balance
    const ledger = await SpotV2Ledger.findOne({
      userId: clerkUserId,
      token: "USDC",
    })

    if (!ledger || ledger.available < amount) {
      return NextResponse.json(
        {
          error: `Insufficient balance. Available: ${(ledger?.available ?? 0).toFixed(2)} USDC`,
        },
        { status: 400 },
      )
    }

    // Get user wallet address on the target chain
    const userWallet = await ensureUserWallet(clerkUserId)
    if (!userWallet) {
      return NextResponse.json(
        { error: "Wallet not found. Please refresh the page." },
        { status: 404 },
      )
    }

    const destinationAddress =
      chain === "solana"
        ? userWallet.wallets?.solana?.address
        : chain === "tron"
          ? userWallet.wallets?.tron?.address
          : userWallet.wallets?.ethereum?.address

    if (!destinationAddress) {
      return NextResponse.json(
        { error: `No ${chain} wallet found for your account` },
        { status: 404 },
      )
    }

    // Debit ledger first (atomic decrement)
    const updated = await SpotV2Ledger.findOneAndUpdate(
      {
        userId: clerkUserId,
        token: "USDC",
        available: { $gte: amount },
      },
      { $inc: { available: -amount } },
      { new: true },
    )

    if (!updated) {
      return NextResponse.json(
        { error: "Insufficient balance or concurrent withdrawal" },
        { status: 400 },
      )
    }

    // Create a deposit request on admin to trigger disbursement to user's wallet
    // The admin uses the deposit flow: we create a "completed" deposit that triggers disbursement
    try {
      const adminRes = await fetch(`${ADMIN_URL}/api/deposits`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ADMIN_KEY,
        },
        body: JSON.stringify({
          userId: clerkUserId,
          userWalletAddress: destinationAddress,
          walletType: "spot",
          chain,
          requestedToken: token,
          requestedAmount: amount,
          depositChain: chain,
          depositToken: token,
          depositAmount: amount,
          depositFromAddress: "platform-withdrawal",
        }),
      })

      if (!adminRes.ok) {
        // Rollback ledger debit
        await SpotV2Ledger.findOneAndUpdate(
          { userId: clerkUserId, token: "USDC" },
          { $inc: { available: amount } },
        )

        const errData = await adminRes.json().catch(() => ({}))
        console.error("[SpotV2 Withdraw] Admin error:", errData)
        return NextResponse.json(
          { error: errData.message || "Failed to process withdrawal" },
          { status: 500 },
        )
      }

      const adminData = await adminRes.json()

      return NextResponse.json({
        success: true,
        withdrawal: {
          amount,
          token,
          chain,
          destination: destinationAddress,
          adminDepositId: adminData.deposit?._id || adminData.depositId,
          newBalance: updated.available,
        },
      })
    } catch (adminError) {
      // Rollback ledger debit on admin call failure
      await SpotV2Ledger.findOneAndUpdate(
        { userId: clerkUserId, token: "USDC" },
        { $inc: { available: amount } },
      )

      console.error("[SpotV2 Withdraw] Admin call failed:", adminError)
      return NextResponse.json(
        { error: "Failed to process withdrawal. Please try again." },
        { status: 500 },
      )
    }
  } catch (error: unknown) {
    console.error("[SpotV2 Withdraw] Error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}

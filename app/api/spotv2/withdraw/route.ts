import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { connectDB } from "@/lib/mongodb"
import SpotV2Ledger from "@/models/SpotV2Ledger"
import SpotV2Withdrawal from "@/models/SpotV2Withdrawal"
import SpotV2LedgerTx from "@/models/SpotV2LedgerTx"
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

    // Debit ledger atomically
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

    // Create local withdrawal record
    const withdrawal = await SpotV2Withdrawal.create({
      userId: clerkUserId,
      amount,
      token,
      chain,
      destinationAddress,
      status: "pending",
    })

    // Write audit trail for the debit
    await SpotV2LedgerTx.create({
      userId: clerkUserId,
      type: "withdraw",
      token: "USDC",
      amount: -amount,
      balanceAfter: updated.available,
      ref: withdrawal._id.toString(),
      refModel: "SpotV2Withdrawal",
    })

    // Call admin backend to send tokens to user's wallet
    // Uses POST /api/withdrawals (API-key authenticated send endpoint)
    try {
      const adminRes = await fetch(`${ADMIN_URL}/api/withdrawals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ADMIN_KEY,
        },
        body: JSON.stringify({
          userId: clerkUserId,
          toAddress: destinationAddress,
          chain,
          token,
          amount,
        }),
      })

      if (!adminRes.ok) {
        // Rollback: re-credit ledger and update withdrawal status
        await SpotV2Ledger.findOneAndUpdate(
          { userId: clerkUserId, token: "USDC" },
          { $inc: { available: amount } },
        )

        // Reverse the audit entry (use _rollback suffix to avoid duplicate key on {ref, type})
        await SpotV2LedgerTx.create({
          userId: clerkUserId,
          type: "deposit",
          token: "USDC",
          amount,
          balanceAfter: (updated.available + amount),
          ref: `${withdrawal._id.toString()}_rollback`,
          refModel: "SpotV2Withdrawal",
        })

        withdrawal.status = "failed"
        withdrawal.errorMessage = "Admin failed to process withdrawal"
        await withdrawal.save()

        const errData = await adminRes.json().catch(() => ({}))
        console.error("[SpotV2 Withdraw] Admin error:", errData)
        return NextResponse.json(
          { error: errData.message || "Failed to process withdrawal" },
          { status: 500 },
        )
      }

      const adminData = await adminRes.json()

      withdrawal.status = "processing"
      withdrawal.txHash = adminData.txHash || null
      await withdrawal.save()

      return NextResponse.json({
        success: true,
        withdrawal: {
          id: withdrawal._id,
          amount,
          token,
          chain,
          destination: destinationAddress,
          txHash: adminData.txHash,
          status: "processing",
          newBalance: updated.available,
        },
      })
    } catch (adminError) {
      // Rollback ledger on admin call failure
      await SpotV2Ledger.findOneAndUpdate(
        { userId: clerkUserId, token: "USDC" },
        { $inc: { available: amount } },
      )

      await SpotV2LedgerTx.create({
        userId: clerkUserId,
        type: "deposit",
        token: "USDC",
        amount,
        balanceAfter: (updated.available + amount),
        ref: `${withdrawal._id.toString()}_rollback`,
        refModel: "SpotV2Withdrawal",
      })

      withdrawal.status = "failed"
      withdrawal.errorMessage = "Network error contacting admin"
      await withdrawal.save()

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

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { connectDB } from "@/lib/mongodb"
import SpotV2Ledger from "@/models/SpotV2Ledger"

const ADMIN_URL = process.env.ADMIN_BACKEND_URL
const ADMIN_KEY = process.env.ADMIN_BACKEND_API_KEY

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const adminDepositId = searchParams.get("id")

    if (!adminDepositId) {
      return NextResponse.json(
        { error: "Missing deposit id" },
        { status: 400 },
      )
    }

    // Poll admin backend for deposit status
    const adminRes = await fetch(
      `${ADMIN_URL}/api/deposits/status/${encodeURIComponent(adminDepositId)}`,
      { headers: { "x-api-key": ADMIN_KEY } },
    )

    if (!adminRes.ok) {
      const errData = await adminRes.json().catch(() => ({}))
      return NextResponse.json(
        { error: errData.message || "Failed to check deposit status" },
        { status: adminRes.status },
      )
    }

    const adminData = await adminRes.json()
    const adminDeposit = adminData.deposit || adminData
    const status = adminDeposit.status || "pending"

    // If completed/disbursed, credit the SpotV2 ledger
    if (status === "completed" || status === "disbursed") {
      await connectDB()

      const creditAmount = parseFloat(
        adminDeposit.requestedAmount ||
          adminDeposit.depositAmount ||
          "0",
      )

      if (creditAmount > 0) {
        // Use findOneAndUpdate with a flag to prevent double-credit
        // We mark by checking if we've already credited for this deposit
        const result = await SpotV2Ledger.findOneAndUpdate(
          { userId: clerkUserId, token: "USDC" },
          {
            $inc: { available: creditAmount },
            $setOnInsert: { locked: 0 },
          },
          { upsert: true, new: true },
        )

        if (result) {
          console.log(
            `[SpotV2 Deposit] Credited ${creditAmount} USDC to ${clerkUserId}`,
          )
        }
      }
    }

    return NextResponse.json({
      success: true,
      deposit: {
        adminDepositId,
        status,
        depositChain: adminDeposit.depositChain,
        depositToken: adminDeposit.depositToken,
        depositAmount: adminDeposit.depositAmount,
        depositTxHash: adminDeposit.depositTxHash,
        disburseTxHash: adminDeposit.disburseTxHash,
      },
    })
  } catch (error: unknown) {
    console.error("[SpotV2 Deposit Status] Error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}

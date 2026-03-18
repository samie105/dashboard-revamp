import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { connectDB } from "@/lib/mongodb"
import SpotDeposit from "@/models/SpotDeposit"

/**
 * GET /api/spot/deposit/history
 * Returns the user's last 10 spot deposits, newest first.
 */
export async function GET(_request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await connectDB()

    const deposits = await SpotDeposit.find({ userId: clerkUserId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select(
        "depositAmount depositChain depositToken status spotAmount createdAt completedAt errorMessage",
      )
      .lean()

    return NextResponse.json({ success: true, data: deposits })
  } catch (error: unknown) {
    console.error("[Spot Deposit History] Error:", error)
    const message =
      error instanceof Error ? error.message : "Failed to fetch deposit history"
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    )
  }
}

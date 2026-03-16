import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { connectDB } from "@/lib/mongodb"
import SpotDeposit from "@/models/SpotDeposit"

export async function POST(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { depositId } = await request.json()
    if (!depositId) {
      return NextResponse.json(
        { error: "depositId required" },
        { status: 400 },
      )
    }

    await connectDB()

    const deposit = await SpotDeposit.findOne({
      _id: depositId,
      userId: clerkUserId,
    })

    if (!deposit) {
      return NextResponse.json(
        { error: "Deposit not found" },
        { status: 404 },
      )
    }

    const cancellableStatuses = ["initiated", "sending_usdt"]
    if (!cancellableStatuses.includes(deposit.status)) {
      return NextResponse.json(
        { error: "Deposit cannot be cancelled in its current state" },
        { status: 400 },
      )
    }

    deposit.status = "failed"
    deposit.errorMessage = "Cancelled by user"
    await deposit.save()

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[Spot Deposit Cancel] Error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to cancel deposit" },
      { status: 500 },
    )
  }
}

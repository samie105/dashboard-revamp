import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { connectDB } from "@/lib/mongodb"
import Withdrawal from "@/models/Withdrawal"

// ── GET /api/withdraw/status/[id] ──────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await connectDB()

    const { id } = await params
    const withdrawal = await Withdrawal.findOne({ _id: id, userId })
      .select(
        "usdtAmount fiatAmount fiatCurrency exchangeRate chain status txHash txVerified txVerifiedAt bankDetails payoutReference createdAt completedAt",
      )
      .lean()

    if (!withdrawal) {
      return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      withdrawal: {
        ...(withdrawal as unknown as Record<string, unknown>),
        _id: String((withdrawal as unknown as Record<string, unknown>)._id),
      },
    })
  } catch (err) {
    console.error("Withdrawal status error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ── PATCH /api/withdraw/status/[id] — Cancel ───────────────────────────────

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await connectDB()

    const { id } = await params
    const withdrawal = await Withdrawal.findOne({ _id: id, userId })

    if (!withdrawal) {
      return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 })
    }

    if (withdrawal.status !== "pending") {
      return NextResponse.json({ error: "Can only cancel pending withdrawals" }, { status: 400 })
    }

    withdrawal.status = "cancelled"
    await withdrawal.save()

    return NextResponse.json({ success: true, message: "Withdrawal cancelled" })
  } catch (err) {
    console.error("Withdrawal cancel error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

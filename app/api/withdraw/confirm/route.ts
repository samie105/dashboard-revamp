import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { connectDB } from "@/lib/mongodb"
import Withdrawal from "@/models/Withdrawal"

// ── POST /api/withdraw/confirm — User submits txHash ───────────────────────

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await connectDB()

    const body = await req.json()
    const { withdrawalId, txHash } = body

    if (!withdrawalId || !txHash) {
      return NextResponse.json({ error: "withdrawalId and txHash are required" }, { status: 400 })
    }

    const withdrawal = await Withdrawal.findOne({ _id: withdrawalId, userId })

    if (!withdrawal) {
      return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 })
    }

    if (withdrawal.status !== "pending") {
      return NextResponse.json(
        { error: `Withdrawal is already in status: ${withdrawal.status}` },
        { status: 400 },
      )
    }

    withdrawal.txHash = txHash
    withdrawal.status = "usdt_sent"
    await withdrawal.save()

    // Fire-and-forget verification trigger
    try {
      const verifyUrl = new URL("/api/withdraw/verify", req.url)
      fetch(verifyUrl.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withdrawalId: withdrawal._id.toString() }),
      }).catch(() => {})
    } catch {
      // Ignore — verification will be retried
    }

    return NextResponse.json({
      success: true,
      message: "Transaction hash recorded. Verification in progress.",
      withdrawal: {
        id: withdrawal._id.toString(),
        status: withdrawal.status,
        txHash: withdrawal.txHash,
      },
    })
  } catch (err) {
    console.error("Withdrawal confirm error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

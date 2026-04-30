import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { connectDB } from "@/lib/mongodb"
import Deposit from "@/models/Deposit"

// ── GET /api/deposit/lookup?tx_ref=WS-DEP-xxx ─────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const txRef = searchParams.get("tx_ref")

    if (!txRef) {
      return NextResponse.json({ success: false, message: "tx_ref is required" }, { status: 400 })
    }

    await connectDB()

    const deposit = await Deposit.findOne({
      flutterwaveReference: txRef,
      userId,
    }).lean()

    if (!deposit) {
      return NextResponse.json({ success: false, message: "Deposit not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, deposit })
  } catch (error) {
    console.error("GET /api/deposit/lookup error:", error)
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 })
  }
}

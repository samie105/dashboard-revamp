import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { connectDB } from "@/lib/mongodb"
import Deposit from "@/models/Deposit"

// ── GET /api/deposit/status/[id] ───────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    await connectDB()

    const deposit = await Deposit.findOne({ _id: id, userId }).lean()

    if (!deposit) {
      return NextResponse.json({ success: false, message: "Deposit not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, deposit })
  } catch (error) {
    console.error("GET /api/deposit/status/[id] error:", error)
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 })
  }
}

// ── PATCH /api/deposit/status/[id] — Cancel ────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    if (body.action !== "cancel") {
      return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 })
    }

    await connectDB()

    const deposit = await Deposit.findOne({ _id: id, userId })

    if (!deposit) {
      return NextResponse.json({ success: false, message: "Deposit not found" }, { status: 404 })
    }

    if (!["pending", "awaiting_verification", "payment_failed"].includes(deposit.status)) {
      return NextResponse.json(
        { success: false, message: `Cannot cancel deposit in ${deposit.status} state` },
        { status: 400 },
      )
    }

    deposit.status = "cancelled"
    await deposit.save()

    return NextResponse.json({ success: true, deposit: deposit.toObject() })
  } catch (error) {
    console.error("PATCH /api/deposit/status/[id] error:", error)
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 })
  }
}

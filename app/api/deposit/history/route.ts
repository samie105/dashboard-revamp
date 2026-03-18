import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { connectDB } from "@/lib/mongodb"
import Deposit from "@/models/Deposit"

// GET /api/deposit/history — return user's last 20 deposits

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    await connectDB()

    const deposits = await Deposit.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()

    return NextResponse.json({ success: true, deposits })
  } catch (error) {
    console.error("GET /api/deposit/history error:", error)
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 })
  }
}

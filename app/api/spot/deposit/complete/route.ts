import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { connectDB } from "@/lib/mongodb"
import { completeDeposit } from "@/lib/spot/completeDeposit"

export async function POST(request: NextRequest) {
  try {
    const { userId: clerkUserId, getToken } = await auth()
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

    const clerkJwt = await getToken()
    if (!clerkJwt) {
      return NextResponse.json(
        { error: "Auth token required" },
        { status: 401 },
      )
    }

    await connectDB()

    const result = await completeDeposit({
      depositId,
      clerkUserId,
      clerkJwt,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("[Spot Deposit Complete] Error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { connectDB } from "@/lib/mongodb"
import { UserWallet } from "@/models/UserWallet"
import { HttpTransport, InfoClient } from "@nktkas/hyperliquid"

export async function GET(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await connectDB()

    const userWallet = await UserWallet.findOne({ clerkUserId })
    if (!userWallet?.tradingWallet?.address) {
      return NextResponse.json({ success: true, data: [] })
    }

    const address = userWallet.tradingWallet.address as `0x${string}`
    const transport = new HttpTransport({ isTestnet: false })
    const info = new InfoClient({ transport })

    const openOrders = await info.frontendOpenOrders({ user: address })

    return NextResponse.json({ success: true, data: openOrders })
  } catch (error: any) {
    console.error("[HL Open Orders] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch open orders",
      },
      { status: 500 },
    )
  }
}

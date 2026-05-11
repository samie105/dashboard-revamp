import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { connectDB } from "@/lib/mongodb"
import { UserWallet } from "@/models/UserWallet"
import { getGmxPositions } from "@/lib/gmx/actions"

export async function GET(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    await connectDB()

    const userWallet = await UserWallet.findOne({ clerkUserId })
    if (!userWallet?.tradingWallet?.address) {
      return NextResponse.json({ success: true, data: [] })
    }

    const account = userWallet.tradingWallet.address
    const positions = await getGmxPositions(account)

    // Serialize BigInt values for JSON
    const serialized = positions.map((p) => ({
      ...p,
      sizeInUsd: p.sizeInUsd.toString(),
      sizeInTokens: p.sizeInTokens.toString(),
      collateralAmount: p.collateralAmount.toString(),
      averageEntryPrice: p.averageEntryPrice.toString(),
      liquidationPrice: p.liquidationPrice.toString(),
      pnl: p.pnl.toString(),
      pendingPnl: p.pendingPnl.toString(),
    }))

    return NextResponse.json({ success: true, data: serialized })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch GMX positions"
    console.error("[GMX Positions] Error:", err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

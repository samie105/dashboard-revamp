import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { connectDB } from "@/lib/mongodb"
import { UserWallet } from "@/models/UserWallet"
import { HttpTransport, InfoClient } from "@nktkas/hyperliquid"

export async function GET() {
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = await (info as any).clearinghouseState({ user: address })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const positions = (state?.assetPositions ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((ap: any) => Number(ap?.position?.szi ?? 0) !== 0)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((ap: any) => ({
        coin: ap.position.coin,
        szi: ap.position.szi,
        entryPx: ap.position.entryPx,
        positionValue: ap.position.positionValue,
        unrealizedPnl: ap.position.unrealizedPnl,
        returnOnEquity: ap.position.returnOnEquity,
        liquidationPx: ap.position.liquidationPx ?? null,
        leverage: ap.position.leverage ?? null,
        marginUsed: ap.position.marginUsed,
      }))

    return NextResponse.json({ success: true, data: positions })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch positions"
    console.error("[HL Positions] Error:", error)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

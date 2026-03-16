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

    const [fills, spotMeta] = await Promise.all([
      info.userFills({ user: address }),
      info.spotMeta(),
    ])

    const coinNameMap: Record<string, string> = {}
    for (const entry of spotMeta.universe) {
      const baseToken = spotMeta.tokens[entry.tokens[0]]
      const quoteToken = spotMeta.tokens[entry.tokens[1]]
      if (baseToken && quoteToken) {
        const humanName = `${baseToken.name}/${quoteToken.name}`
        coinNameMap[entry.name] = humanName
        coinNameMap[humanName] = humanName
      }
    }

    const enrichedFills = fills.map((fill: any) => ({
      ...fill,
      coinDisplay: coinNameMap[fill.coin] || fill.coin,
    }))

    return NextResponse.json({ success: true, data: enrichedFills })
  } catch (error: any) {
    console.error("[HL Fills] Error:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch fills" },
      { status: 500 },
    )
  }
}

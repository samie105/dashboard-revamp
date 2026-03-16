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

    const [orders, spotMeta] = await Promise.all([
      info.historicalOrders({ user: address }),
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

    const enrichedOrders = (orders as any[]).map((order: any) => {
      const orderData = order.order || order
      return {
        ...order,
        order: {
          ...orderData,
          coinDisplay: coinNameMap[orderData.coin] || orderData.coin,
        },
      }
    })

    return NextResponse.json({ success: true, data: enrichedOrders })
  } catch (error: any) {
    console.error("[HL Order History] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch order history",
      },
      { status: 500 },
    )
  }
}

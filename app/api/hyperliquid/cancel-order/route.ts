import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { ensureUserWallet } from "@/lib/ensureUserWallet"
import { privyClient } from "@/lib/privy/client"
import { createViemAccount } from "@privy-io/node/viem"
import { createAuthorizationContext } from "@/lib/privy/authorization"
import { HttpTransport, ExchangeClient, InfoClient } from "@nktkas/hyperliquid"

export async function POST(request: NextRequest) {
  try {
    const { userId: clerkUserId, getToken } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const clerkJwt = await getToken()
    if (!clerkJwt) {
      return NextResponse.json({ error: "No auth token" }, { status: 401 })
    }

    const { coin, orderId } = await request.json()

    if (!coin || !orderId) {
      return NextResponse.json(
        { error: "coin and orderId are required" },
        { status: 400 },
      )
    }

    const userWallet = await ensureUserWallet(clerkUserId)
    if (!userWallet?.tradingWallet?.walletId) {
      return NextResponse.json(
        {
          error:
            "Wallet setup failed. Please refresh the page and try again.",
        },
        { status: 404 },
      )
    }

    const transport = new HttpTransport({ isTestnet: false })
    const info = new InfoClient({ transport })

    const [meta, spotMeta] = await Promise.all([
      info.meta(),
      info.spotMeta(),
    ])

    let assetIndex = -1

    const baseToken = spotMeta.tokens.find((t: any) => t.name === coin)
    if (baseToken) {
      const universeEntry = spotMeta.universe.find(
        (u: any) => u.tokens[0] === baseToken.index,
      )
      if (universeEntry) {
        assetIndex = 10000 + universeEntry.index
      }
    }

    if (assetIndex === -1) {
      const universeEntry = spotMeta.universe.find(
        (u: any) => u.name === coin || u.name === `${coin}/USDC`,
      )
      if (universeEntry) {
        assetIndex = 10000 + universeEntry.index
      }
    }

    if (assetIndex === -1) {
      const perpIdx = meta.universe.findIndex((m: any) => m.name === coin)
      if (perpIdx !== -1) {
        assetIndex = perpIdx
      }
    }

    if (assetIndex === -1) {
      return NextResponse.json(
        { error: `Asset ${coin} not found on Hyperliquid` },
        { status: 400 },
      )
    }

    const authContext = await createAuthorizationContext(clerkJwt)

    const viemAccount = createViemAccount(privyClient, {
      walletId: userWallet.tradingWallet.walletId,
      address: userWallet.tradingWallet.address as `0x${string}`,
      authorizationContext: authContext,
    })

    const exchange = new ExchangeClient({ transport, wallet: viemAccount })

    const result = await exchange.cancel({
      cancels: [{ a: assetIndex, o: Number(orderId) }],
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    console.error("[HL Cancel Order] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to cancel order",
      },
      { status: 500 },
    )
  }
}

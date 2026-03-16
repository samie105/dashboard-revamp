import { NextRequest, NextResponse } from "next/server"
import { hyperliquid } from "@/lib/hyperliquid/simple"
import { UserWallet } from "@/models/UserWallet"
import { connectDB } from "@/lib/mongodb"
import { auth, currentUser } from "@clerk/nextjs/server"
import { HttpTransport, InfoClient } from "@nktkas/hyperliquid"

export async function GET(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await connectDB()

    let userWallet = await UserWallet.findOne({ clerkUserId })

    if (!userWallet) {
      const user = await currentUser()
      const email = user?.primaryEmailAddress?.emailAddress

      if (email) {
        userWallet = await UserWallet.findOne({ email })

        if (userWallet && !userWallet.clerkUserId) {
          userWallet.clerkUserId = clerkUserId
          await userWallet.save()
        }
      }
    }

    if (!userWallet) {
      return NextResponse.json(
        {
          error:
            "No wallet record found in database. Please ensure your wallet is initialized.",
          code: "WALLET_NOT_FOUND",
        },
        { status: 404 },
      )
    }

    let address = ""
    let addressSource = ""

    if (userWallet.tradingWallet?.address) {
      address = userWallet.tradingWallet.address
      addressSource = "trading_wallet"
    } else if (userWallet.wallets?.ethereum?.address) {
      address = userWallet.wallets.ethereum.address
      addressSource = "main_ethereum_wallet"
    }

    if (!address) {
      return NextResponse.json(
        {
          error: "No Ethereum or Trading address found for user",
          code: "ADDRESS_NOT_FOUND",
        },
        { status: 404 },
      )
    }

    const transport = new HttpTransport({ isTestnet: false })
    const info = new InfoClient({ transport })

    const [accountState, spotAccountState, spotMeta, allMids] =
      (await Promise.all([
        hyperliquid.getAccount(address),
        hyperliquid.getSpotAccount(address),
        info.spotMeta(),
        info.allMids(),
      ])) as [any, any, any, Record<string, string>]

    const coinToMidKey: Record<string, string> = {}
    for (const entry of spotMeta?.universe ?? []) {
      const baseTokenIdx = entry.tokens[0]
      const baseToken = spotMeta.tokens[baseTokenIdx]
      if (baseToken?.name) {
        coinToMidKey[baseToken.name] = entry.name
      }
    }

    const spotBalances = spotAccountState?.balances || []
    const usdcSpotBalance = spotBalances.find(
      (balance: any) => balance.coin === "USDC",
    )

    const balances = spotBalances.map((balance: any) => {
      const coin = balance.coin
      const total = parseFloat(balance.total || "0")
      const hold = parseFloat(balance.hold || "0")
      const available = total - hold
      const entryNtl = parseFloat(balance.entryNtl || "0")

      let currentPrice = 0
      if (coin === "USDC") {
        currentPrice = 1
      } else {
        const midKey = coinToMidKey[coin]
        if (midKey && allMids[midKey]) {
          currentPrice = parseFloat(allMids[midKey])
        }
      }

      const entryPrice = total > 0 && entryNtl > 0 ? entryNtl / total : 0
      const currentValue = total * currentPrice
      const unrealizedPnl =
        coin !== "USDC" && total > 0 ? currentValue - entryNtl : 0
      const unrealizedPnlPercent =
        coin !== "USDC" && entryNtl > 0
          ? ((currentValue - entryNtl) / entryNtl) * 100
          : 0

      return {
        coin,
        total,
        available,
        hold,
        entryNtl,
        entryPrice,
        currentPrice,
        currentValue,
        unrealizedPnl,
        unrealizedPnlPercent,
      }
    })

    const accountValue =
      accountState?.crossMarginSummary?.accountValue || "0"
    const withdrawable = accountState?.withdrawable || "0"

    return NextResponse.json({
      success: true,
      data: {
        address,
        balances,
        usdcBalance: {
          total: parseFloat(usdcSpotBalance?.total || "0"),
          available:
            parseFloat(usdcSpotBalance?.total || "0") -
            parseFloat(usdcSpotBalance?.hold || "0"),
          hold: parseFloat(usdcSpotBalance?.hold || "0"),
        },
        accountValue: parseFloat(accountValue),
        withdrawable: parseFloat(withdrawable),
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error: any) {
    console.error("[Hyperliquid Balance] Error:", error)

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch Hyperliquid balance",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

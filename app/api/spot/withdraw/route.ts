import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { ensureUserWallet } from "@/lib/ensureUserWallet"
import { privyClient } from "@/lib/privy/client"
import { createAuthorizationContext } from "@/lib/privy/authorization"
import { usdClassTransfer } from "@/lib/hyperliquid/usdTransfer"
import { withdrawFromHyperliquid } from "@/lib/hyperliquid/withdraw"
import { HttpTransport, InfoClient } from "@nktkas/hyperliquid"

const MIN_WITHDRAW = 1

export async function POST(request: NextRequest) {
  try {
    const { userId: clerkUserId, getToken } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const clerkJwt = await getToken()
    if (!clerkJwt) {
      return NextResponse.json(
        { error: "No auth token" },
        { status: 401 },
      )
    }

    const { amount } = await request.json()

    if (!amount || typeof amount !== "number" || amount < MIN_WITHDRAW) {
      return NextResponse.json(
        { error: `Minimum withdrawal is ${MIN_WITHDRAW} USDC` },
        { status: 400 },
      )
    }

    const userWallet = await ensureUserWallet(clerkUserId)
    if (
      !userWallet?.tradingWallet?.walletId ||
      !userWallet?.tradingWallet?.address
    ) {
      return NextResponse.json(
        {
          error:
            "Wallet setup failed. Please refresh the page and try again.",
        },
        { status: 404 },
      )
    }

    const { walletId, address: walletAddress } = userWallet.tradingWallet
    const authContext = await createAuthorizationContext(clerkJwt)

    const transport = new HttpTransport({ isTestnet: false })
    const info = new InfoClient({ transport })
    const spotState = await info.spotClearinghouseState({
      user: walletAddress as `0x${string}`,
    })

    const usdcBalance = (spotState as any)?.balances?.find(
      (b: any) => b.coin === "USDC",
    )
    const available = parseFloat(usdcBalance?.total ?? "0")

    if (available < amount) {
      return NextResponse.json(
        {
          error: `Insufficient spot USDC. Available: ${available.toFixed(2)}`,
        },
        { status: 400 },
      )
    }

    // Step 1: Move USDC from Spot → Perps
    const transferResult = await usdClassTransfer({
      privyClient,
      walletId,
      walletAddress,
      authorizationContext: authContext,
      amount,
      toPerp: true,
    })

    if (!transferResult.success) {
      return NextResponse.json(
        {
          error:
            transferResult.error ||
            "Failed to move USDC from Spot to Perps",
        },
        { status: 500 },
      )
    }

    // Step 2: Withdraw from HL Perps → Arb trading wallet
    const withdrawResult = await withdrawFromHyperliquid({
      privyClient,
      walletId,
      walletAddress,
      authorizationContext: authContext,
      destination: walletAddress,
      amount,
    })

    if (!withdrawResult.success) {
      // Rollback Step 1
      console.error(
        "[Spot Withdraw] withdraw3 failed, rolling back Spot→Perps transfer",
      )
      try {
        await usdClassTransfer({
          privyClient,
          walletId,
          walletAddress,
          authorizationContext: authContext,
          amount,
          toPerp: false,
        })
      } catch (rollbackErr: any) {
        console.error(
          `[Spot Withdraw] CRITICAL: Rollback also failed. ${amount} USDC may be stuck in Perps.`,
          rollbackErr,
        )
      }
      return NextResponse.json(
        {
          error:
            withdrawResult.error ||
            "HL withdrawal failed. Funds returned to Spot.",
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      amount,
      destination: walletAddress,
      data: withdrawResult.data,
    })
  } catch (err: any) {
    console.error("[Spot Withdraw] Error:", err)
    return NextResponse.json(
      { error: err.message || "Withdrawal failed" },
      { status: 500 },
    )
  }
}

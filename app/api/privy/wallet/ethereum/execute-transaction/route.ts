import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { sendEthereumTransaction } from "@/lib/privy/ethereum"
import { UserWallet } from "@/models/UserWallet"
import { connectDB } from "@/lib/mongodb"

/**
 * POST /api/privy/wallet/ethereum/execute-transaction
 * Execute a generic Ethereum transaction from user's Privy wallet
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, getToken } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      )
    }

    const clerkJwt = await getToken()
    if (!clerkJwt) {
      return NextResponse.json(
        { error: "Authentication token not available" },
        { status: 401 },
      )
    }

    const {
      to,
      value,
      data,
      chainId,
      gasLimit,
    } = await request.json()

    if (!to || !chainId) {
      return NextResponse.json(
        { error: "Missing required fields: to, chainId" },
        { status: 400 },
      )
    }

    await connectDB()

    let userWallet = await UserWallet.findOne({ clerkUserId: userId })

    if (!userWallet) {
      const { currentUser } = await import("@clerk/nextjs/server")
      const clerkUser = await currentUser()
      const email = clerkUser?.emailAddresses[0]?.emailAddress
      if (email) {
        userWallet = await UserWallet.findOne({ email })
        if (userWallet && !userWallet.clerkUserId) {
          userWallet.clerkUserId = userId
          await userWallet.save()
        }
      }
    }

    if (!userWallet) {
      return NextResponse.json(
        { error: "User wallet record not found" },
        { status: 404 },
      )
    }

    const walletId =
      userWallet.tradingWallet?.walletId ||
      userWallet.wallets?.ethereum?.walletId

    if (!walletId) {
      return NextResponse.json(
        { error: "No Ethereum wallet initialized for this user" },
        { status: 404 },
      )
    }

    const activeChainId = Number(chainId)

    console.log(
      `[Execute Transaction] Routing from ${userWallet.tradingWallet?.address || "main"} on chain ${activeChainId}`,
    )

    const result = await sendEthereumTransaction(
      walletId,
      {
        to,
        value: value,
        data: data,
        chain_id: activeChainId,
        gas: gasLimit,
      },
      clerkJwt,
    )

    return NextResponse.json({
      success: true,
      transactionHash: result.transactionHash,
      status: result.status,
    })
  } catch (error: any) {
    console.error("[Execute Transaction] Error:", error)
    return NextResponse.json(
      {
        error: "Failed to execute transaction",
        details: error.message,
      },
      { status: 500 },
    )
  }
}

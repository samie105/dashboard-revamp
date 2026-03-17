import { NextRequest, NextResponse } from "next/server"
import { verifyClerkJWT } from "@/lib/auth/clerk"
import { sendTrx } from "@/lib/privy/tron"
import { UserWallet } from "@/models/UserWallet"
import { connectDB } from "@/lib/mongodb"

/**
 * POST /api/privy/wallet/tron/send
 * Send TRX from user's wallet
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, token } = await verifyClerkJWT(request)

    const { to, amount } = await request.json()

    if (!to || !amount) {
      return NextResponse.json(
        { error: "Missing required fields: to, amount" },
        { status: 400 },
      )
    }

    if (!/^T[a-zA-Z0-9]{33}$/.test(to)) {
      return NextResponse.json(
        { error: "Invalid Tron address" },
        { status: 400 },
      )
    }

    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        { error: "Invalid amount" },
        { status: 400 },
      )
    }

    await connectDB()

    const userWallet = await UserWallet.findOne({ clerkUserId: userId })
    if (!userWallet?.wallets.tron) {
      return NextResponse.json(
        { error: "Tron wallet not found" },
        { status: 404 },
      )
    }

    const walletId = userWallet.wallets.tron.walletId

    const result = await sendTrx(walletId, to, amount, token)

    return NextResponse.json({
      success: true,
      txid: result.txid,
      status: result.status,
      explorerUrl: `https://tronscan.org/#/transaction/${result.txid}`,
    })
  } catch (error: any) {
    console.error("Tron send error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to send TRX" },
      { status: 500 },
    )
  }
}

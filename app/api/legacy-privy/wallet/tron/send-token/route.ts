import { NextRequest, NextResponse } from "next/server"
import { verifyClerkJWT } from "@/lib/auth/clerk"
import { sendTronTransaction } from "@/lib/privy/tron"
import { UserWallet } from "@/models/UserWallet"
import { connectDB } from "@/lib/mongodb"

/** Isolated legacy TRC-20 compatibility route. The contract amount is sent in
 * the token's smallest units; the legacy token registry currently stores the
 * six-decimal TRC-20 assets supported by this wallet surface. */
export async function POST(request: NextRequest) {
  try {
    const { userId, token } = await verifyClerkJWT(request)
    const { to, amount, contractAddress } = await request.json()
    if (!/^T[a-zA-Z0-9]{33}$/.test(to ?? "") || !/^T[a-zA-Z0-9]{33}$/.test(contractAddress ?? "")) return NextResponse.json({ error: "Invalid Tron address" }, { status: 400 })
    const numericAmount = Number(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return NextResponse.json({ error: "Invalid amount" }, { status: 400 })
    await connectDB()
    const wallet = (await UserWallet.findOne({ clerkUserId: userId }))?.wallets?.tron
    if (!wallet?.walletId) return NextResponse.json({ error: "Tron wallet not found" }, { status: 404 })
    const result = await sendTronTransaction(wallet.walletId, { to, amount: Math.floor(numericAmount * 1e6), tokenAddress: contractAddress }, token)
    return NextResponse.json({ success: true, txid: result.txid, status: result.status, explorerUrl: `https://tronscan.org/#/transaction/${result.txid}` })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to send token" }, { status: 500 })
  }
}

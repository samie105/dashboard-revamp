import { NextRequest, NextResponse } from "next/server"
import { verifyClerkJWT } from "@/lib/auth/clerk"
import { UserWallet } from "@/models/UserWallet"
import { connectDB } from "@/lib/mongodb"
import { sendEth } from "@/lib/privy/ethereum"
import { sendSol } from "@/lib/privy/solana"
import { sendSui } from "@/lib/privy/sui"
import { sendTon } from "@/lib/privy/ton"
import { sendTrx } from "@/lib/privy/tron"

type ChainType = "ethereum" | "solana" | "sui" | "ton" | "tron"

/**
 * POST /api/privy/wallet/send
 * Unified endpoint to send native tokens on any supported chain
 *
 * Request body:
 * {
 *   chain: "ethereum" | "solana" | "sui" | "ton" | "tron",
 *   to: string,        // Recipient address
 *   amount: string     // Amount in native token (ETH, SOL, SUI, TON, TRX)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, token } = await verifyClerkJWT(request)

    const { chain, to, amount } = await request.json()

    if (!chain || !to || !amount) {
      return NextResponse.json(
        { error: "Missing required fields: chain, to, amount" },
        { status: 400 },
      )
    }

    const validChains: ChainType[] = [
      "ethereum",
      "solana",
      "sui",
      "ton",
      "tron",
    ]
    if (!validChains.includes(chain)) {
      return NextResponse.json(
        {
          error: `Invalid chain. Must be one of: ${validChains.join(", ")}`,
        },
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
    if (!userWallet?.wallets[chain]) {
      return NextResponse.json(
        { error: `${chain} wallet not found` },
        { status: 404 },
      )
    }

    const walletId = userWallet.wallets[chain].walletId

    let result
    switch (chain) {
      case "ethereum":
        if (!/^0x[a-fA-F0-9]{40}$/.test(to)) {
          return NextResponse.json(
            { error: "Invalid Ethereum address" },
            { status: 400 },
          )
        }
        result = await sendEth(walletId, to, amount, token)
        return NextResponse.json({
          success: true,
          chain: "ethereum",
          transactionHash: result.transactionHash,
          status: result.status,
          explorerUrl: `https://etherscan.io/tx/${result.transactionHash}`,
        })

      case "solana":
        if (to.length < 32 || to.length > 44) {
          return NextResponse.json(
            { error: "Invalid Solana address" },
            { status: 400 },
          )
        }
        result = await sendSol(walletId, to, amount, token)
        return NextResponse.json({
          success: true,
          chain: "solana",
          signature: result.signature,
          status: result.status,
          explorerUrl: `https://solscan.io/tx/${result.signature}`,
        })

      case "sui":
        if (!/^0x[a-fA-F0-9]{64}$/.test(to)) {
          return NextResponse.json(
            { error: "Invalid Sui address" },
            { status: 400 },
          )
        }
        result = await sendSui(walletId, to, amount, token)
        return NextResponse.json({
          success: true,
          chain: "sui",
          digest: result.digest,
          status: result.status,
          explorerUrl: `https://suiscan.xyz/mainnet/tx/${result.digest}`,
        })

      case "ton":
        if (to.length < 48) {
          return NextResponse.json(
            { error: "Invalid TON address" },
            { status: 400 },
          )
        }
        result = await sendTon(walletId, to, amount, token)
        return NextResponse.json({
          success: true,
          chain: "ton",
          hash: (result as any).hash,
          status: (result as any).status,
          explorerUrl: `https://tonscan.org/tx/${(result as any).hash}`,
        })

      case "tron":
        if (!/^T[a-zA-Z0-9]{33}$/.test(to)) {
          return NextResponse.json(
            { error: "Invalid Tron address" },
            { status: 400 },
          )
        }
        result = await sendTrx(walletId, to, amount, token)
        return NextResponse.json({
          success: true,
          chain: "tron",
          txid: result.txid,
          status: result.status,
          explorerUrl: `https://tronscan.org/#/transaction/${result.txid}`,
        })

      default:
        return NextResponse.json(
          { error: "Unsupported chain" },
          { status: 400 },
        )
    }
  } catch (error: any) {
    console.error("Send transaction error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to send transaction" },
      { status: 500 },
    )
  }
}

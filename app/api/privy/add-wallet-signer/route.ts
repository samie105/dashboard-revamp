import { NextRequest, NextResponse } from "next/server"
import { PrivyClient as PrivyNodeClient } from "@privy-io/node"
import { auth } from "@clerk/nextjs/server"
import { connectDB } from "@/lib/mongodb"
import { UserWallet } from "@/models/UserWallet"

const privyNode = new PrivyNodeClient({
  appId: process.env.PRIVY_APP_ID!,
  appSecret: process.env.PRIVY_APP_SECRET!,
})

export async function POST(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const walletAuthId = process.env.PRIVY_WALLET_AUTH_ID
    if (!walletAuthId) {
      return NextResponse.json(
        { error: "PRIVY_WALLET_AUTH_ID not configured" },
        { status: 500 },
      )
    }

    await connectDB()

    const userWallet = await UserWallet.findOne({ clerkUserId })
    if (!userWallet?.privyUserId) {
      return NextResponse.json(
        { error: "No Privy user found for this account" },
        { status: 404 },
      )
    }

    const results: { walletId: string; chain: string; status: string }[] =
      []
    const chainTypes = ["ethereum", "solana"] as const

    for (const chainType of chainTypes) {
      const wallets = []
      for await (const wallet of privyNode.wallets().list({
        user_id: userWallet.privyUserId,
        chain_type: chainType,
      })) {
        wallets.push(wallet)
      }

      for (const wallet of wallets) {
        try {
          await (privyNode.wallets() as any).update(wallet.id, {
            additional_signers: [{ signer_id: walletAuthId }],
          })
          results.push({
            walletId: wallet.id,
            chain: chainType,
            status: "signer_added",
          })
        } catch (updateError: any) {
          const msg = updateError?.message || String(updateError)
          if (
            msg.includes("already") ||
            msg.includes("duplicate") ||
            msg.includes("conflict")
          ) {
            results.push({
              walletId: wallet.id,
              chain: chainType,
              status: "already_has_signer",
            })
          } else {
            results.push({
              walletId: wallet.id,
              chain: chainType,
              status: `error: ${msg}`,
            })
            console.error(
              `[Add Signer] Failed for ${chainType} wallet ${wallet.id}:`,
              msg,
            )
          }
        }
      }
    }

    return NextResponse.json({ success: true, results })
  } catch (error: any) {
    console.error("[Add Signer] Error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    )
  }
}

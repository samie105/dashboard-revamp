import { NextRequest, NextResponse } from "next/server"
import { PrivyClient } from "@privy-io/node"
import { UserWallet } from "@/models/UserWallet"
import { connectDB } from "@/lib/mongodb"

const privy = new PrivyClient({
  appId: process.env.PRIVY_APP_ID!,
  appSecret: process.env.PRIVY_APP_SECRET!,
})

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    await connectDB()

    // Look up user by email
    let user
    try {
      user = await privy.users().getByEmailAddress({ address: email })
    } catch {
      return NextResponse.json(
        { error: "User not found in Privy. Please create wallets first." },
        { status: 404 },
      )
    }

    if (!user) {
      return NextResponse.json({ error: "User data not found." }, { status: 404 })
    }

    const wallets: Record<string, { walletId: string; address: string; publicKey: string | null }> = {}
    const chainTypes = ["ethereum", "solana", "sui", "ton", "tron"] as const
    const accounts: Array<Record<string, string>> =
      (user as unknown as Record<string, unknown>).linkedAccounts as Array<Record<string, string>> ??
      (user as unknown as Record<string, unknown>).linked_accounts as Array<Record<string, string>> ??
      []

    for (const chain of chainTypes) {
      const wallet = accounts.find(
        (a) => a.type === "wallet" && (a.chainType === chain || a.chain_type === chain),
      )
      if (wallet) {
        wallets[chain] = {
          walletId: wallet.id,
          address: wallet.address,
          publicKey: wallet.publicKey ?? wallet.public_key ?? null,
        }
      }
    }

    // Update DB — preserve tradingWallet if it exists
    const userWallet = await UserWallet.findOneAndUpdate(
      { email },
      { $set: { privyUserId: user.id, wallets } },
      { upsert: true, new: true },
    )

    return NextResponse.json({
      success: true,
      privyUserId: user.id,
      wallets,
      tradingWallet: userWallet.tradingWallet ?? null,
    })
  } catch (error: unknown) {
    console.error("[Privy] Error refreshing wallet:", error)
    return NextResponse.json(
      { error: "Failed to refresh wallet data", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    )
  }
}

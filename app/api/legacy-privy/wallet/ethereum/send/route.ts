import { NextRequest, NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { sendEthereumTransaction } from "@/lib/privy/ethereum"
import { UserWallet } from "@/models/UserWallet"
import { connectDB } from "@/lib/mongodb"
import { getPrivyClient } from "@/lib/privy/client"
import { createAuthorizationContext } from "@/lib/privy/authorization"

export async function POST(request: NextRequest) {
  try {
    const { userId, getToken } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const jwt = await getToken()
    if (!jwt) return NextResponse.json({ error: "Authentication token not available" }, { status: 401 })
    const { to, amount, chain = "ethereum" } = await request.json()
    if (!/^0x[a-fA-F0-9]{40}$/.test(to ?? "")) return NextResponse.json({ error: "Invalid Ethereum address" }, { status: 400 })
    const numericAmount = Number(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return NextResponse.json({ error: "Invalid amount" }, { status: 400 })
    const clerk = await clerkClient()
    const clerkUser = await clerk.users.getUser(userId)
    const email = clerkUser.emailAddresses[0]?.emailAddress
    if (!email) return NextResponse.json({ error: "No email found for user" }, { status: 400 })
    await connectDB()
    const record = await UserWallet.findOne({ email })
    const wallet = record?.wallets?.ethereum
    if (!wallet?.walletId) return NextResponse.json({ error: "Ethereum wallet not found" }, { status: 404 })
    const chainId = chain === "arbitrum" ? 42161 : 1
    const value = BigInt(Math.floor(numericAmount * 1e18))
    const authorizationContext = createAuthorizationContext(jwt)
    const result = await sendEthereumTransaction(wallet.walletId, { to, value, chain_id: chainId }, authorizationContext, getPrivyClient(record?.privy_type ?? 0))
    return NextResponse.json({ success: true, transactionHash: result.transactionHash, status: result.status })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to send ETH" }, { status: 500 })
  }
}

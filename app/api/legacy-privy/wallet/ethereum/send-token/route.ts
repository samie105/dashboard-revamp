import { NextRequest, NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { createPublicClient, encodeFunctionData, http, parseUnits } from "viem"
import { mainnet, arbitrum } from "viem/chains"
import { sendEthereumTransaction } from "@/lib/privy/ethereum"
import { UserWallet } from "@/models/UserWallet"
import { connectDB } from "@/lib/mongodb"

const ERC20_ABI = [{ name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] }, { name: "transfer", type: "function", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] }] as const

export async function POST(request: NextRequest) {
  try {
    const { userId, getToken } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const jwt = await getToken()
    if (!jwt) return NextResponse.json({ error: "Authentication token not available" }, { status: 401 })
    const body = await request.json()
    const { to, amount, tokenAddress, chain = "ethereum" } = body
    if (!/^0x[a-fA-F0-9]{40}$/.test(to ?? "") || !/^0x[a-fA-F0-9]{40}$/.test(tokenAddress ?? "")) return NextResponse.json({ error: "Invalid Ethereum address" }, { status: 400 })
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) return NextResponse.json({ error: "Invalid amount" }, { status: 400 })
    const chainId = chain === "arbitrum" ? 42161 : 1
    const viemChain = chainId === 42161 ? arbitrum : mainnet
    const rpc = chainId === 42161 ? process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL : process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL
    const client = createPublicClient({ chain: viemChain, transport: http(rpc || undefined) })
    const decimals = await client.readContract({ address: tokenAddress as `0x${string}`, abi: ERC20_ABI, functionName: "decimals" })
    const rawAmount = parseUnits(String(amount), decimals)
    const clerk = await clerkClient()
    const clerkUser = await clerk.users.getUser(userId)
    const email = clerkUser.emailAddresses[0]?.emailAddress
    if (!email) return NextResponse.json({ error: "No email found for user" }, { status: 400 })
    await connectDB()
    const record = await UserWallet.findOne({ email })
    const wallet = record?.wallets?.ethereum
    if (!wallet?.walletId) return NextResponse.json({ error: "Ethereum wallet not found" }, { status: 404 })
    const data = encodeFunctionData({ abi: ERC20_ABI, functionName: "transfer", args: [to as `0x${string}`, rawAmount] })
    const result = await sendEthereumTransaction(wallet.walletId, { to: tokenAddress, data, chain_id: chainId }, jwt)
    return NextResponse.json({ success: true, transactionHash: result.transactionHash, status: result.status })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to send token" }, { status: 500 })
  }
}

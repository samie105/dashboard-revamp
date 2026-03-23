import { NextRequest, NextResponse } from "next/server"
import { auth, currentUser } from "@clerk/nextjs/server"
import { createPublicClient, http, parseAbi, formatUnits, formatEther, type Chain } from "viem"
import { mainnet, arbitrum } from "viem/chains"
import { connectDB } from "@/lib/mongodb"
import { UserWallet } from "@/models/UserWallet"
import SwapTransaction from "@/models/SwapTransaction"
import { privyClient } from "@/lib/privy/client"

// ── Chain mapping ────────────────────────────────────────────────────────

const CHAIN_NAME_TO_ID: Record<string, number> = {
  ethereum: 1,
  solana: 1151111081099710,
  arbitrum: 42161,
  polygon: 137,
  optimism: 10,
  bsc: 56,
  base: 8453,
}

const VIEM_CHAINS: Record<number, { chain: Chain; rpc: string }> = {
  1: { chain: mainnet, rpc: process.env.NEXT_PUBLIC_ETH_RPC || "https://cloudflare-eth.com" },
  42161: { chain: arbitrum, rpc: process.env.NEXT_PUBLIC_ARB_RPC || "https://arb1.arbitrum.io/rpc" },
}

// Token address lookups per chain
const TOKEN_ADDRESSES: Record<number, Record<string, { address: string; decimals: number }>> = {
  1: {
    ETH:  { address: "0x0000000000000000000000000000000000000000", decimals: 18 },
    USDT: { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
    USDC: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
  },
  42161: {
    ETH:  { address: "0x0000000000000000000000000000000000000000", decimals: 18 },
    USDT: { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 },
    USDC: { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
  },
}

const ERC20_ABI = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
])

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

function parseUnits(value: string, decimals: number): string {
  const [intPart = "0", fracPart = ""] = value.split(".")
  const padded = fracPart.padEnd(decimals, "0").slice(0, decimals)
  return (BigInt(intPart) * BigInt(10) ** BigInt(decimals) + BigInt(padded || "0")).toString()
}

// ── Balance checking ─────────────────────────────────────────────────────

async function getOnChainBalance(
  walletAddress: string,
  tokenAddress: string,
  chainId: number,
  decimals: number,
): Promise<number> {
  const chainConfig = VIEM_CHAINS[chainId]
  if (!chainConfig) return 0
  const client = createPublicClient({ chain: chainConfig.chain, transport: http(chainConfig.rpc) })

  if (tokenAddress === ZERO_ADDRESS) {
    const wei = await client.getBalance({ address: walletAddress as `0x${string}` })
    return parseFloat(formatEther(wei))
  }

  const raw = await client.readContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [walletAddress as `0x${string}`],
  })
  return parseFloat(formatUnits(raw, decimals))
}

// ── Receipt polling ──────────────────────────────────────────────────────

async function waitForReceipt(
  txHash: string,
  chainId: number,
  maxAttempts = 60,
  intervalMs = 3000,
): Promise<{ confirmed: boolean; success: boolean }> {
  const chainConfig = VIEM_CHAINS[chainId]
  if (!chainConfig) return { confirmed: false, success: false }
  const client = createPublicClient({ chain: chainConfig.chain, transport: http(chainConfig.rpc) })

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` })
      if (receipt) {
        return { confirmed: true, success: receipt.status === "success" }
      }
    } catch {
      // Receipt not available yet — keep polling
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return { confirmed: false, success: false }
}

function toHex(val?: string | number): string | undefined {
  if (!val) return undefined
  if (typeof val === "string" && val.startsWith("0x")) return val
  try { return `0x${BigInt(val).toString(16)}` } catch { return undefined }
}

async function getEthWallet(clerkUserId: string, email: string) {
  await connectDB()
  const userWallet = await UserWallet.findOne({ email }).lean()
  const wallets = (userWallet as Record<string, unknown>)?.wallets as
    Record<string, Record<string, string>> | undefined
  if (!wallets?.ethereum?.walletId || !wallets?.ethereum?.address) return null
  return { walletId: wallets.ethereum.walletId, address: wallets.ethereum.address, userId: clerkUserId }
}

// ── GET: Fetch LI.FI quote ───────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await currentUser()
    const email = user?.emailAddresses[0]?.emailAddress
    if (!email) return NextResponse.json({ error: "No email found" }, { status: 400 })

    const wallet = await getEthWallet(clerkUserId, email)
    if (!wallet) return NextResponse.json({ error: "Wallet not found" }, { status: 404 })

    const sp = request.nextUrl.searchParams
    const fromChainName = sp.get("fromChain") || "ethereum"
    const toChainName = sp.get("toChain") || "ethereum"
    const fromSymbol = (sp.get("fromToken") || "").toUpperCase()
    const toSymbol = (sp.get("toToken") || "").toUpperCase()
    const amount = sp.get("amount") || "0"
    const slippage = sp.get("slippage") || "0.005"

    const fromChainId = CHAIN_NAME_TO_ID[fromChainName]
    const toChainId = CHAIN_NAME_TO_ID[toChainName]
    if (!fromChainId || !toChainId) {
      return NextResponse.json({ error: `Unsupported chain: ${fromChainName} or ${toChainName}` }, { status: 400 })
    }

    const fromTokenInfo = TOKEN_ADDRESSES[fromChainId]?.[fromSymbol]
    const toTokenInfo = TOKEN_ADDRESSES[toChainId]?.[toSymbol]
    if (!fromTokenInfo || !toTokenInfo) {
      return NextResponse.json(
        { error: `Token not supported: ${fromSymbol} on chain ${fromChainId} or ${toSymbol} on chain ${toChainId}` },
        { status: 400 },
      )
    }

    const fromAmountRaw = parseUnits(amount, fromTokenInfo.decimals)

    const qs = new URLSearchParams({
      fromChain: fromChainId.toString(),
      toChain: toChainId.toString(),
      fromToken: fromTokenInfo.address,
      toToken: toTokenInfo.address,
      fromAmount: fromAmountRaw,
      fromAddress: wallet.address,
      toAddress: wallet.address,
      slippage,
      integrator: "worldstreet",
    })

    const res = await fetch(`https://li.quest/v1/quote?${qs}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return NextResponse.json(
        { error: (data as Record<string, string>).message || `LI.FI error: ${res.status}` },
        { status: 502 },
      )
    }

    const quote = await res.json()

    return NextResponse.json({
      success: true,
      quote: {
        toAmount: quote.estimate?.toAmount,
        toAmountMin: quote.estimate?.toAmountMin,
        toAmountUSD: quote.estimate?.toAmountUSD,
        fromAmountUSD: quote.estimate?.fromAmountUSD,
        priceImpact: quote.estimate?.data?.priceImpact ?? 0,
        gasCostUSD: quote.estimate?.gasCosts?.[0]?.amountUSD ?? "0",
        tool: quote.toolDetails?.name ?? quote.tool,
        toolLogoURI: quote.toolDetails?.logoURI,
        executionData: quote.transactionRequest
          ? {
              to: quote.transactionRequest.to,
              data: quote.transactionRequest.data,
              value: quote.transactionRequest.value || "0",
              chainId: quote.transactionRequest.chainId || fromChainId,
              gasLimit: quote.transactionRequest.gasLimit,
            }
          : null,
        fromToken: {
          chainId: fromChainId,
          address: fromTokenInfo.address,
          symbol: fromSymbol,
          decimals: fromTokenInfo.decimals,
        },
        toToken: {
          chainId: toChainId,
          address: toTokenInfo.address,
          symbol: toSymbol,
          decimals: toTokenInfo.decimals,
        },
      },
    })
  } catch (error) {
    console.error("[Swap Quote] Error:", error)
    return NextResponse.json({ error: "Failed to fetch quote" }, { status: 500 })
  }
}

// ── POST: Execute swap ───────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { userId: clerkUserId, getToken } = await auth()
    if (!clerkUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const clerkJwt = await getToken()
    if (!clerkJwt) return NextResponse.json({ error: "Auth token unavailable" }, { status: 401 })

    const user = await currentUser()
    const email = user?.emailAddresses[0]?.emailAddress
    if (!email) return NextResponse.json({ error: "No email found" }, { status: 400 })

    const wallet = await getEthWallet(clerkUserId, email)
    if (!wallet) return NextResponse.json({ error: "Wallet not found" }, { status: 404 })

    const body = await request.json()
    const { executionData, fromToken, toToken, fromAmount, toAmount, toAmountMin, slippage, tool, toolLogoURI } = body

    if (!executionData?.to || !executionData?.data) {
      return NextResponse.json({ error: "Missing execution data" }, { status: 400 })
    }

    // ── Server-side balance check ────────────────────────────────────────
    const fromTokenInfo = TOKEN_ADDRESSES[fromToken.chainId]?.[fromToken.symbol]
    if (!fromTokenInfo) {
      return NextResponse.json({ error: `Token ${fromToken.symbol} not supported on chain ${fromToken.chainId}` }, { status: 400 })
    }

    const numericAmount = parseFloat(fromAmount)
    if (!numericAmount || numericAmount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 })
    }

    try {
      const balance = await getOnChainBalance(wallet.address, fromTokenInfo.address, fromToken.chainId, fromTokenInfo.decimals)
      if (balance < numericAmount) {
        return NextResponse.json(
          { error: `Insufficient ${fromToken.symbol} balance. You have ${balance.toFixed(6)} but need ${numericAmount}` },
          { status: 400 },
        )
      }
    } catch (balanceErr) {
      console.error("[Swap] Balance check failed:", balanceErr)
      // If balance check fails due to RPC issues, don't block — the tx will fail on-chain anyway
    }

    // Build tx params
    const txParams: Record<string, unknown> = {
      to: executionData.to,
      value: toHex(executionData.value) || "0x0",
      data: executionData.data,
      chain_id: executionData.chainId,
    }
    if (executionData.gasLimit) {
      txParams.gas_limit = toHex(executionData.gasLimit)
    }

    // Send via Privy
    const result = await privyClient.wallets().rpc(wallet.walletId, {
      method: "eth_sendTransaction",
      caip2: `eip155:${executionData.chainId}`,
      params: { transaction: txParams },
      authorization_context: { user_jwts: [clerkJwt] },
    })

    const hash = (result as unknown as Record<string, Record<string, string>>).data?.hash
    if (!hash) {
      return NextResponse.json({ error: "No transaction hash returned" }, { status: 500 })
    }

    // Record in DB as PENDING
    await connectDB()
    const swapRecord = await SwapTransaction.create({
      userId: clerkUserId,
      txHash: hash,
      fromChain: Object.entries(CHAIN_NAME_TO_ID).find(([, v]) => v === fromToken.chainId)?.[0] ?? "ethereum",
      toChain: Object.entries(CHAIN_NAME_TO_ID).find(([, v]) => v === toToken.chainId)?.[0] ?? "ethereum",
      fromChainId: fromToken.chainId,
      toChainId: toToken.chainId,
      fromToken: { ...fromToken, name: fromToken.symbol, logoURI: undefined },
      toToken: { ...toToken, name: toToken.symbol, logoURI: undefined },
      fromAmount: String(fromAmount),
      toAmount: String(toAmount),
      toAmountMin: toAmountMin ? String(toAmountMin) : undefined,
      status: "PENDING",
      gasCostUSD: undefined,
      feeCostUSD: undefined,
      tool,
      toolLogoURI,
    })

    // ── Wait for on-chain confirmation ───────────────────────────────────
    const { confirmed, success } = await waitForReceipt(hash, executionData.chainId)

    if (confirmed) {
      const finalStatus = success ? "DONE" : "FAILED"
      await SwapTransaction.updateOne(
        { _id: swapRecord._id },
        { status: finalStatus, completedAt: new Date() },
      )
      if (success) {
        return NextResponse.json({ success: true, txHash: hash, status: "DONE" })
      } else {
        return NextResponse.json(
          { error: "Swap transaction reverted on-chain", txHash: hash, status: "FAILED" },
          { status: 400 },
        )
      }
    }

    // Timed out waiting — return pending (rare edge case)
    return NextResponse.json({
      success: true,
      txHash: hash,
      status: "PENDING",
      message: "Transaction submitted but confirmation is taking longer than expected. Check your transaction history.",
    })
  } catch (error) {
    console.error("[Swap Execute] Error:", error)
    const msg = error instanceof Error ? error.message : "Swap execution failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

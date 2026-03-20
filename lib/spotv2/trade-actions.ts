"use server"

import { PrivyClient } from "@privy-io/node"
import { UserWallet } from "@/models/UserWallet"
import { connectDB } from "@/lib/mongodb"
import { auth, currentUser } from "@clerk/nextjs/server"
import SpotTrade from "@/models/SpotTrade"
import { CHAIN_TOKEN_MAP } from "@/lib/bridge-config"

const privy = new PrivyClient({
  appId: process.env.PRIVY_APP_ID!,
  appSecret: process.env.PRIVY_APP_SECRET!,
})

// ── Chain mapping ────────────────────────────────────────────────────────

const CHAIN_NAME_TO_ID: Record<string, number> = {
  ethereum: 1,
  arbitrum: 42161,
  polygon: 137,
  optimism: 10,
  bsc: 56,
  base: 8453,
  avalanche: 43114,
}

// USDC addresses per chain for the quote token
const USDC_ADDRESSES: Record<number, string> = {
  1: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  137: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
  10: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  56: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
  8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  43114: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
}

// ── Types ────────────────────────────────────────────────────────────────

export interface SpotV2QuoteResult {
  success: boolean
  expectedOutput?: string
  toAmountMin?: string
  priceImpact?: number
  gasEstimate?: string
  executionData?: {
    to: string
    data: string
    value: string
    chainId: number
    gasLimit?: string
  }
  error?: string
}

export interface SpotV2TradeResult {
  success: boolean
  txHash?: string
  error?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────

function parseUnits(value: string, decimals: number): string {
  const [intPart = "0", fracPart = ""] = value.split(".")
  const padded = fracPart.padEnd(decimals, "0").slice(0, decimals)
  const raw = BigInt(intPart) * BigInt(10) ** BigInt(decimals) + BigInt(padded || "0")
  return raw.toString()
}

function toHex(val?: string | number): string | undefined {
  if (!val) return undefined
  if (typeof val === "string" && val.startsWith("0x")) return val
  try {
    return `0x${BigInt(val).toString(16)}`
  } catch {
    return undefined
  }
}

async function getEthWallet(): Promise<{ walletId: string; address: string; userId: string } | null> {
  const { userId } = await auth()
  if (!userId) return null

  const user = await currentUser()
  const email = user?.emailAddresses[0]?.emailAddress
  if (!email) return null

  await connectDB()
  const userWallet = await UserWallet.findOne({ email }).lean()
  const ethWallet = (userWallet as Record<string, unknown>)?.wallets as Record<string, Record<string, string>> | undefined
  if (!ethWallet?.ethereum?.walletId || !ethWallet?.ethereum?.address) return null

  return {
    walletId: ethWallet.ethereum.walletId,
    address: ethWallet.ethereum.address,
    userId,
  }
}

// ── Get Quote ────────────────────────────────────────────────────────────

export async function getSpotV2Quote(params: {
  chain: string
  contractAddress: string | null
  symbol: string
  side: "BUY" | "SELL"
  amount: string
  decimals?: number
}): Promise<SpotV2QuoteResult> {
  try {
    const wallet = await getEthWallet()
    if (!wallet) return { success: false, error: "Wallet not found. Please set up your wallet first." }

    const chainId = CHAIN_NAME_TO_ID[params.chain.toLowerCase()]
    if (!chainId) return { success: false, error: `Unsupported chain: ${params.chain}` }

    const usdcAddress = USDC_ADDRESSES[chainId]
    if (!usdcAddress) return { success: false, error: `USDC not available on ${params.chain}` }

    // For native tokens (ETH, BNB, etc.), use zero address
    const tokenAddress = params.contractAddress || "0x0000000000000000000000000000000000000000"

    // BUY = USDC → Token, SELL = Token → USDC
    const isBuy = params.side === "BUY"
    const fromToken = isBuy ? usdcAddress : tokenAddress
    const toToken = isBuy ? tokenAddress : usdcAddress
    const fromDecimals = isBuy ? 6 : (params.decimals ?? 18)
    const fromAmountRaw = parseUnits(params.amount, fromDecimals)

    const qs = new URLSearchParams({
      fromChain: chainId.toString(),
      toChain: chainId.toString(),
      fromToken,
      toToken,
      fromAmount: fromAmountRaw,
      fromAddress: wallet.address,
      toAddress: wallet.address,
      slippage: "0.005",
      integrator: "worldstreet",
      allowSwitchChain: "false",
    })

    const res = await fetch(`https://li.quest/v1/quote?${qs.toString()}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { success: false, error: (data as Record<string, string>).message || `Li.Fi error: ${res.status}` }
    }

    const quote = await res.json()
    return {
      success: true,
      expectedOutput: quote.estimate?.toAmount,
      toAmountMin: quote.estimate?.toAmountMin,
      priceImpact: quote.estimate?.data?.priceImpact || 0,
      gasEstimate: quote.estimate?.gasCosts?.[0]?.amountUSD || "0",
      executionData: quote.transactionRequest
        ? {
            to: quote.transactionRequest.to,
            data: quote.transactionRequest.data,
            value: quote.transactionRequest.value || "0",
            chainId: quote.transactionRequest.chainId || chainId,
            gasLimit: quote.transactionRequest.gasLimit,
          }
        : undefined,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch quote",
    }
  }
}

// ── Execute Trade ────────────────────────────────────────────────────────

export async function executeSpotV2Trade(params: {
  chain: string
  pair: string
  side: "BUY" | "SELL"
  fromTokenAddress: string
  fromTokenSymbol: string
  fromAmount: string
  toTokenAddress: string
  toTokenSymbol: string
  expectedToAmount: string
  executionPrice: string
  slippage: number
  executionData: {
    to: string
    data: string
    value: string
    chainId: number
    gasLimit?: string
  }
}): Promise<SpotV2TradeResult> {
  try {
    const { getToken } = await auth()
    const clerkJwt = await getToken()
    if (!clerkJwt) return { success: false, error: "Authentication required" }

    const wallet = await getEthWallet()
    if (!wallet) return { success: false, error: "Wallet not found" }

    const chainId = CHAIN_NAME_TO_ID[params.chain.toLowerCase()]
    if (!chainId) return { success: false, error: `Unsupported chain: ${params.chain}` }

    // Save pending trade to DB
    await connectDB()
    const trade = await SpotTrade.create({
      userId: wallet.userId,
      txHash: `pending-${Date.now()}`,
      chainId,
      pair: params.pair,
      side: params.side,
      fromTokenAddress: params.fromTokenAddress,
      fromTokenSymbol: params.fromTokenSymbol,
      fromAmount: params.fromAmount,
      toTokenAddress: params.toTokenAddress,
      toTokenSymbol: params.toTokenSymbol,
      toAmount: params.expectedToAmount,
      executionPrice: params.executionPrice,
      slippagePercent: params.slippage,
      status: "PENDING",
    })

    // Execute via Privy wallet RPC
    const txParams: Record<string, unknown> = {
      to: params.executionData.to,
      value: toHex(params.executionData.value) || "0x0",
      data: params.executionData.data,
      chain_id: params.executionData.chainId,
    }
    if (params.executionData.gasLimit) {
      txParams.gas_limit = toHex(params.executionData.gasLimit)
    }

    const result = await privy.wallets().rpc(wallet.walletId, {
      method: "eth_sendTransaction",
      caip2: `eip155:${params.executionData.chainId}`,
      params: { transaction: txParams },
      authorization_context: { user_jwts: [clerkJwt] },
    })

    const hash = (result as unknown as Record<string, Record<string, string>>).data?.hash
    if (!hash) {
      await SpotTrade.findByIdAndUpdate(trade._id, { status: "FAILED" })
      return { success: false, error: "No transaction hash returned" }
    }

    // Update trade with real tx hash
    await SpotTrade.findByIdAndUpdate(trade._id, {
      txHash: hash,
      status: "CONFIRMED",
      confirmedAt: new Date(),
    })

    return { success: true, txHash: hash }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Trade execution failed",
    }
  }
}

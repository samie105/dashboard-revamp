"use server"

import { PrivyClient } from "@privy-io/node"
import { shouldSponsor } from "@/lib/privy/sponsorship"
import { UserWallet } from "@/models/UserWallet"
import { connectDB } from "@/lib/mongodb"
import { auth, currentUser } from "@clerk/nextjs/server"
import { BRIDGE_TOKENS, CHAIN_TOKEN_MAP } from "@/lib/bridge-config"

const privy = new PrivyClient({
  appId: process.env.PRIVY_APP_ID!,
  appSecret: process.env.PRIVY_APP_SECRET!,
})

// ── Types ────────────────────────────────────────────────────────────────

export interface BridgeQuote {
  tool: string
  estimate: {
    toAmount: string
    toAmountMin: string
    toAmountUSD: string
    fromAmountUSD: string
    approvalAddress: string | null
    executionDuration: number
    feeCosts: Array<{ amountUSD: string }>
    gasCosts: Array<{ amountUSD: string }>
  }
  action: {
    slippage: number
    fromToken: { decimals: number }
    toToken: { decimals: number }
  }
  transactionRequest: {
    to: string
    data: string
    value: string
    chainId: number
    gasLimit?: string
  }
}

export interface BridgeQuoteResult {
  success: boolean
  quote?: BridgeQuote
  error?: string
}

export interface BridgeExecuteResult {
  success: boolean
  transactionHash?: string
  error?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────

function parseUnits(value: string, decimals: number): string {
  const [intPart = "0", fracPart = ""] = value.split(".")
  const padded = fracPart.padEnd(decimals, "0").slice(0, decimals)
  const raw = BigInt(intPart) * BigInt(10) ** BigInt(decimals) + BigInt(padded || "0")
  return raw.toString()
}

// formatUnits is in lib/utils.ts (not a server action)

function toHex(val?: string | number): string | undefined {
  if (!val) return undefined
  if (typeof val === "string" && val.startsWith("0x")) return val
  try {
    return `0x${BigInt(val).toString(16)}`
  } catch {
    return undefined
  }
}

function getTokenAddress(symbol: string, chainId: number): string {
  return CHAIN_TOKEN_MAP[chainId]?.[symbol] ?? BRIDGE_TOKENS.find((t) => t.symbol === symbol)?.address ?? "0x0000000000000000000000000000000000000000"
}

async function getEthWalletId(): Promise<{ walletId: string; email: string } | null> {
  const { userId } = await auth()
  if (!userId) return null

  const user = await currentUser()
  const email = user?.emailAddresses[0]?.emailAddress
  if (!email) return null

  await connectDB()
  const userWallet = await UserWallet.findOne({ email }).lean()
  if (!userWallet?.wallets?.ethereum?.walletId) return null

  return { walletId: userWallet.wallets.ethereum.walletId, email }
}

// ── Server Actions ───────────────────────────────────────────────────────

/**
 * Fetch a bridge quote from Li.Fi
 */
export async function fetchBridgeQuote(params: {
  fromChainId: number
  toChainId: number
  fromTokenSymbol: string
  toTokenSymbol: string
  amount: string
  fromTokenDecimals: number
}): Promise<BridgeQuoteResult> {
  try {
    const wallet = await getEthWalletId()
    if (!wallet) return { success: false, error: "Wallet not found. Please set up your wallet first." }

    // Look up correct address for this user
    await connectDB()
    const userWallet = await UserWallet.findOne({ email: wallet.email }).lean()
    const fromAddress = userWallet?.wallets?.ethereum?.address
    if (!fromAddress) return { success: false, error: "Ethereum address not found" }

    const fromAmountRaw = parseUnits(params.amount, params.fromTokenDecimals)
    const fromTokenAddr = getTokenAddress(params.fromTokenSymbol, params.fromChainId)
    const toTokenAddr = getTokenAddress(params.toTokenSymbol, params.toChainId)

    const qs = new URLSearchParams({
      fromChain: params.fromChainId.toString(),
      toChain: params.toChainId.toString(),
      fromToken: fromTokenAddr,
      toToken: toTokenAddr,
      fromAmount: fromAmountRaw,
      fromAddress,
      integrator: "worldstreet",
    })

    const res = await fetch(`https://li.quest/v1/quote?${qs.toString()}`, {
      headers: { Accept: "application/json" },
    })
    const data = await res.json()

    if (!res.ok) {
      return { success: false, error: data.message || "Failed to fetch bridge quote" }
    }

    return { success: true, quote: data as BridgeQuote }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    return { success: false, error: msg }
  }
}

/**
 * Execute a bridge transaction through Privy
 */
export async function executeBridgeTransaction(params: {
  to: string
  data: string
  value: string
  chainId: number
  gasLimit?: string
}): Promise<BridgeExecuteResult> {
  try {
    const { getToken } = await auth()
    const clerkJwt = await getToken()
    if (!clerkJwt) return { success: false, error: "Authentication token not available" }

    const wallet = await getEthWalletId()
    if (!wallet) return { success: false, error: "Ethereum wallet not found" }

    const txParams: Record<string, unknown> = {
      to: params.to,
      value: toHex(params.value) || "0x0",
      data: params.data,
      chain_id: params.chainId,
    }
    if (params.gasLimit) txParams.gas_limit = toHex(params.gasLimit)

    // Remove undefined fields
    for (const key of Object.keys(txParams)) {
      if (txParams[key] === undefined) delete txParams[key]
    }

    const result = await privy.wallets().rpc(wallet.walletId, {
      method: "eth_sendTransaction",
      caip2: `eip155:${params.chainId}`,
      sponsor: shouldSponsor("ethereum"),
      params: { transaction: txParams },
      authorization_context: { user_jwts: [clerkJwt] },
    })

    const hash = (result as unknown as Record<string, Record<string, string>>).data?.hash
    if (!hash) return { success: false, error: "No transaction hash returned" }

    return { success: true, transactionHash: hash }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    return { success: false, error: msg }
  }
}

/**
 * Check the status of a Li.Fi cross-chain transaction
 */
export async function checkBridgeStatus(txHash: string, fromChainId: number, toChainId: number) {
  try {
    const qs = new URLSearchParams({
      txHash,
      bridge: "lifi",
      fromChain: fromChainId.toString(),
      toChain: toChainId.toString(),
    })
    const res = await fetch(`https://li.quest/v1/status?${qs.toString()}`)
    const data = await res.json()
    return { success: true, status: data.status, substatus: data.substatus }
  } catch {
    return { success: false, status: "UNKNOWN" }
  }
}

/**
 * Hyperliquid Bridge2 Utility
 *
 * Transfers Arb USDC from a Privy server-managed trading wallet
 * to the Hyperliquid Bridge2 contract on Arbitrum.
 *
 * Deposits land in the user's Perps wallet (credited to sender address).
 * Minimum 5 USDC — below this amount funds are lost permanently.
 */

import { encodeFunctionData, parseUnits } from "viem"

const HL_BRIDGE_ADDRESS =
  "0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7" as const
const ARBITRUM_USDC =
  "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as const
const MIN_DEPOSIT_USDC = 5

const ERC20_TRANSFER_ABI = [
  {
    constant: false,
    inputs: [
      { name: "_to", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", type: "boolean" }],
    type: "function",
  },
] as const

export interface BridgeToHyperliquidParams {
  privyClient: any
  walletId: string
  amount: number
  authorizationContext: any
}

export interface BridgeResult {
  success: boolean
  txHash?: string
  error?: string
}

/**
 * Transfer Arb USDC from a Privy trading wallet to HL Bridge2.
 * Uses gas sponsorship (sponsor: true) so the user pays no ETH.
 */
export async function bridgeToHyperliquid({
  privyClient,
  walletId,
  amount,
  authorizationContext,
}: BridgeToHyperliquidParams): Promise<BridgeResult> {
  if (amount < MIN_DEPOSIT_USDC) {
    return {
      success: false,
      error: `Minimum deposit is ${MIN_DEPOSIT_USDC} USDC. Below this, funds are lost permanently on Hyperliquid.`,
    }
  }

  const data = encodeFunctionData({
    abi: ERC20_TRANSFER_ABI,
    functionName: "transfer",
    args: [HL_BRIDGE_ADDRESS, parseUnits(amount.toString(), 6)],
  })

  const txParams = {
    to: ARBITRUM_USDC,
    data,
    value: "0x0",
  }

  const result = await (privyClient.wallets() as any)
    .ethereum()
    .sendTransaction(walletId, {
      sponsor: true,
      caip2: "eip155:42161",
      params: { transaction: txParams },
      authorization_context: authorizationContext,
    })

  return {
    success: true,
    txHash: result.hash,
  }
}

export { HL_BRIDGE_ADDRESS, ARBITRUM_USDC, MIN_DEPOSIT_USDC }

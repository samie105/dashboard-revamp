/**
 * Hyperliquid Withdraw3 Utility
 *
 * Withdraws USDC from Hyperliquid Perps back to an Arbitrum address.
 * Uses the @nktkas/hyperliquid SDK's ExchangeClient.withdraw3().
 *
 * Funds must be in the Perps wallet first — use usdClassTransfer(toPerp: true)
 * to move from Spot → Perps before calling this.
 */

import { HttpTransport, ExchangeClient } from "@nktkas/hyperliquid"
import { createViemAccount } from "@privy-io/node/viem"

export interface WithdrawFromHlParams {
  privyClient: any
  walletId: string
  walletAddress: string
  authorizationContext: any
  /** Arbitrum destination address to receive USDC */
  destination: string
  /** Amount in USD (1 = $1) */
  amount: number
}

export interface WithdrawFromHlResult {
  success: boolean
  data?: any
  error?: string
}

/**
 * Withdraw USDC from Hyperliquid Perps to an Arbitrum address.
 */
export async function withdrawFromHyperliquid({
  privyClient,
  walletId,
  walletAddress,
  authorizationContext,
  destination,
  amount,
}: WithdrawFromHlParams): Promise<WithdrawFromHlResult> {
  if (amount <= 0) {
    return { success: false, error: "Amount must be positive" }
  }

  const viemAccount = createViemAccount(privyClient, {
    walletId,
    address: walletAddress as `0x${string}`,
    authorizationContext,
  })

  const transport = new HttpTransport({ isTestnet: false })
  const exchange = new ExchangeClient({ transport, wallet: viemAccount })

  const result = await exchange.withdraw3({
    destination: destination as `0x${string}`,
    amount: amount.toString(),
  })

  return { success: true, data: result }
}

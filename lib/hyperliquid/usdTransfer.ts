/**
 * Hyperliquid USD Class Transfer Utility
 *
 * Transfers USDC between Perps and Spot wallets on Hyperliquid.
 * Uses the @nktkas/hyperliquid SDK's ExchangeClient.usdClassTransfer().
 *
 * Bridge deposits land in Perps by default. This utility moves them to Spot
 * so they can be used for spot order placement.
 */

import { HttpTransport, ExchangeClient } from "@nktkas/hyperliquid"
import { createViemAccount } from "@privy-io/node/viem"

export interface UsdClassTransferParams {
  privyClient: any
  walletId: string
  walletAddress: string
  authorizationContext: any
  amount: number
  /** true = Spot → Perps, false = Perps → Spot */
  toPerp: boolean
}

export interface UsdClassTransferResult {
  success: boolean
  data?: any
  error?: string
}

/**
 * Transfer USDC between Perps and Spot wallets on Hyperliquid.
 *
 * @param params.toPerp - false means Perps→Spot (what we need after bridge deposits)
 */
export async function usdClassTransfer({
  privyClient,
  walletId,
  walletAddress,
  authorizationContext,
  amount,
  toPerp,
}: UsdClassTransferParams): Promise<UsdClassTransferResult> {
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

  const result = await exchange.usdClassTransfer({
    amount: amount.toString(),
    toPerp,
  })

  return { success: true, data: result }
}

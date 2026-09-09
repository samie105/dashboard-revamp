import { privyClient } from "./client"
import type { PrivyClient } from "@privy-io/node"

export interface TronTransactionParams {
  to: string
  amount: number // in SUN (1 TRX = 10^6 SUN)
  tokenAddress?: string // For TRC20 tokens
}

/**
 * Send a Tron transaction using Privy REST API
 * Note: Tron is not a first-class chain in Privy's typed RPC methods,
 * so we use the raw wallets API endpoint.
 */
export async function sendTronTransaction(
  walletId: string,
  params: TronTransactionParams,
  clerkJwt: string,
  client: PrivyClient = privyClient,
) {
  const wallet = await client.wallets().get(walletId)
  if (!wallet || wallet.chain_type !== "tron") throw new Error("Invalid Tron wallet")
  const result = await (client.wallets() as any).rpc(walletId, {
    method: "tron_sendTransaction",
    chain_type: "tron",
    params,
    authorization_context: { user_jwts: [clerkJwt] },
  })

  return {
    txid: result.data?.hash || result.data?.txid,
    status: "pending",
  }
}

/**
 * Send TRX to an address
 */
export async function sendTrx(
  walletId: string,
  toAddress: string,
  amountInTrx: string,
  clerkJwt: string,
  client?: PrivyClient,
) {
  const sun = Math.floor(parseFloat(amountInTrx) * 1e6)

  return sendTronTransaction(
    walletId,
    {
      to: toAddress,
      amount: sun,
    },
    clerkJwt,
    client,
  )
}

/**
 * Get Tron wallet balance
 */
export async function getTronBalance(walletId: string) {
  const wallet = await privyClient.wallets().get(walletId)
  if (!wallet || wallet.chain_type !== "tron") {
    throw new Error("Invalid Tron wallet")
  }
  // Tron balance must be fetched from a Tron RPC node, not Privy
  // Return the wallet address for client-side balance fetching
  return { address: wallet.address }
}

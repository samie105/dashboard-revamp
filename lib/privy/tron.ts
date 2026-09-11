import { privyClient } from "./client"
import type { PrivyClient } from "@privy-io/node"
import type { AuthorizationContext } from "./authorization"
import { TronWeb } from "tronweb"

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
  authorizationContext: AuthorizationContext,
  client: PrivyClient = privyClient,
) {
  const wallet = await client.wallets().get(walletId)
  if (!wallet || wallet.chain_type !== "tron") throw new Error("Invalid Tron wallet")

  // Privy's Tron RPC accepts a prepared Tron transaction, not the friendly
  // {to, amount} shape used by the old implementation. Build the unsigned
  // transaction with the configured Tron node first, then let Privy sign and
  // broadcast its raw_data.
  if (params.tokenAddress) {
    throw new Error("TRC-20 transfers are not supported by this native Tron transfer path")
  }

  const rpcUrl = (process.env.TRON_RPC_URL || "https://api.trongrid.io").replace(/\/$/, "")
  const tron = new TronWeb({
    fullHost: rpcUrl,
    headers: process.env.TRON_API_KEY
      ? { "TRON-PRO-API-KEY": process.env.TRON_API_KEY }
      : undefined,
  })
  const ownerAddress = wallet.address
  if (!ownerAddress) throw new Error("Tron wallet address is missing")
  if (!Number.isSafeInteger(params.amount) || params.amount <= 0) {
    throw new Error("Tron amount must be a positive integer number of SUN")
  }

  const transactionResponse = await tron.transactionBuilder.sendTrx(
    params.to,
    params.amount,
    ownerAddress,
  )
  const rawData = (transactionResponse as { raw_data?: unknown }).raw_data
  if (!rawData || typeof rawData !== "object") {
    throw new Error("Tron RPC returned an incomplete unsigned transaction")
  }

  const result = await (client.wallets() as unknown as {
    rpc: (walletId: string, payload: Record<string, unknown>) => Promise<{ data?: { hash?: string; txid?: string } }>
  }).rpc(walletId, {
    method: "tron_sendTransaction",
    params: { raw_data: rawData },
    authorization_context: authorizationContext,
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
  authorizationContext: AuthorizationContext,
  client?: PrivyClient,
) {
  const sun = Math.floor(parseFloat(amountInTrx) * 1e6)

  return sendTronTransaction(
    walletId,
    {
      to: toAddress,
      amount: sun,
    },
    authorizationContext,
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

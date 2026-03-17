import { privyClient } from "./client"

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
) {
  const appId = process.env.PRIVY_APP_ID
  const appSecret = process.env.PRIVY_APP_SECRET

  if (!appId || !appSecret) {
    throw new Error("PRIVY_APP_ID or PRIVY_APP_SECRET is not set")
  }

  const response = await fetch(
    `https://api.privy.io/v1/wallets/${walletId}/rpc`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${appId}:${appSecret}`).toString("base64")}`,
        "Content-Type": "application/json",
        "privy-app-id": appId,
      },
      body: JSON.stringify({
        method: "tron_sendTransaction",
        chain_type: "tron",
        params,
        authorization_context: {
          user_jwts: [clerkJwt],
        },
      }),
    },
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Tron transaction failed: ${response.status} - ${errorText}`)
  }

  const result = await response.json()

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
) {
  const sun = Math.floor(parseFloat(amountInTrx) * 1e6)

  return sendTronTransaction(
    walletId,
    {
      to: toAddress,
      amount: sun,
    },
    clerkJwt,
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

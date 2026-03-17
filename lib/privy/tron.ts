import { privyClient } from "./client"
import { createAuthorizationContext } from "./authorization"

export interface TronTransactionParams {
  to: string
  amount: number // in SUN (1 TRX = 10^6 SUN)
  tokenAddress?: string // For TRC20 tokens
}

/**
 * Send a Tron transaction
 */
export async function sendTronTransaction(
  walletId: string,
  params: TronTransactionParams,
  clerkJwt: string,
) {
  const authContext = await createAuthorizationContext(clerkJwt)

  const transaction = await (privyClient.wallets as unknown as Record<string, Function>)
    .tron(walletId)
    .sendTransaction(params, { authorizationContext: authContext })

  return {
    txid: transaction.txid,
    status: transaction.status,
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
  const balance = await (privyClient.wallets as unknown as Record<string, Function>).tron(walletId).getBalance()
  return balance
}

import { privyClient } from "./client"

export interface TonTransactionParams {
  to: string
  amount: number // in nanoTON (1 TON = 10^9 nanoTON)
  payload?: string
}

/**
 * Get TON wallet balance using TON API
 */
export async function getTonBalance(address: string) {
  try {
    const response = await fetch(
      `https://go.getblock.io/8a928018fe2741ed90779091f68c571d/getAddressInformation?address=${encodeURIComponent(address)}`,
    )

    if (!response.ok) {
      throw new Error(`TON API request failed: ${response.status}`)
    }

    const data = await response.json()

    if (!data.ok) {
      throw new Error(
        data.error || "Failed to fetch balance from GetBlock TON API",
      )
    }

    const balanceInNanoTon = data.result?.balance || "0"
    const balanceInTon = parseFloat(balanceInNanoTon) / 1e9

    return {
      balance: balanceInTon,
      balanceInNanoTon: balanceInNanoTon,
      address,
    }
  } catch (error: unknown) {
    console.error("[TON Balance] Error:", error)
    throw new Error((error as Error).message || "Failed to fetch TON balance")
  }
}

/**
 * Get TON wallet balance by Privy wallet ID
 */
export async function getTonBalanceByWalletId(walletId: string) {
  const wallet = await privyClient.wallets().get(walletId)
  if (!wallet || wallet.chain_type !== "ton") {
    throw new Error("Invalid TON wallet")
  }

  return getTonBalance(wallet.address)
}

/**
 * Send a TON transaction using Privy's raw signing (Tier 2 chain support)
 */
export async function sendTonTransaction(
  walletId: string,
  params: TonTransactionParams,
  clerkJwt: string,
) {
  try {
    const wallet = await privyClient.wallets().get(walletId)
    if (!wallet || wallet.chain_type !== "ton") {
      throw new Error("Invalid TON wallet")
    }

    console.log(
      "[Privy TON] Sending transaction from",
      wallet.address,
      "to",
      params.to,
    )

    console.log("[Privy TON] Preparing authorization for", clerkJwt ? "authenticated" : "unauthenticated", "user")

    // TON transactions via Privy not yet fully implemented
    throw new Error(
      "TON transactions via Privy not yet fully implemented. Please use a TON wallet directly.",
    )
  } catch (error: unknown) {
    console.error("[Privy TON] Send error:", error)
    throw new Error((error as Error).message || "Failed to send TON transaction")
  }
}

/**
 * Send TON to an address
 */
export async function sendTon(
  walletId: string,
  toAddress: string,
  amountInTon: string,
  clerkJwt: string,
) {
  const nanoTon = Math.floor(parseFloat(amountInTon) * 1e9)

  return sendTonTransaction(
    walletId,
    {
      to: toAddress,
      amount: nanoTon,
    },
    clerkJwt,
  )
}

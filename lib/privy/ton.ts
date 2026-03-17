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
  const endpoints = [
    `https://go.getblock.io/8a928018fe2741ed90779091f68c571d/getAddressInformation?address=${encodeURIComponent(address)}`,
    `https://toncenter.com/api/v2/getAddressInformation?address=${encodeURIComponent(address)}`,
  ]

  let lastError: Error | null = null

  for (const url of endpoints) {
    try {
      const response = await fetch(url)

      if (!response.ok) {
        console.warn(`[TON Balance] Endpoint returned ${response.status}, trying next`)
        continue
      }

      const text = await response.text()
      let data: Record<string, unknown>
      try {
        data = JSON.parse(text)
      } catch {
        console.warn("[TON Balance] Non-JSON response:", text.slice(0, 120))
        continue
      }

      if (!data.ok) {
        console.warn("[TON Balance] API returned ok=false:", data.error)
        continue
      }

      const balanceInNanoTon = (data.result as Record<string, string>)?.balance || "0"
      const balanceInTon = parseFloat(balanceInNanoTon) / 1e9

      return {
        balance: balanceInTon,
        balanceInNanoTon: balanceInNanoTon,
        address,
      }
    } catch (error: unknown) {
      lastError = error as Error
      console.warn("[TON Balance] Endpoint error:", (error as Error).message)
    }
  }

  console.error("[TON Balance] All endpoints failed for", address)
  throw new Error(lastError?.message || "Failed to fetch TON balance")
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

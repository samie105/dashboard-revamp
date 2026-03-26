import { toHex } from "viem"
import { privyClient } from "./client"
import { shouldSponsor } from "./sponsorship"
import { mainnet, arbitrum, polygon, optimism, bsc, base } from "viem/chains"

export interface EthereumTransactionParams {
  to: string
  value?: string | number | bigint
  data?: string
  gas?: string | number | bigint
  gasPrice?: string | number | bigint
  nonce?: number
  chain_id?: number
}

export const getChain = (chainId: number) => {
  switch (chainId) {
    case 1:
      return mainnet
    case 42161:
      return arbitrum
    case 137:
      return polygon
    case 10:
      return optimism
    case 56:
      return bsc
    case 8453:
      return base
    default:
      return mainnet
  }
}

function sanitizePrivyError(error: unknown): string {
  const message = (error as Error).message || String(error)

  if (message.includes('{"error":')) {
    try {
      const match = message.match(/\{.*\}/)
      if (match) {
        const errorDetail = JSON.parse(match[0])
        const innerError = errorDetail.error

        if (typeof innerError === "string") {
          if (innerError.includes("insufficient funds"))
            return "Insufficient funds for gas + value."
          if (innerError.includes("exceeds the balance"))
            return "Insufficient funds for this transaction."
          return innerError
        }
      }
    } catch {}
  }

  if (message.includes("insufficient funds"))
    return "Insufficient funds for gas + value."
  if (message.includes("missing_or_invalid_token"))
    return "Session expired. Please refresh."

  return message
}

/**
 * Send an Ethereum transaction using Privy's native Viem integration.
 * Designed to seamlessly execute complex operations like cross-chain Li.Fi bridging.
 */
export async function sendEthereumTransaction(
  walletId: string,
  params: EthereumTransactionParams,
  clerkJwt: string | null,
) {
  try {
    const wallet = await privyClient.wallets().get(walletId)
    if (!wallet || wallet.chain_type !== "ethereum") {
      throw new Error("Invalid Ethereum wallet")
    }

    console.log(
      "[Privy Ethereum/Viem] Sending transaction from",
      wallet.address,
      "to",
      params.to,
    )

    if (!clerkJwt)
      throw new Error("No authorization context available - JWT required")

    const chainId = params.chain_id || 1
    const sponsor = shouldSponsor("ethereum")

    console.log(
      `[Privy Ethereum] Execution on chain ${chainId} (Sponsor: ${sponsor}). Target: ${params.to}`,
    )

    const result = await privyClient.wallets().rpc(walletId, {
      method: "eth_sendTransaction",
      caip2: `eip155:${chainId}`,
      chain_type: "ethereum",
      sponsor: sponsor,
      params: {
        transaction: {
          to: params.to,
          value: params.value ? toHex(BigInt(params.value)) : "0x0",
          data: params.data || "0x",
          ...(params.gas ? { gas_limit: toHex(BigInt(params.gas)) } : {}),
          ...(params.gasPrice ? { gas_price: toHex(BigInt(params.gasPrice)) } : {}),
          ...(params.nonce !== undefined ? { nonce: params.nonce } : {}),
        },
      },
      authorization_context: {
        user_jwts: [clerkJwt],
      },
    })

    const hash = result.data?.hash
    console.log("[Privy Ethereum] Broadcast success:", hash)

    return {
      transactionHash: hash,
      status: "success",
    }
  } catch (error: unknown) {
    console.error("[Privy Ethereum Execution] Error:", error)
    throw new Error(sanitizePrivyError(error))
  }
}

/**
 * Send ETH directly to an address
 */
export async function sendEth(
  walletId: string,
  toAddress: string,
  amountInEth: string,
  clerkJwt: string | null,
) {
  const valueInWei = BigInt(Math.floor(parseFloat(amountInEth) * 1e18))
  return sendEthereumTransaction(
    walletId,
    {
      to: toAddress,
      value: valueInWei,
      chain_id: 1,
    },
    clerkJwt,
  )
}

/**
 * Get Ethereum wallet balance
 */
export async function getEthereumBalance(walletId: string) {
  const wallet = await privyClient.wallets().get(walletId)
  if (!wallet || wallet.chain_type !== "ethereum") {
    throw new Error("Invalid Ethereum wallet")
  }
  return {
    address: wallet.address,
  }
}

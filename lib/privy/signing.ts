import { privyClient } from "./client"

/**
 * Sign an arbitrary message with Ethereum wallet
 */
export async function signEthereumMessage(
  walletId: string,
  message: string,
  clerkJwt: string,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (privyClient.wallets() as any).rpc(walletId, {
    method: "personal_sign",
    chain_type: "ethereum",
    params: {
      encoding: "utf-8",
      message,
    },
    authorization_context: {
      user_jwts: [clerkJwt],
    },
  })

  return result.data?.signature
}

/**
 * Sign an arbitrary message with Solana wallet
 */
export async function signSolanaMessage(
  walletId: string,
  message: string,
  clerkJwt: string,
) {
  const base64Message = Buffer.from(message).toString("base64")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (privyClient.wallets() as any).rpc(walletId, {
    method: "signMessage",
    chain_type: "solana",
    params: {
      encoding: "base64",
      message: base64Message,
    },
    authorization_context: {
      user_jwts: [clerkJwt],
    },
  })

  return result.data?.signature
}

/**
 * Sign typed data (EIP-712) with Ethereum wallet
 */
export async function signTypedData(
  walletId: string,
  typedData: Record<string, unknown>,
  clerkJwt: string,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (privyClient.wallets() as any).rpc(walletId, {
    method: "eth_signTypedData_v4",
    chain_type: "ethereum",
    params: {
      typed_data: typedData,
    },
    authorization_context: {
      user_jwts: [clerkJwt],
    },
  })

  return result.data?.signature
}

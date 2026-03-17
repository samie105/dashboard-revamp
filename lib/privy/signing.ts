import { privyClient } from "./client"
import { createAuthorizationContext } from "./authorization"

/**
 * Sign an arbitrary message with Ethereum wallet
 */
export async function signEthereumMessage(
  walletId: string,
  message: string,
  clerkJwt: string,
) {
  const authContext = await createAuthorizationContext(clerkJwt)

  const signature = await (privyClient.wallets as unknown as Record<string, Function>)
    .ethereum(walletId)
    .signMessage({ message }, { authorizationContext: authContext })

  return signature
}

/**
 * Sign an arbitrary message with Solana wallet
 */
export async function signSolanaMessage(
  walletId: string,
  message: string,
  clerkJwt: string,
) {
  const authContext = await createAuthorizationContext(clerkJwt)

  const signature = await (privyClient.wallets as unknown as Record<string, Function>)
    .solana(walletId)
    .signMessage({ message }, { authorizationContext: authContext })

  return signature
}

/**
 * Sign typed data (EIP-712) with Ethereum wallet
 */
export async function signTypedData(
  walletId: string,
  typedData: Record<string, unknown>,
  clerkJwt: string,
) {
  const authContext = await createAuthorizationContext(clerkJwt)

  const signature = await (privyClient.wallets as unknown as Record<string, Function>)
    .ethereum(walletId)
    .signTypedData(typedData, { authorizationContext: authContext })

  return signature
}

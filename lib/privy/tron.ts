import { privyClient } from "./client"
import type { PrivyClient } from "@privy-io/node"
import type { AuthorizationContext } from "./authorization"
import { TronWeb } from "tronweb"

export interface TronTransactionParams {
  to: string
  amount: number // in SUN (1 TRX = 10^6 SUN)
  tokenAddress?: string // For TRC20 tokens
}

function tronClient() {
  const rpcUrl = (process.env.TRON_RPC_URL || "https://api.trongrid.io").replace(/\/$/, "")
  return new TronWeb({
    fullHost: rpcUrl,
    headers: process.env.TRON_API_KEY
      ? { "TRON-PRO-API-KEY": process.env.TRON_API_KEY }
      : undefined,
  })
}

/** TronGrid-style APIs nest TransferContract fields under parameter.value,
 *  while Privy's tron_sendTransaction schema expects them directly on the
 *  contract object. Shared by both the native and TRC20 send paths, which
 *  both build their unsigned transaction the same way and only differ in
 *  which TronWeb builder produces it. */
function normalizeRawDataForPrivy(rawData: unknown) {
  if (!rawData || typeof rawData !== "object") {
    throw new Error("Tron RPC returned an incomplete unsigned transaction")
  }
  const rawDataRecord = rawData as { contract?: unknown }
  const contracts = Array.isArray(rawDataRecord.contract) ? rawDataRecord.contract : []
  const firstContract = contracts[0]
  const contractRecord = firstContract && typeof firstContract === "object"
    ? firstContract as { parameter?: { value?: unknown }; [key: string]: unknown }
    : undefined
  const parameterValue = contractRecord?.parameter?.value
  if (!contractRecord || !parameterValue || typeof parameterValue !== "object") {
    throw new Error("Tron RPC returned an incomplete transfer contract")
  }
  const contractWithoutParameter = Object.fromEntries(
    Object.entries(contractRecord).filter(([key]) => key !== "parameter"),
  )
  return {
    ...rawDataRecord,
    contract: [
      { ...contractWithoutParameter, ...(parameterValue as Record<string, unknown>) },
      ...contracts.slice(1),
    ],
  }
}

async function broadcastViaPrivy(
  walletId: string,
  normalizedRawData: Record<string, unknown>,
  authorizationContext: AuthorizationContext,
  client: PrivyClient,
) {
  const result = await (client.wallets() as unknown as {
    rpc: (walletId: string, payload: Record<string, unknown>) => Promise<{ data?: { hash?: string; txid?: string } }>
  }).rpc(walletId, {
    method: "tron_sendTransaction",
    params: { raw_data: normalizedRawData },
    authorization_context: authorizationContext,
  })
  return { txid: result.data?.hash || result.data?.txid, status: "pending" as const }
}

/**
 * Send a TRC-20 token (e.g. USDT) using Privy REST API.
 *
 * sendTronTransaction's transactionBuilder.sendTrx only ever produces a
 * native TransferContract — there is no tokenAddress branch to take there,
 * which is why it throws rather than silently sending the wrong asset.
 * Building a TRC-20 transfer needs triggerSmartContract instead, encoding
 * `transfer(address,uint256)` against the token contract; everything else
 * (raw_data normalization, Privy broadcast) is identical to the native path.
 */
export async function sendTronTokenTransaction(
  walletId: string,
  params: { to: string; amount: number; tokenAddress: string },
  authorizationContext: AuthorizationContext,
  client: PrivyClient = privyClient,
) {
  const wallet = await client.wallets().get(walletId)
  if (!wallet || wallet.chain_type !== "tron") throw new Error("Invalid Tron wallet")
  const ownerAddress = wallet.address
  if (!ownerAddress) throw new Error("Tron wallet address is missing")
  if (!Number.isSafeInteger(params.amount) || params.amount <= 0) {
    throw new Error("Tron token amount must be a positive integer in the token's smallest unit")
  }

  const tron = tronClient()
  const { transaction } = await tron.transactionBuilder.triggerSmartContract(
    params.tokenAddress,
    "transfer(address,uint256)",
    {},
    [
      { type: "address", value: params.to },
      { type: "uint256", value: params.amount },
    ],
    ownerAddress,
  )
  if (!transaction) throw new Error("Tron RPC returned no transaction for the TRC-20 transfer")

  const normalizedRawData = normalizeRawDataForPrivy((transaction as { raw_data?: unknown }).raw_data)
  return broadcastViaPrivy(walletId, normalizedRawData, authorizationContext, client)
}

/**
 * Send a Tron transaction using Privy REST API
 * Note: Tron is not a first-class chain in Privy's typed RPC methods,
 * so we use the raw wallets API endpoint.
 *
 * A tokenAddress routes to sendTronTokenTransaction instead of falling
 * through: transactionBuilder.sendTrx below only ever builds a native
 * TransferContract, so a token address here used to be silently ignored (or,
 * once guarded, rejected outright) rather than sending the wrong asset.
 */
export async function sendTronTransaction(
  walletId: string,
  params: TronTransactionParams,
  authorizationContext: AuthorizationContext,
  client: PrivyClient = privyClient,
) {
  if (params.tokenAddress) {
    return sendTronTokenTransaction(
      walletId,
      { to: params.to, amount: params.amount, tokenAddress: params.tokenAddress },
      authorizationContext,
      client,
    )
  }

  const wallet = await client.wallets().get(walletId)
  if (!wallet || wallet.chain_type !== "tron") throw new Error("Invalid Tron wallet")
  const ownerAddress = wallet.address
  if (!ownerAddress) throw new Error("Tron wallet address is missing")
  if (!Number.isSafeInteger(params.amount) || params.amount <= 0) {
    throw new Error("Tron amount must be a positive integer number of SUN")
  }

  const tron = tronClient()
  const transactionResponse = await tron.transactionBuilder.sendTrx(
    params.to,
    params.amount,
    ownerAddress,
  )
  const normalizedRawData = normalizeRawDataForPrivy((transactionResponse as { raw_data?: unknown }).raw_data)
  return broadcastViaPrivy(walletId, normalizedRawData, authorizationContext, client)
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

import { privyClient } from "./client"
import { publicKeyFromRawBytes } from "@mysten/sui/verify"

export interface SuiTransactionParams {
  to: string
  amount: number // in MIST (1 SUI = 10^9 MIST)
}

/**
 * Get user authorization key from Privy using Clerk JWT
 */
async function getUserKey(clerkJwt: string): Promise<string> {
  const authResponse = await fetch(
    "https://api.privy.io/v1/wallets/authenticate",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${process.env.PRIVY_APP_ID}:${process.env.PRIVY_APP_SECRET}`,
        ).toString("base64")}`,
        "Content-Type": "application/json",
        "privy-app-id": process.env.PRIVY_APP_ID!,
      },
      body: JSON.stringify({
        user_jwt: clerkJwt,
      }),
    },
  )

  if (!authResponse.ok) {
    const authError = await authResponse.text()
    console.error("[Privy Auth] Authentication failed:", authError)
    throw new Error(
      `Failed to authenticate with Privy: ${authResponse.status}`,
    )
  }

  const authData = await authResponse.json()
  const userKey = authData.authorization_key

  if (!userKey) {
    throw new Error(
      "No authorization key returned from Privy authentication",
    )
  }

  return userKey
}

/**
 * Send a Sui transaction using Privy's raw signing (Tier 2 chain support)
 */
export async function sendSuiTransaction(
  walletId: string,
  params: SuiTransactionParams,
  clerkJwt: string,
) {
  try {
    const wallet = await privyClient.wallets().get(walletId)
    if (!wallet || wallet.chain_type !== "sui") {
      throw new Error("Invalid Sui wallet")
    }

    console.log(
      "[Privy Sui] Sending transaction from",
      wallet.address,
      "to",
      params.to,
    )

    const userKey = await getUserKey(clerkJwt)

    const authorizationContext = {
      authorization_private_keys: [userKey],
    }

    console.log("[Privy Sui] Authorization context created with user JWT")

    const { SuiClient, getFullnodeUrl } = await import(
      "@mysten/sui.js/client"
    )
    const { TransactionBlock } = await import("@mysten/sui.js/transactions")

    const suiClient = new SuiClient({
      url: process.env.NEXT_PUBLIC_SUI_RPC_URL || getFullnodeUrl("mainnet"),
    })

    const txb = new TransactionBlock()

    const [coin] = txb.splitCoins(txb.gas, [txb.pure(params.amount)])
    txb.transferObjects([coin], txb.pure(params.to))

    txb.setSender(wallet.address)
    txb.setGasBudget(1000000)

    const txBytes = await txb.build({ client: suiClient })

    const { messageWithIntent } = await import("@mysten/sui/cryptography")
    const intentMessage = messageWithIntent("TransactionData", txBytes)
    const intentHex = "0x" + Buffer.from(intentMessage).toString("hex")

    console.log(
      "[Privy Sui] Transaction bytes prepared, requesting signature",
    )

    const signResponse = await privyClient.wallets().rawSign(walletId, {
      params: {
        bytes: intentHex,
        encoding: "hex",
        hash_function: "blake2b256",
      },
      authorization_context: authorizationContext,
    })

    console.log("[Privy Sui] Transaction signed, submitting to network")

    const signature = signResponse.signature

    const { toSerializedSignature } = await import(
      "@mysten/sui/cryptography"
    )

    if (!wallet.public_key) {
      throw new Error("Wallet public key not available")
    }

    const publicKey = publicKeyFromRawBytes(
      "ED25519",
      Uint8Array.from(Buffer.from(wallet.public_key.slice(2), "hex")),
    )

    const signatureBytes = Uint8Array.from(
      Buffer.from(signature.slice(2), "hex"),
    )

    const suiSignature = toSerializedSignature({
      signature: signatureBytes,
      signatureScheme: "ED25519",
      publicKey,
    })

    const result = await suiClient.executeTransactionBlock({
      transactionBlock: txBytes,
      signature: suiSignature,
      options: {
        showEffects: true,
        showEvents: true,
      },
    })

    console.log("[Privy Sui] Transaction submitted:", result.digest)

    return {
      digest: result.digest,
      status: result.effects?.status?.status || "unknown",
    }
  } catch (error: unknown) {
    console.error("[Privy Sui] Send error:", error)
    throw new Error((error as Error).message || "Failed to send SUI transaction")
  }
}

/**
 * Send SUI to an address
 */
export async function sendSui(
  walletId: string,
  toAddress: string,
  amountInSui: string,
  clerkJwt: string,
) {
  const mist = Math.floor(parseFloat(amountInSui) * 1e9)

  return sendSuiTransaction(
    walletId,
    {
      to: toAddress,
      amount: mist,
    },
    clerkJwt,
  )
}

/**
 * Get Sui wallet balance using RPC
 */
export async function getSuiBalance(address: string) {
  try {
    const suiRpcUrl =
      process.env.NEXT_PUBLIC_SUI_RPC_URL ||
      "https://fullnode.mainnet.sui.io:443"

    const response = await fetch(suiRpcUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "suix_getBalance",
        params: [address, "0x2::sui::SUI"],
      }),
    })

    if (!response.ok) {
      throw new Error(`Sui RPC request failed: ${response.status}`)
    }

    const data = await response.json()

    if (data.error) {
      throw new Error(data.error.message || "Sui RPC error")
    }

    const totalBalance = data.result?.totalBalance || "0"
    const balanceInSui = parseFloat(totalBalance) / 1e9

    return {
      balance: balanceInSui,
      balanceInMist: totalBalance,
      address,
    }
  } catch (error: unknown) {
    console.error("[SUI Balance] Error:", error)
    throw new Error((error as Error).message || "Failed to fetch SUI balance")
  }
}

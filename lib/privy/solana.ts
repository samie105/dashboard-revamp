import { privyClient } from "./client"
import { shouldSponsor } from "./sponsorship"
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
} from "@solana/web3.js"

/**
 * Send SOL to an address using Privy's RPC with gas sponsorship
 */
export async function sendSol(
  walletId: string,
  toAddress: string,
  amountInSol: string,
  clerkJwt: string | null,
) {
  try {
    const wallet = await privyClient.wallets().get(walletId)
    if (!wallet || wallet.chain_type !== "solana") {
      throw new Error("Invalid Solana wallet")
    }

    console.log(
      "[Privy Solana] Sending",
      amountInSol,
      "SOL from",
      wallet.address,
      "to",
      toAddress,
    )

    if (!clerkJwt) {
      throw new Error("No authorization context available - JWT required")
    }

    const lamports = BigInt(Math.floor(parseFloat(amountInSol) * 1e9))

    const connection = new Connection(
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
        "https://api.mainnet-beta.solana.com",
    )

    const fromPubkey = new PublicKey(wallet.address)
    const toPubkey = new PublicKey(toAddress)

    const tx = new Transaction()
    tx.feePayer = fromPubkey
    tx.recentBlockhash = (
      await connection.getLatestBlockhash("finalized")
    ).blockhash

    tx.add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports,
      }),
    )

    const serialized = tx
      .serialize({ requireAllSignatures: false })
      .toString("base64")

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (privyClient.wallets() as any).rpc(walletId, {
      method: "signAndSendTransaction",
      caip2: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
      chain_type: "solana",
      sponsor: shouldSponsor("solana"),
      params: {
        encoding: "base64",
        transaction: serialized,
      },
      authorization_context: {
        user_jwts: [clerkJwt],
      },
    })

    const signature = result.data?.hash

    return {
      signature,
      status: "success",
    }
  } catch (error: unknown) {
    console.error("[Privy Solana] Send error:", error)
    throw new Error((error as Error).message || "Failed to send SOL transaction")
  }
}

/**
 * Get Solana wallet balance
 */
export async function getSolanaBalance(walletId: string) {
  const wallet = await privyClient.wallets().get(walletId)
  if (!wallet || wallet.chain_type !== "solana") {
    throw new Error("Invalid Solana wallet")
  }

  const connection = new Connection(
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
      "https://api.mainnet-beta.solana.net",
  )

  const publicKey = new PublicKey(wallet.address)
  const balance = await connection.getBalance(publicKey)

  return {
    balance: balance / 1e9,
    lamports: balance,
  }
}

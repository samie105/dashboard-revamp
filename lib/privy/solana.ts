import { privyClient } from "./client"
import { Connection, PublicKey } from "@solana/web3.js"

/**
 * Send SOL to an address using Privy's Solana Kit integration
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

    const lamports = BigInt(Math.floor(parseFloat(amountInSol) * 1e9))

    const authorizationContext = clerkJwt
      ? { user_jwts: [clerkJwt] }
      : undefined

    if (!authorizationContext) {
      throw new Error("No authorization context available - JWT required")
    }

    console.log("[Privy Solana] Authorization context created with user JWT")

    const { createSolanaKitSigner } = await import("@privy-io/node/solana-kit")
    const {
      address,
      createTransactionMessage,
      pipe,
      setTransactionMessageFeePayerSigner,
      signAndSendTransactionMessageWithSigners,
      appendTransactionMessageInstruction,
    } = await import("@solana/kit")

    const signer = createSolanaKitSigner(privyClient, {
      walletId,
      address: address(wallet.address),
      caip2: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
      authorizationContext,
    })

    const connection = new Connection(
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
        "https://api.mainnet-beta.solana.net",
    )

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash()

    const systemProgramId = address("11111111111111111111111111111111")

    // Create transfer instruction data (instruction index 2 = transfer)
    const instructionData = new Uint8Array(12)
    instructionData[0] = 2 // Transfer instruction
    instructionData[1] = 0
    instructionData[2] = 0
    instructionData[3] = 0
    const lamportsArray = new BigUint64Array([lamports])
    instructionData.set(new Uint8Array(lamportsArray.buffer), 4)

    const transactionMessage = pipe(
      createTransactionMessage({ version: 0 }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (m: any) => setTransactionMessageFeePayerSigner(signer, m),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (m: any) => ({
        ...m,
        lifetimeConstraint: {
          blockhash,
          lastValidBlockHeight,
        },
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (m: any) =>
        appendTransactionMessageInstruction(
          {
            programAddress: systemProgramId,
            accounts: [
              {
                address: address(wallet.address),
                role: 3, // AccountRole.WRITABLE_SIGNER
              },
              {
                address: address(toAddress),
                role: 1, // AccountRole.WRITABLE
              },
            ],
            data: instructionData,
          },
          m,
        ),
    )

    const signature =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await signAndSendTransactionMessageWithSigners(transactionMessage as any)

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

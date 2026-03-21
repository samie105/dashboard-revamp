import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { connectDB } from "@/lib/mongodb"
import { UserWallet } from "@/models/UserWallet"
import SpotV2Deposit from "@/models/SpotV2Deposit"
import { privyClient } from "@/lib/privy/client"
import {
  createAuthorizationContext,
  type AuthorizationContext,
} from "@/lib/privy/authorization"
import { encodeFunctionData, parseUnits } from "viem"
import {
  Connection,
  PublicKey,
  Transaction as SolTransaction,
} from "@solana/web3.js"
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token"
import { TronWeb } from "tronweb"

// ── Token contract addresses ─────────────────────────────────────────────

const TOKEN_CONTRACTS: Record<
  string,
  Record<string, { address: string; decimals: number }>
> = {
  ethereum: {
    USDT: { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
    USDC: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
  },
  solana: {
    USDT: { address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6 },
    USDC: { address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
  },
  tron: {
    USDT: { address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", decimals: 6 },
    USDC: { address: "TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8", decimals: 6 },
  },
}

const ERC20_TRANSFER_ABI = [
  {
    constant: false,
    inputs: [
      { name: "_to", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", type: "boolean" }],
    type: "function",
  },
] as const

// ── Chain-specific send functions ────────────────────────────────────────

async function sendTokenEthereum(
  walletId: string,
  tokenContract: string,
  treasuryAddress: string,
  amount: number,
  decimals: number,
  authorizationContext: AuthorizationContext,
): Promise<{ txHash: string }> {
  const data = encodeFunctionData({
    abi: ERC20_TRANSFER_ABI,
    functionName: "transfer",
    args: [
      treasuryAddress as `0x${string}`,
      parseUnits(amount.toString(), decimals),
    ],
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (privyClient.wallets() as any).rpc(walletId, {
    method: "eth_sendTransaction",
    caip2: "eip155:1",
    chain_type: "ethereum",
    params: {
      transaction: {
        to: tokenContract,
        data,
        value: "0x0",
      },
    },
    authorization_context: authorizationContext,
  })

  return { txHash: result.data?.hash }
}

async function sendTokenSolana(
  walletId: string,
  fromAddress: string,
  treasuryAddress: string,
  mintAddress: string,
  amount: number,
  decimals: number,
  authorizationContext: AuthorizationContext,
): Promise<{ txHash: string }> {
  const connection = new Connection(
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
      process.env.NEXT_PUBLIC_SOL_RPC ||
      "https://api.mainnet-beta.solana.com",
  )

  const fromPubkey = new PublicKey(fromAddress)

  const solBalance = await connection.getBalance(fromPubkey)
  const MIN_SOL_LAMPORTS = 10_000_000
  if (solBalance < MIN_SOL_LAMPORTS) {
    const solAmount = (solBalance / 1e9).toFixed(6)
    throw new Error(
      `Insufficient SOL for fees. Need ≥0.01 SOL, have ${solAmount} SOL.`,
    )
  }

  const toPubkey = new PublicKey(treasuryAddress)
  const mintPubkey = new PublicKey(mintAddress)

  const fromAta = await getAssociatedTokenAddress(mintPubkey, fromPubkey)
  const toAta = await getAssociatedTokenAddress(mintPubkey, toPubkey)

  const tokenAmount = Math.round(amount * Math.pow(10, decimals))
  try {
    const sourceAccount = await getAccount(connection, fromAta)
    if (BigInt(tokenAmount) > sourceAccount.amount) {
      const available = Number(sourceAccount.amount) / Math.pow(10, decimals)
      throw new Error(
        `Insufficient balance. Available: ${available}, requested: ${amount}.`,
      )
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("Insufficient")) throw e
    throw new Error("Token account not found — no balance in this wallet.")
  }

  const tx = new SolTransaction()
  tx.feePayer = fromPubkey
  tx.recentBlockhash = (
    await connection.getLatestBlockhash("finalized")
  ).blockhash

  try {
    await getAccount(connection, toAta)
  } catch {
    tx.add(
      createAssociatedTokenAccountInstruction(
        fromPubkey,
        toAta,
        toPubkey,
        mintPubkey,
      ),
    )
  }

  tx.add(createTransferInstruction(fromAta, toAta, fromPubkey, tokenAmount))

  const serialized = tx
    .serialize({ requireAllSignatures: false })
    .toString("base64")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (privyClient.wallets() as any).rpc(walletId, {
    method: "signAndSendTransaction",
    caip2: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    chain_type: "solana",
    params: {
      encoding: "base64",
      transaction: serialized,
    },
    authorization_context: authorizationContext,
  })

  return { txHash: result.data?.hash }
}

async function signTronTransaction(
  walletId: string,
  txID: string,
  walletAddress: string,
  authorizationContext: AuthorizationContext,
): Promise<string> {
  const hash = txID.startsWith("0x") ? txID : `0x${txID}`

  const signResult = await privyClient.wallets().rawSign(walletId, {
    params: { hash },
    authorization_context: authorizationContext,
  })

  const sig64 = signResult.signature.replace(/^0x/, "")

  const walletHex = TronWeb.address.toHex(walletAddress).toLowerCase()
  const tronWeb = new TronWeb({
    fullHost: process.env.TRON_RPC_URL || "https://api.trongrid.io",
    headers: process.env.TRON_API_KEY
      ? { "TRON-PRO-API-KEY": process.env.TRON_API_KEY }
      : {},
  })

  for (const v of ["1b", "1c"]) {
    const sig65 = sig64 + v
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recovered = (tronWeb.trx as any).ecRecover(hash.replace(/^0x/, ""), `0x${sig65}`)
      if (recovered.toLowerCase() === walletHex) {
        return sig65
      }
    } catch {
      // try other v
    }
  }

  return sig64 + "1b"
}

async function sendTokenTron(
  walletId: string,
  fromAddress: string,
  tokenContract: string,
  treasuryAddress: string,
  amount: number,
  decimals: number,
  authorizationContext: AuthorizationContext,
): Promise<{ txHash: string }> {
  const tronWeb = new TronWeb({
    fullHost: process.env.TRON_RPC_URL || "https://api.trongrid.io",
    headers: process.env.TRON_API_KEY
      ? { "TRON-PRO-API-KEY": process.env.TRON_API_KEY }
      : {},
  })

  const tokenAmount = Math.round(amount * Math.pow(10, decimals))
  const fromHex = TronWeb.address.toHex(fromAddress)

  const { transaction: unsignedTx } =
    await tronWeb.transactionBuilder.triggerSmartContract(
      tokenContract,
      "transfer(address,uint256)",
      { feeLimit: 100_000_000 },
      [
        { type: "address", value: treasuryAddress },
        { type: "uint256", value: tokenAmount },
      ],
      fromHex,
    )

  const txID = unsignedTx.txID

  const signature = await signTronTransaction(
    walletId,
    txID,
    fromAddress,
    authorizationContext,
  )
  const signedTx = { ...unsignedTx, signature: [signature] }

  const result = await tronWeb.trx.sendRawTransaction(signedTx)
  if (!result.result && !result.txid) {
    throw new Error(`TRON broadcast failed: ${JSON.stringify(result)}`)
  }

  return { txHash: result.txid || txID }
}

// ── Route handler ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let parsedAdminDepositId: string | undefined
  let parsedUserId: string | undefined

  try {
    const { userId: clerkUserId, getToken } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    parsedUserId = clerkUserId

    const body = await request.json()
    const { treasuryAddress, depositChain, depositToken, depositAmount, adminDepositId } = body
    parsedAdminDepositId = adminDepositId

    if (!treasuryAddress || !depositChain || !depositToken || !depositAmount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      )
    }

    const chainContracts = TOKEN_CONTRACTS[depositChain]
    if (!chainContracts) {
      return NextResponse.json(
        { error: `Unsupported chain: ${depositChain}` },
        { status: 400 },
      )
    }

    const tokenInfo = chainContracts[depositToken]
    if (!tokenInfo) {
      return NextResponse.json(
        { error: `Unsupported token: ${depositToken} on ${depositChain}` },
        { status: 400 },
      )
    }

    const clerkJwt = await getToken()
    if (!clerkJwt) {
      return NextResponse.json(
        { error: "Auth token required" },
        { status: 401 },
      )
    }

    await connectDB()

    const userWallet = await UserWallet.findOne({ clerkUserId })
    if (!userWallet) {
      return NextResponse.json(
        { error: "User wallet not found" },
        { status: 404 },
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chainWalletMap: Record<string, any> = {
      solana: userWallet.wallets?.solana,
      ethereum: userWallet.wallets?.ethereum,
      tron: userWallet.wallets?.tron,
    }
    const sourceWallet = chainWalletMap[depositChain]

    if (!sourceWallet?.walletId || !sourceWallet?.address) {
      return NextResponse.json(
        { error: `No ${depositChain} wallet found` },
        { status: 404 },
      )
    }

    const authContext = await createAuthorizationContext(clerkJwt)

    // Update local deposit record to "sending"
    if (adminDepositId) {
      await SpotV2Deposit.findOneAndUpdate(
        { adminDepositId, userId: clerkUserId },
        { $set: { status: "sending" } },
      )
    }

    let txHash: string

    if (depositChain === "solana") {
      const result = await sendTokenSolana(
        sourceWallet.walletId,
        sourceWallet.address,
        treasuryAddress,
        tokenInfo.address,
        depositAmount,
        tokenInfo.decimals,
        authContext,
      )
      txHash = result.txHash
    } else if (depositChain === "tron") {
      const result = await sendTokenTron(
        sourceWallet.walletId,
        sourceWallet.address,
        tokenInfo.address,
        treasuryAddress,
        depositAmount,
        tokenInfo.decimals,
        authContext,
      )
      txHash = result.txHash
    } else {
      const result = await sendTokenEthereum(
        sourceWallet.walletId,
        tokenInfo.address,
        treasuryAddress,
        depositAmount,
        tokenInfo.decimals,
        authContext,
      )
      txHash = result.txHash
    }

    // Update local deposit record with txHash and status
    if (adminDepositId) {
      await SpotV2Deposit.findOneAndUpdate(
        { adminDepositId, userId: clerkUserId },
        {
          $set: {
            depositTxHash: txHash,
            status: "awaiting_confirmation",
          },
        },
      )

      // Notify admin of txHash so it can verify + complete immediately
      // (don't await — let the response return quickly, polling will pick up the result)
      const adminUrl = process.env.ADMIN_BACKEND_URL
      const adminKey = process.env.ADMIN_BACKEND_API_KEY
      if (adminUrl && adminKey) {
        fetch(`${adminUrl}/api/deposits/${encodeURIComponent(adminDepositId)}/notify-tx`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": adminKey,
          },
          body: JSON.stringify({ depositTxHash: txHash }),
        }).catch((err) => {
          console.error("[SpotV2 Deposit Send] Failed to notify admin of txHash:", err)
        })
      }
    }

    return NextResponse.json({
      success: true,
      txHash,
    })
  } catch (error: unknown) {
    console.error("[SpotV2 Deposit Send] Error:", error)

    let userMessage =
      error instanceof Error ? error.message : "Failed to send funds"

    if (
      userMessage.includes("insufficient lamports") ||
      userMessage.includes("Attempt to debit")
    ) {
      userMessage =
        "Insufficient SOL for fees. You need at least 0.01 SOL in your Solana wallet."
    } else if (
      userMessage.includes("bandwidth") ||
      userMessage.includes("energy") ||
      userMessage.includes("AccountResourceInsufficient")
    ) {
      userMessage =
        "Insufficient TRX for fees. You need at least 30 TRX in your Tron wallet."
    } else if (userMessage.includes("insufficient funds")) {
      userMessage =
        "Insufficient balance to complete this deposit. Check your wallet balance."
    }

    // Mark local deposit as failed
    if (parsedAdminDepositId && parsedUserId) {
      await SpotV2Deposit.findOneAndUpdate(
        { adminDepositId: parsedAdminDepositId, userId: parsedUserId },
        { $set: { status: "failed", errorMessage: userMessage } },
      ).catch(() => {}) // Don't fail on cleanup
    }

    return NextResponse.json({ error: userMessage }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { connectDB } from "@/lib/mongodb"
import { UserWallet } from "@/models/UserWallet"
import SpotDeposit from "@/models/SpotDeposit"
import { privyClient } from "@/lib/privy/client"
import { shouldSponsor } from "@/lib/privy/sponsorship"
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

const ETH_USDT_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
const SOL_USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
const TRON_USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
const USDT_DECIMALS = 6

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

async function sendUsdtEthereum(
  walletId: string,
  treasuryAddress: string,
  amount: number,
  authorizationContext: AuthorizationContext,
): Promise<{ txHash: string }> {
  const data = encodeFunctionData({
    abi: ERC20_TRANSFER_ABI,
    functionName: "transfer",
    args: [
      treasuryAddress as `0x${string}`,
      parseUnits(amount.toString(), USDT_DECIMALS),
    ],
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (privyClient.wallets() as any).rpc(walletId, {
    method: "eth_sendTransaction",
    caip2: "eip155:1",
    chain_type: "ethereum",
    sponsor: shouldSponsor("ethereum"),
    params: {
      transaction: {
        to: ETH_USDT_ADDRESS,
        data,
        value: "0x0",
      },
    },
    authorization_context: authorizationContext,
  })

  return { txHash: result.data?.hash }
}

async function sendUsdtSolana(
  walletId: string,
  fromAddress: string,
  treasuryAddress: string,
  amount: number,
  authorizationContext: AuthorizationContext,
): Promise<{ txHash: string }> {
  const connection = new Connection(
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
      process.env.NEXT_PUBLIC_SOL_RPC ||
      "https://api.mainnet-beta.solana.com",
  )

  const fromPubkey = new PublicKey(fromAddress)
  const toPubkey = new PublicKey(treasuryAddress)
  const mintPubkey = new PublicKey(SOL_USDT_MINT)

  const fromAta = await getAssociatedTokenAddress(mintPubkey, fromPubkey)
  const toAta = await getAssociatedTokenAddress(mintPubkey, toPubkey)

  // Pre-flight: verify source ATA has sufficient USDT balance
  const tokenAmount = Math.round(amount * Math.pow(10, USDT_DECIMALS))
  try {
    const sourceAccount = await getAccount(connection, fromAta)
    if (BigInt(tokenAmount) > sourceAccount.amount) {
      const available = Number(sourceAccount.amount) / Math.pow(10, USDT_DECIMALS)
      throw new Error(
        `Insufficient USDT balance. Available: ${available} USDT, requested: ${amount} USDT.`,
      )
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("Insufficient USDT")) throw e
    throw new Error("USDT token account not found — no USDT balance in this wallet.")
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
    sponsor: shouldSponsor("solana"),
    params: {
      encoding: "base64",
      transaction: serialized,
    },
    authorization_context: authorizationContext,
  })

  return { txHash: result.data?.hash }
}

/**
 * Sign a TRON transaction hash via Privy _rawSign and recover the 65-byte signature.
 * Privy returns 64-byte (r||s). TRON needs 65 bytes with recovery ID v appended.
 */
async function signTronTransaction(
  walletId: string,
  txID: string,
  walletAddress: string,
  authorizationPrivateKey: string,
): Promise<string> {
  const hash = txID.startsWith("0x") ? txID : `0x${txID}`

  const signResult = await (privyClient.wallets() as any)._rawSign(
    walletId,
    {
      params: { hash },
      "privy-authorization-signature": authorizationPrivateKey,
    },
  )

  // signResult.data.signature is 0x-prefixed 64-byte hex (r || s)
  const sig64 = (
    signResult.data?.signature || signResult.signature || signResult
  ).replace(/^0x/, "")

  // TRON requires 65-byte signature: r (32) + s (32) + v (1)
  const walletHex = TronWeb.address.toHex(walletAddress).toLowerCase()

  // Create a TronWeb instance for recovery verification
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
      // try the other v value
    }
  }

  // Fallback: use v=1b if recovery check fails
  return sig64 + "1b"
}

/**
 * Send USDT from user's Privy wallet to treasury via TRC-20 transfer (Tron).
 */
async function sendUsdtTron(
  walletId: string,
  fromAddress: string,
  treasuryAddress: string,
  amount: number,
  authorizationContext: AuthorizationContext,
): Promise<{ txHash: string }> {
  const tronWeb = new TronWeb({
    fullHost: process.env.TRON_RPC_URL || "https://api.trongrid.io",
    headers: process.env.TRON_API_KEY
      ? { "TRON-PRO-API-KEY": process.env.TRON_API_KEY }
      : {},
  })

  const tokenAmount = Math.round(amount * Math.pow(10, USDT_DECIMALS))
  const fromHex = TronWeb.address.toHex(fromAddress)

  // Build TRC-20 transfer via triggerSmartContract
  const { transaction: unsignedTx } =
    await tronWeb.transactionBuilder.triggerSmartContract(
      TRON_USDT_CONTRACT,
      "transfer(address,uint256)",
      { feeLimit: 100_000_000 }, // 100 TRX fee limit
      [
        { type: "address", value: treasuryAddress },
        { type: "uint256", value: tokenAmount },
      ],
      fromHex,
    )

  const txID = unsignedTx.txID

  // Get the authorization private key from the context
  const authKey = authorizationContext.authorization_private_keys?.[0]
  if (!authKey) {
    throw new Error("Missing Privy authorization key for Tron signing")
  }

  // Sign via Privy _rawSign
  const signature = await signTronTransaction(
    walletId,
    txID,
    fromAddress,
    authKey,
  )
  const signedTx = { ...unsignedTx, signature: [signature] }

  // Broadcast
  const result = await tronWeb.trx.sendRawTransaction(signedTx)
  if (!result.result && !result.txid) {
    throw new Error(`TRON broadcast failed: ${JSON.stringify(result)}`)
  }

  return { txHash: result.txid || txID }
}

export async function POST(request: NextRequest) {
  let parsedDepositId: string | null = null

  try {
    const { userId: clerkUserId, getToken } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { depositId } = await request.json()
    parsedDepositId = depositId
    if (!depositId) {
      return NextResponse.json(
        { error: "depositId required" },
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

    const deposit = await SpotDeposit.findOne({
      _id: depositId,
      userId: clerkUserId,
    })
    if (!deposit) {
      return NextResponse.json(
        { error: "Deposit not found" },
        { status: 404 },
      )
    }

    if (!["initiated", "sending_usdt"].includes(deposit.status)) {
      return NextResponse.json(
        { error: `Cannot send USDT in status: ${deposit.status}` },
        { status: 400 },
      )
    }

    if (!deposit.treasuryAddress) {
      return NextResponse.json(
        { error: "No treasury address assigned" },
        { status: 400 },
      )
    }

    const userWallet = await UserWallet.findOne({ clerkUserId })
    if (!userWallet) {
      return NextResponse.json(
        { error: "User wallet not found" },
        { status: 404 },
      )
    }

    const chainWalletMap: Record<string, any> = {
      solana: userWallet.wallets?.solana,
      ethereum: userWallet.wallets?.ethereum,
      tron: userWallet.wallets?.tron,
    }
    const sourceWallet = chainWalletMap[deposit.depositChain]

    if (!sourceWallet?.walletId || !sourceWallet?.address) {
      return NextResponse.json(
        {
          error: `No ${deposit.depositChain} wallet found for this user`,
        },
        { status: 404 },
      )
    }

    deposit.status = "sending_usdt"
    await deposit.save()

    const authContext = await createAuthorizationContext(clerkJwt)

    let txHash: string

    if (deposit.depositChain === "solana") {
      const result = await sendUsdtSolana(
        sourceWallet.walletId,
        sourceWallet.address,
        deposit.treasuryAddress,
        deposit.depositAmount,
        authContext,
      )
      txHash = result.txHash
    } else if (deposit.depositChain === "tron") {
      const result = await sendUsdtTron(
        sourceWallet.walletId,
        sourceWallet.address,
        deposit.treasuryAddress,
        deposit.depositAmount,
        authContext,
      )
      txHash = result.txHash
    } else {
      const result = await sendUsdtEthereum(
        sourceWallet.walletId,
        deposit.treasuryAddress,
        deposit.depositAmount,
        authContext,
      )
      txHash = result.txHash
    }

    deposit.depositTxHash = txHash
    deposit.status = "awaiting_deposit"
    await deposit.save()

    return NextResponse.json({
      success: true,
      txHash,
      deposit: {
        id: deposit._id,
        status: deposit.status,
        depositTxHash: txHash,
      },
    })
  } catch (error: any) {
    console.error("[Spot Deposit Send USDT] Error:", error)

    let userMessage = error.message || "Failed to send USDT"
    if (
      userMessage.includes("bandwidth") ||
      userMessage.includes("energy") ||
      userMessage.includes("AccountResourceInsufficient")
    ) {
      userMessage =
        "Insufficient TRX for transaction fees. You need at least 30 TRX in your Tron wallet to cover network energy costs. Please fund your wallet with TRX and try again."
    } else if (userMessage.includes("insufficient funds")) {
      userMessage =
        "Insufficient USDT balance to complete this deposit. Please check your wallet balance."
    }

    if (parsedDepositId) {
      try {
        await connectDB()
        await SpotDeposit.findByIdAndUpdate(parsedDepositId, {
          status: "failed",
          errorMessage: `USDT send failed: ${userMessage}`,
        })
      } catch {
        // Ignore cleanup errors
      }
    }

    return NextResponse.json({ error: userMessage }, { status: 500 })
  }
}

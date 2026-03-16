import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { connectDB } from "@/lib/mongodb"
import { UserWallet } from "@/models/UserWallet"
import { privyClient } from "@/lib/privy/client"
import { createAuthorizationContext } from "@/lib/privy/authorization"
import { Connection, PublicKey, Transaction } from "@solana/web3.js"
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token"

export async function POST(request: NextRequest) {
  try {
    const { userId, getToken } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const clerkJwt = await getToken()
    if (!clerkJwt) {
      return NextResponse.json(
        { error: "Auth token required" },
        { status: 401 },
      )
    }

    const { to, amount, mint, decimals } = await request.json()

    if (
      !to ||
      typeof to !== "string" ||
      to.length < 32 ||
      to.length > 44
    ) {
      return NextResponse.json(
        { error: "Invalid recipient address" },
        { status: 400 },
      )
    }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return NextResponse.json(
        { error: "Invalid amount" },
        { status: 400 },
      )
    }
    if (!mint || typeof mint !== "string") {
      return NextResponse.json(
        { error: "Token mint address required" },
        { status: 400 },
      )
    }
    const tokenDecimals = typeof decimals === "number" ? decimals : 6

    await connectDB()

    const userWallet = await UserWallet.findOne({ clerkUserId: userId })
    if (
      !userWallet?.wallets?.solana?.walletId ||
      !userWallet?.wallets?.solana?.address
    ) {
      return NextResponse.json(
        { error: "Solana wallet not found" },
        { status: 404 },
      )
    }

    const walletId = userWallet.wallets.solana.walletId
    const fromAddress = userWallet.wallets.solana.address

    const connection = new Connection(
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
        process.env.NEXT_PUBLIC_SOL_RPC ||
        "https://api.mainnet-beta.solana.com",
    )

    const fromPubkey = new PublicKey(fromAddress)
    const toPubkey = new PublicKey(to)
    const mintPubkey = new PublicKey(mint)

    const fromAta = await getAssociatedTokenAddress(mintPubkey, fromPubkey)
    const toAta = await getAssociatedTokenAddress(mintPubkey, toPubkey)

    const tx = new Transaction()
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

    const tokenAmount = Math.round(
      Number(amount) * Math.pow(10, tokenDecimals),
    )
    tx.add(
      createTransferInstruction(fromAta, toAta, fromPubkey, tokenAmount),
    )

    const serialized = tx
      .serialize({ requireAllSignatures: false })
      .toString("base64")

    const authContext = await createAuthorizationContext(clerkJwt)

    const result = await (privyClient.wallets() as any)
      .solana()
      .signAndSendTransaction(walletId, {
        caip2: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
        transaction: serialized,
        authorization_context: authContext,
      })

    const signature = result.signature || result.hash

    return NextResponse.json({ success: true, signature })
  } catch (error: any) {
    console.error("[SPL Send] Error:", error)
    return NextResponse.json(
      { error: error.message || "SPL token transfer failed" },
      { status: 500 },
    )
  }
}

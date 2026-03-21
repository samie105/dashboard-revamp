import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { ensureUserWallet } from "@/lib/ensureUserWallet"
import { connectDB } from "@/lib/mongodb"
import SpotV2Ledger from "@/models/SpotV2Ledger"
import SpotV2Deposit from "@/models/SpotV2Deposit"

const ADMIN_URL = process.env.ADMIN_BACKEND_URL
const ADMIN_KEY = process.env.ADMIN_BACKEND_API_KEY

const VALID_CHAINS = ["ethereum", "solana", "tron"] as const
const VALID_TOKENS = ["USDT", "USDC"] as const
const MIN_DEPOSIT = 2

export async function POST(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!ADMIN_URL || !ADMIN_KEY) {
      return NextResponse.json(
        { error: "Admin backend not configured" },
        { status: 503 },
      )
    }

    const body = await request.json()
    const {
      depositChain,
      depositAmount,
      depositFromAddress,
      depositToken = "USDT",
    } = body

    // Validate chain
    if (!depositChain || !VALID_CHAINS.includes(depositChain)) {
      return NextResponse.json(
        { error: "Invalid chain. Supported: ethereum, solana, tron" },
        { status: 400 },
      )
    }

    // Validate token
    if (!VALID_TOKENS.includes(depositToken)) {
      return NextResponse.json(
        { error: "Invalid token. Supported: USDT, USDC" },
        { status: 400 },
      )
    }

    // Validate amount
    if (
      !depositAmount ||
      typeof depositAmount !== "number" ||
      depositAmount < MIN_DEPOSIT
    ) {
      return NextResponse.json(
        { error: `Minimum deposit is ${MIN_DEPOSIT} ${depositToken}` },
        { status: 400 },
      )
    }

    // Validate from address
    if (
      !depositFromAddress ||
      typeof depositFromAddress !== "string" ||
      depositFromAddress.length < 10
    ) {
      return NextResponse.json(
        { error: "depositFromAddress is required" },
        { status: 400 },
      )
    }

    const userWallet = await ensureUserWallet(clerkUserId)
    if (!userWallet?.wallets?.ethereum?.address) {
      return NextResponse.json(
        { error: "Wallet not found. Please refresh the page." },
        { status: 404 },
      )
    }

    const userWalletAddress =
      depositChain === "solana"
        ? userWallet.wallets.solana?.address
        : depositChain === "tron"
          ? userWallet.wallets.tron?.address
          : userWallet.wallets.ethereum?.address

    if (!userWalletAddress) {
      return NextResponse.json(
        { error: `No ${depositChain} wallet found for your account` },
        { status: 404 },
      )
    }

    // Call admin backend to create deposit request
    const adminRes = await fetch(`${ADMIN_URL}/api/deposits`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ADMIN_KEY,
      },
      body: JSON.stringify({
        userId: clerkUserId,
        userWalletAddress,
        walletType: "spot",
        chain: depositChain,
        requestedToken: depositToken,
        requestedAmount: depositAmount,
        depositChain,
        depositToken,
        depositAmount,
        depositFromAddress,
        skipDisbursement: true,
      }),
    })

    if (!adminRes.ok) {
      const errData = await adminRes.json().catch(() => ({}))
      console.error("[SpotV2 Deposit] Admin error:", errData)
      return NextResponse.json(
        { error: errData.message || "Failed to create deposit" },
        { status: adminRes.status },
      )
    }

    const adminData = await adminRes.json()
    const adminDepositId = adminData.deposit?._id || adminData.depositId
    const treasuryAddress =
      adminData.treasuryAddress || adminData.deposit?.treasuryAddress
    const treasuryChain = adminData.treasuryChain || depositChain

    await connectDB()

    // Ensure ledger entry exists for USDC
    await SpotV2Ledger.findOneAndUpdate(
      { userId: clerkUserId, token: "USDC" },
      { $setOnInsert: { available: 0, locked: 0 } },
      { upsert: true },
    )

    // Save local deposit record for status tracking + double-credit prevention
    const localDeposit = await SpotV2Deposit.create({
      userId: clerkUserId,
      adminDepositId,
      depositChain,
      depositToken,
      depositAmount,
      depositFromAddress,
      treasuryAddress,
      treasuryChain,
      status: "initiated",
      credited: false,
      creditedAmount: 0,
    })

    return NextResponse.json({
      success: true,
      deposit: {
        id: localDeposit._id,
        adminDepositId,
        treasuryAddress,
        treasuryChain,
        depositChain,
        depositToken,
        depositAmount,
        status: "initiated",
      },
    })
  } catch (error: unknown) {
    console.error("[SpotV2 Deposit Initiate] Error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}

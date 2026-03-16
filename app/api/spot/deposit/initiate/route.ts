import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { ensureUserWallet } from "@/lib/ensureUserWallet"
import SpotDeposit from "@/models/SpotDeposit"

const ADMIN_URL = process.env.ADMIN_BACKEND_URL
const ADMIN_KEY = process.env.ADMIN_BACKEND_API_KEY

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

    const {
      depositChain,
      depositAmount,
      depositFromAddress,
      depositToken = "USDT",
    } = await request.json()

    if (!depositChain || !["ethereum", "solana"].includes(depositChain)) {
      return NextResponse.json(
        { error: "Invalid depositChain (ethereum | solana)" },
        { status: 400 },
      )
    }
    if (!depositAmount || depositAmount < 5) {
      return NextResponse.json(
        { error: "Minimum deposit is 5 USDC equivalent" },
        { status: 400 },
      )
    }
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
    if (
      !userWallet?.tradingWallet?.walletId ||
      !userWallet?.tradingWallet?.address
    ) {
      return NextResponse.json(
        {
          error:
            "Wallet setup failed. Please refresh the page and try again.",
        },
        { status: 404 },
      )
    }

    const adminRes = await fetch(`${ADMIN_URL}/api/deposits`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ADMIN_KEY,
      },
      body: JSON.stringify({
        userId: clerkUserId,
        userWalletAddress: userWallet.tradingWallet.address,
        depositFromAddress,
        walletType: "spot",
        chain: "arbitrum",
        requestedToken: "USDC",
        requestedAmount: depositAmount,
        depositChain,
        depositToken,
        depositAmount,
      }),
    })

    if (!adminRes.ok) {
      const errData = await adminRes.json().catch(() => ({}))
      console.error("[Spot Deposit] Admin backend error:", errData)
      return NextResponse.json(
        {
          error:
            errData.message ||
            "Failed to create deposit on admin backend",
        },
        { status: adminRes.status },
      )
    }

    const adminData = await adminRes.json()

    const deposit = await SpotDeposit.create({
      userId: clerkUserId,
      email: userWallet.email,
      depositChain,
      depositToken,
      depositAmount,
      depositFromAddress,
      treasuryAddress:
        adminData.treasuryAddress || adminData.deposit?.treasuryAddress,
      treasuryChain: adminData.treasuryChain || depositChain,
      adminDepositId: adminData.deposit?._id || adminData.depositId,
      tradingWalletAddress: userWallet.tradingWallet.address,
      tradingWalletId: userWallet.tradingWallet.walletId,
      status: "initiated",
    })

    return NextResponse.json({
      success: true,
      deposit: {
        id: deposit._id,
        status: deposit.status,
        treasuryAddress: deposit.treasuryAddress,
        treasuryChain: deposit.treasuryChain,
        depositChain,
        depositAmount,
        depositToken,
      },
    })
  } catch (error: any) {
    console.error("[Spot Deposit Initiate] Error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    )
  }
}

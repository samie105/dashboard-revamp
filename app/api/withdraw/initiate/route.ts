import { NextRequest, NextResponse } from "next/server"
import { auth, currentUser } from "@clerk/nextjs/server"
import { connectDB } from "@/lib/mongodb"
import Withdrawal from "@/models/Withdrawal"
import TreasuryWallet from "@/models/TreasuryWallet"
import { UserWallet } from "@/models/UserWallet"

// ── POST /api/withdraw/initiate ────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await currentUser()
    const email = user?.emailAddresses?.[0]?.emailAddress || ""

    await connectDB()

    const body = await req.json()
    const { usdtAmount, chain, bankDetails } = body

    if (!usdtAmount || !chain || !bankDetails) {
      return NextResponse.json(
        { error: "usdtAmount, chain, and bankDetails are required" },
        { status: 400 },
      )
    }

    if (!["solana", "ethereum"].includes(chain)) {
      return NextResponse.json({ error: "chain must be 'solana' or 'ethereum'" }, { status: 400 })
    }

    if (usdtAmount < 1 || usdtAmount > 5000) {
      return NextResponse.json({ error: "Amount must be between 1 and 5000 USDT" }, { status: 400 })
    }

    if (!bankDetails.bankName || !bankDetails.accountNumber || !bankDetails.accountName) {
      return NextResponse.json(
        { error: "bankDetails must include bankName, accountNumber, and accountName" },
        { status: 400 },
      )
    }

    // Get user's wallet address
    const userWallet = await UserWallet.findOne({
      $or: [{ clerkUserId: userId }, { email: email.toLowerCase() }],
    }).lean()

    const walletData = userWallet?.wallets as Record<string, { address?: string }> | undefined
    const userWalletAddress = walletData?.[chain]?.address

    if (!userWalletAddress) {
      return NextResponse.json(
        { error: `No ${chain} wallet found. Set up your wallet first.` },
        { status: 400 },
      )
    }

    // Fetch exchange rate
    let exchangeRate: number
    try {
      const rateRes = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=ngn",
        { signal: AbortSignal.timeout(10_000) },
      )
      const rateData = await rateRes.json()
      const baseRate = rateData?.tether?.ngn
      if (!baseRate) throw new Error("Rate unavailable")
      exchangeRate = baseRate * 0.95 // 5% withdrawal fee
    } catch {
      return NextResponse.json({ error: "Failed to fetch exchange rate." }, { status: 503 })
    }

    const fiatAmount = Math.round(usdtAmount * exchangeRate * 100) / 100

    // Get treasury wallet
    const treasuryWallet = await TreasuryWallet.findOne({ isActive: true, network: chain }).lean()

    if (!treasuryWallet) {
      return NextResponse.json(
        { error: `No active treasury wallet for ${chain}. Contact support.` },
        { status: 503 },
      )
    }

    const withdrawal = await Withdrawal.create({
      userId,
      email,
      usdtAmount,
      fiatAmount,
      fiatCurrency: "NGN",
      exchangeRate,
      chain,
      userWalletAddress,
      treasuryWalletAddress: treasuryWallet.address,
      bankDetails,
      status: "pending",
    })

    return NextResponse.json({
      success: true,
      withdrawal: {
        id: withdrawal._id.toString(),
        usdtAmount: withdrawal.usdtAmount,
        fiatAmount: withdrawal.fiatAmount,
        exchangeRate: withdrawal.exchangeRate,
        chain: withdrawal.chain,
        treasuryWalletAddress: treasuryWallet.address,
        status: withdrawal.status,
      },
    })
  } catch (err) {
    console.error("Withdrawal initiate error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

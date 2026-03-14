import { NextRequest, NextResponse } from "next/server"
import { auth, currentUser } from "@clerk/nextjs/server"
import { connectDB } from "@/lib/mongodb"
import Deposit from "@/models/Deposit"
import { UserWallet } from "@/models/UserWallet"
import { randomUUID } from "crypto"

// ── Constants ──────────────────────────────────────────────────────────────

const GLOBALPAY_BASE = "https://paygw.globalpay.com.ng/globalpay-paymentgateway/api"
const GLOBALPAY_API_KEY = process.env.NEXT_PUBLIC_GLOBALPAY_API_KEY || ""
const MIN_USDT = 1
const MAX_USDT = 5000
const PLATFORM_MARKUP = 5

// ── Inline rate fetcher ────────────────────────────────────────────────────

async function fetchBuyRate(
  fiatCurrency: string,
): Promise<{ buyRate: number; marketRate: number } | null> {
  try {
    const geckoRes = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=usd,ngn,gbp",
      { signal: AbortSignal.timeout(10_000) },
    )
    if (!geckoRes.ok) return null

    const geckoData = await geckoRes.json()
    const tether = geckoData.tether || {}
    const fiatMap: Record<string, number> = {
      NGN: tether.ngn || 1580,
      USD: tether.usd || 1,
      GBP: tether.gbp || 0.79,
    }

    const marketRate = fiatMap[fiatCurrency]
    if (!marketRate) return null

    const buyRate = marketRate * (1 + PLATFORM_MARKUP / 100)
    return {
      buyRate: Math.round(buyRate * 100) / 100,
      marketRate: Math.round(marketRate * 100) / 100,
    }
  } catch (err) {
    console.error("Rate fetch error in deposit/initiate:", err)
    return null
  }
}

// ── POST /api/deposit/initiate ─────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const user = await currentUser()
    const email = user?.emailAddresses?.[0]?.emailAddress || ""

    const body = await request.json()
    const { usdtAmount, fiatCurrency = "NGN", network = "solana" } = body

    if (!["solana", "ethereum"].includes(network)) {
      return NextResponse.json({ success: false, message: "Invalid network." }, { status: 400 })
    }

    const amount = parseFloat(usdtAmount)
    if (!amount || amount < MIN_USDT || amount > MAX_USDT) {
      return NextResponse.json(
        { success: false, message: `Amount must be between ${MIN_USDT} and ${MAX_USDT} USDT` },
        { status: 400 },
      )
    }

    await connectDB()

    // Get wallet address from UserWallet (Privy-generated wallets)
    const userWallet = await UserWallet.findOne({
      $or: [{ clerkUserId: userId }, { email: email.toLowerCase() }],
    }).lean()

    const walletData = userWallet?.wallets as Record<string, { address?: string }> | undefined
    const walletAddress = walletData?.[network]?.address
    if (!walletAddress) {
      return NextResponse.json(
        { success: false, message: `${network === "solana" ? "Solana" : "Ethereum"} wallet not set up. Go to Assets first.` },
        { status: 400 },
      )
    }

    // Fetch exchange rate
    const rate = await fetchBuyRate(fiatCurrency)
    if (!rate?.buyRate) {
      return NextResponse.json({ success: false, message: "Exchange rate unavailable." }, { status: 502 })
    }

    const fiatAmount = Math.round(amount * rate.buyRate * 100) / 100
    const merchantTxRef = `WS-DEP-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`

    // Call GlobalPay
    const gpRes = await fetch(`${GLOBALPAY_BASE}/paymentgateway/generate-payment-link`, {
      method: "POST",
      headers: {
        apiKey: GLOBALPAY_API_KEY,
        "Content-Type": "application/json",
        language: "en",
      },
      body: JSON.stringify({
        amount: fiatAmount,
        merchantTransactionReference: merchantTxRef,
        customer: {
          firstName: user?.firstName || "WorldStreet",
          lastName: user?.lastName || "Customer",
          currency: fiatCurrency,
          phoneNumber: "08000000000",
          address: "Lagos, Nigeria",
          emailAddress: email,
        },
      }),
    })

    const gpData = await gpRes.json()

    if (!gpData.isSuccessful || !gpData.data?.checkoutUrl) {
      console.error("GlobalPay generate-payment-link failed:", gpData)
      return NextResponse.json(
        { success: false, message: gpData.successMessage || "Failed to create payment link." },
        { status: 502 },
      )
    }

    // Create deposit record
    const deposit = await Deposit.create({
      userId,
      email,
      usdtAmount: amount,
      fiatAmount,
      fiatCurrency,
      exchangeRate: rate.buyRate,
      merchantTransactionReference: merchantTxRef,
      globalPayTransactionReference: gpData.data.transactionReference || "",
      checkoutUrl: gpData.data.checkoutUrl,
      network,
      userWalletAddress: walletAddress,
      status: "pending",
    })

    return NextResponse.json({
      success: true,
      deposit: {
        _id: deposit._id,
        usdtAmount: deposit.usdtAmount,
        fiatAmount: deposit.fiatAmount,
        fiatCurrency: deposit.fiatCurrency,
        exchangeRate: deposit.exchangeRate,
        network: deposit.network,
        merchantTransactionReference: deposit.merchantTransactionReference,
        status: deposit.status,
        createdAt: deposit.createdAt,
      },
      checkoutUrl: gpData.data.checkoutUrl,
    })
  } catch (error) {
    console.error("POST /api/deposit/initiate error:", error)
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 })
  }
}

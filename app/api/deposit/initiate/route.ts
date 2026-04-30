import { NextRequest, NextResponse } from "next/server"
import { auth, currentUser } from "@clerk/nextjs/server"
import { connectDB } from "@/lib/mongodb"
import Deposit from "@/models/Deposit"
import { UserWallet } from "@/models/UserWallet"
import { flutterwaveFetch } from "@/lib/flutterwave/client"
import { FALLBACK_RATES } from "@/lib/flutterwave/config"
import { randomUUID } from "crypto"

// ── Constants ──────────────────────────────────────────────────────────────

const MIN_USDT = 1
const MAX_USDT = 5000
const PLATFORM_MARKUP = 5
const VALID_CURRENCIES = ["NGN", "GHS"]
const VALID_NETWORKS = ["solana", "ethereum"]

// ── Inline rate fetcher ────────────────────────────────────────────────────

async function fetchBuyRate(
  fiatCurrency: string,
): Promise<{ buyRate: number; marketRate: number } | null> {
  try {
    const geckoRes = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=usd,ngn,ghs`,
      { signal: AbortSignal.timeout(10_000) },
    )
    if (!geckoRes.ok) {
      console.warn("CoinGecko API returned non-OK status, using fallback rates")
      return getFallbackRate(fiatCurrency)
    }

    const geckoData = await geckoRes.json()
    const tether = geckoData.tether || {}
    const fiatMap: Record<string, number> = {
      NGN: tether.ngn,
      GHS: tether.ghs,
      USD: tether.usd,
    }

    const marketRate = fiatMap[fiatCurrency]
    if (!marketRate) {
      console.warn(`CoinGecko missing rate for ${fiatCurrency}, using fallback`)
      return getFallbackRate(fiatCurrency)
    }

    const buyRate = marketRate * (1 + PLATFORM_MARKUP / 100)
    return {
      buyRate: Math.round(buyRate * 100) / 100,
      marketRate: Math.round(marketRate * 100) / 100,
    }
  } catch (err) {
    console.error("Rate fetch error in deposit/initiate:", err)
    return getFallbackRate(fiatCurrency)
  }
}

function getFallbackRate(fiatCurrency: string): { buyRate: number; marketRate: number } | null {
  const fallback = FALLBACK_RATES[fiatCurrency]
  if (!fallback) return null

  const buyRate = fallback * (1 + PLATFORM_MARKUP / 100)
  return {
    buyRate: Math.round(buyRate * 100) / 100,
    marketRate: fallback,
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

    // Validate currency
    if (!VALID_CURRENCIES.includes(fiatCurrency)) {
      return NextResponse.json(
        { success: false, message: `Invalid currency. Supported: ${VALID_CURRENCIES.join(", ")}` },
        { status: 400 },
      )
    }

    // Validate network
    if (!VALID_NETWORKS.includes(network)) {
      return NextResponse.json(
        { success: false, message: `Invalid network. Supported: ${VALID_NETWORKS.join(", ")}` },
        { status: 400 },
      )
    }

    const amount = parseFloat(usdtAmount)
    if (!amount || amount < MIN_USDT || amount > MAX_USDT) {
      return NextResponse.json(
        { success: false, message: `Amount must be between ${MIN_USDT} and ${MAX_USDT} USDT` },
        { status: 400 },
      )
    }

    await connectDB()

    // ── Idempotency: check for existing pending deposit ──
    const existingPending = await Deposit.findOne({
      userId,
      status: { $in: ["pending", "awaiting_verification", "verifying"] },
    }).sort({ createdAt: -1 })

    if (existingPending) {
      return NextResponse.json({
        success: true,
        deposit: {
          _id: existingPending._id,
          usdtAmount: existingPending.usdtAmount,
          fiatAmount: existingPending.fiatAmount,
          fiatCurrency: existingPending.fiatCurrency,
          exchangeRate: existingPending.exchangeRate,
          network: existingPending.network,
          status: existingPending.status,
          createdAt: existingPending.createdAt,
        },
        checkoutUrl: existingPending.checkoutUrl,
        message: "You already have a pending deposit. Please complete it or cancel before creating a new one.",
      })
    }

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
    const txRef = `WS-DEP-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`

    // ── Call Flutterwave first, then save deposit ──
    const flutterwaveCharge = await flutterwaveFetch<{
      id: string
      tx_ref: string
      amount: number
      currency: string
      status: string
      link: string
    }>("/charges", {
      method: "POST",
      body: JSON.stringify({
        tx_ref: txRef,
        amount: fiatAmount,
        currency: fiatCurrency,
        redirect_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://www.worldstreetgold.com"}/deposit?depositId=`,
        customer: {
          email,
          name: `${user?.firstName || "WorldStreet"} ${user?.lastName || "Customer"}`.trim(),
        },
        customizations: {
          title: "WorldStreet Deposit",
          description: `Buy ${amount} USDT`,
          logo: "https://www.worldstreetgold.com/logo.png",
        },
        meta: {
          userId,
          usdtAmount: amount,
          network,
          walletAddress,
        },
      }),
      idempotencyKey: txRef,
    })

    if (!flutterwaveCharge.link) {
      console.error("Flutterwave charge created but no checkout link returned:", flutterwaveCharge)
      return NextResponse.json(
        { success: false, message: "Failed to create payment link. Please try again." },
        { status: 502 },
      )
    }

    // ── Only save deposit after successful Flutterwave response ──
    const deposit = await Deposit.create({
      userId,
      email,
      usdtAmount: amount,
      fiatAmount,
      fiatCurrency,
      exchangeRate: rate.buyRate,
      merchantTransactionReference: txRef,
      network,
      userWalletAddress: walletAddress,
      status: "pending",
      paymentProvider: "flutterwave",
      flutterwaveChargeId: flutterwaveCharge.id,
      flutterwaveReference: flutterwaveCharge.tx_ref,
      checkoutUrl: flutterwaveCharge.link,
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
        status: deposit.status,
        createdAt: deposit.createdAt,
      },
      checkoutUrl: flutterwaveCharge.link,
    })
  } catch (error) {
    console.error("POST /api/deposit/initiate error:", error)
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

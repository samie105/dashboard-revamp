import { NextRequest, NextResponse } from "next/server"
import { auth, currentUser } from "@clerk/nextjs/server"
import { connectDB } from "@/lib/mongodb"
import Deposit from "@/models/Deposit"
import { UserWallet } from "@/models/UserWallet"
import { flutterwaveFetch } from "@/lib/flutterwave/client"
import { FALLBACK_RATES } from "@/lib/flutterwave/config"
import { randomUUID } from "crypto"
import {
  cancelAdminFiatReservation,
  getAdminFiatAvailability,
  reserveAdminFiatDeposit,
  type FiatDepositNetwork,
} from "@/lib/deposit/admin-fiat"

// ── Constants ──────────────────────────────────────────────────────────────

const MIN_USDT = 1
const MAX_USDT = 5000
const PLATFORM_MARKUP = 5
const VALID_CURRENCIES = ["NGN", "GHS"]
const VALID_NETWORKS = ["solana", "ethereum", "tron"] as const

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

function networkLabel(network: string) {
  if (network === "ethereum") return "Ethereum"
  if (network === "tron") return "Tron"
  return "Solana"
}

// ── POST /api/deposit/initiate ─────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Check required env vars early
    if (!process.env.FLUTTERWAVE_SECRET_KEY) {
      console.error("FLUTTERWAVE_SECRET_KEY is not set")
      return NextResponse.json(
        { success: false, message: "Payment provider not configured" },
        { status: 503 },
      )
    }

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
    const depositNetwork = network as FiatDepositNetwork

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
      const reservationExpired =
        existingPending.reservationExpiresAt && existingPending.reservationExpiresAt.getTime() <= Date.now()

      if (reservationExpired) {
        await cancelAdminFiatReservation(existingPending.merchantTransactionReference, "Local pending deposit expired")
        existingPending.status = "cancelled"
        existingPending.deliveryError = "Reservation expired before payment"
        await existingPending.save()
      } else {
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
    }

    // Get wallet address from UserWallet (Privy-generated wallets)
    const userWallet = await UserWallet.findOne({
      $or: [{ clerkUserId: userId }, { email: email.toLowerCase() }],
    }).lean()

    const walletData = userWallet?.wallets as Record<string, { address?: string }> | undefined
    const walletAddress = walletData?.[depositNetwork]?.address
    if (!walletAddress) {
      return NextResponse.json(
        { success: false, message: `${networkLabel(depositNetwork)} wallet not set up. Go to Assets first.` },
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

    // Reserve treasury capacity before creating a checkout link.
    const availability = await getAdminFiatAvailability()
    const networkAvailability = availability.chains?.[depositNetwork]
    if (!networkAvailability?.enabled) {
      return NextResponse.json(
        { success: false, message: networkAvailability?.reason || "This network is temporarily unavailable." },
        { status: 503 },
      )
    }
    if (networkAvailability.available < amount) {
      return NextResponse.json(
        {
          success: false,
          message: `Only ${networkAvailability.available.toFixed(2)} USDT is currently available on ${networkLabel(depositNetwork)}.`,
        },
        { status: 409 },
      )
    }

    const reservation = await reserveAdminFiatDeposit({
      externalReference: txRef,
      userId,
      userWalletAddress: walletAddress,
      chain: depositNetwork,
      amount,
      fiatCurrency,
      fiatAmount,
    })

    let deposit
    try {
      deposit = await Deposit.create({
        userId,
        email,
        usdtAmount: amount,
        fiatAmount,
        fiatCurrency,
        exchangeRate: rate.buyRate,
        merchantTransactionReference: txRef,
        network: depositNetwork,
        userWalletAddress: walletAddress,
        status: "pending",
        paymentProvider: "flutterwave",
        adminDepositId: reservation.adminDepositId,
        reservationExpiresAt: new Date(reservation.reservationExpiresAt),
      })
    } catch (dbError) {
      await cancelAdminFiatReservation(txRef, "Dashboard failed to create local deposit")
      throw dbError
    }

    let flutterwaveCharge
    try {
      flutterwaveCharge = await flutterwaveFetch<{
        id: string
        tx_ref: string
        amount: number
        currency: string
        status: string
        link: string
      }>("/payments", {
        method: "POST",
        body: JSON.stringify({
          tx_ref: txRef,
          amount: fiatAmount,
          currency: fiatCurrency,
          redirect_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://dashboard.worldstreetgold.com"}/deposit?tx_ref=${txRef}`,
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
            network: depositNetwork,
            walletAddress,
            adminDepositId: reservation.adminDepositId,
          },
        }),
        idempotencyKey: txRef,
      })
    } catch (fwError) {
      console.error("Flutterwave API error:", fwError)
      await cancelAdminFiatReservation(txRef, "Flutterwave checkout creation failed")
      deposit.status = "cancelled"
      deposit.deliveryError = "Payment provider error before checkout"
      await deposit.save()
      return NextResponse.json(
        { success: false, message: "Payment provider error. Please try again later." },
        { status: 502 },
      )
    }

    if (!flutterwaveCharge.link) {
      console.error("Flutterwave charge created but no checkout link returned:", flutterwaveCharge)
      await cancelAdminFiatReservation(txRef, "Flutterwave checkout returned no payment link")
      deposit.status = "cancelled"
      deposit.deliveryError = "Payment provider returned no checkout link"
      await deposit.save()
      return NextResponse.json(
        { success: false, message: "Failed to create payment link. Please try again." },
        { status: 502 },
      )
    }

    deposit.flutterwaveChargeId = flutterwaveCharge.id
    deposit.flutterwaveReference = flutterwaveCharge.tx_ref
    deposit.checkoutUrl = flutterwaveCharge.link
    await deposit.save()

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

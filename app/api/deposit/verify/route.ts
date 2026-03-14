import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { connectDB } from "@/lib/mongodb"
import Deposit from "@/models/Deposit"

// ── Constants ──────────────────────────────────────────────────────────────

const GLOBALPAY_BASE = "https://paygw.globalpay.com.ng/globalpay-paymentgateway/api"
const GLOBALPAY_API_KEY = process.env.NEXT_PUBLIC_GLOBALPAY_API_KEY || ""

// ── POST /api/deposit/verify ───────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { depositId } = body

    if (!depositId) {
      return NextResponse.json({ success: false, message: "Deposit ID is required." }, { status: 400 })
    }

    await connectDB()

    const deposit = await Deposit.findOne({ _id: depositId, userId })

    if (!deposit) {
      return NextResponse.json({ success: false, message: "Deposit not found" }, { status: 404 })
    }

    if (!["pending", "awaiting_verification", "payment_failed"].includes(deposit.status)) {
      return NextResponse.json({
        success: true,
        deposit: deposit.toObject(),
        message: `Deposit is already ${deposit.status}`,
      })
    }

    // Update status to verifying
    deposit.status = "verifying"
    await deposit.save()

    // Requery GlobalPay
    const refToQuery = deposit.globalPayTransactionReference || deposit.merchantTransactionReference

    if (!refToQuery) {
      deposit.status = "payment_failed"
      await deposit.save()
      return NextResponse.json({
        success: false,
        deposit: deposit.toObject(),
        message: "No transaction reference available. Please contact support.",
      })
    }

    const gpRes = await fetch(
      `${GLOBALPAY_BASE}/paymentgateway/query-single-transaction/${refToQuery}`,
      {
        method: "POST",
        headers: { apiKey: GLOBALPAY_API_KEY, "Content-Type": "application/json", language: "en" },
      },
    )

    const gpData = await gpRes.json()

    if (!gpData.isSuccessful) {
      deposit.status = "awaiting_verification"
      await deposit.save()
      return NextResponse.json({
        success: false,
        deposit: deposit.toObject(),
        message: gpData.successMessage || "Payment has not been confirmed yet. Please wait and try again.",
      })
    }

    const txStatus = (gpData.data?.transactionStatus || "").toLowerCase()

    if (txStatus === "successful" || txStatus === "completed" || txStatus === "approved") {
      deposit.status = "payment_confirmed"
      await deposit.save()

      // USDT delivery is handled server-side by webhook or admin action
      // For now mark as payment_confirmed — the webhook or cron will deliver USDT
      deposit.status = "sending_usdt"
      await deposit.save()

      return NextResponse.json({
        success: true,
        deposit: deposit.toObject(),
        message: "Payment confirmed! USDT is being sent to your wallet.",
      })
    } else if (txStatus === "failed" || txStatus === "declined") {
      deposit.status = "payment_failed"
      await deposit.save()
      return NextResponse.json({
        success: false,
        deposit: deposit.toObject(),
        message: "Payment was not successful. Please try again.",
      })
    } else {
      deposit.status = "awaiting_verification"
      await deposit.save()
      return NextResponse.json({
        success: true,
        deposit: deposit.toObject(),
        message: "Payment is still processing. Please wait and try again.",
      })
    }
  } catch (error) {
    console.error("POST /api/deposit/verify error:", error)
    return NextResponse.json({ success: false, message: "Failed to verify deposit" }, { status: 500 })
  }
}

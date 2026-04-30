import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { connectDB } from "@/lib/mongodb"
import Deposit from "@/models/Deposit"
import { verifyCharge } from "@/lib/flutterwave/verify"
import { normalizeFlutterwaveStatus } from "@/lib/flutterwave/webhook"

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

    // If no flutterwave charge ID yet, payment is still being set up
    if (!deposit.flutterwaveChargeId) {
      return NextResponse.json({
        success: true,
        deposit: deposit.toObject(),
        message: "Payment still processing. Please wait a moment and try again.",
      })
    }

    // Update status to verifying
    deposit.status = "verifying"
    await deposit.save()

    // ── Re-verify via Flutterwave API ──
    const charge = await verifyCharge(deposit.flutterwaveChargeId)
    const normalizedStatus = normalizeFlutterwaveStatus(charge.status)

    // Validate amount/currency with tolerance
    const amountDiff = Math.abs(charge.amount - deposit.fiatAmount)
    if (amountDiff > 1.0 || charge.currency !== deposit.fiatCurrency) {
      console.error("Amount/currency mismatch on verify:", {
        depositId: deposit._id,
        expected: { amount: deposit.fiatAmount, currency: deposit.fiatCurrency },
        actual: { amount: charge.amount, currency: charge.currency },
      })
      deposit.status = "payment_failed"
      await deposit.save()
      return NextResponse.json({
        success: false,
        deposit: deposit.toObject(),
        message: "Payment amount or currency mismatch detected. Please contact support.",
      })
    }

    if (normalizedStatus === "successful") {
      deposit.status = "payment_confirmed"
      await deposit.save()

      return NextResponse.json({
        success: true,
        deposit: deposit.toObject(),
        message: "Payment confirmed! Your USDT will be sent shortly.",
      })
    } else if (normalizedStatus === "failed") {
      deposit.status = "payment_failed"
      await deposit.save()
      return NextResponse.json({
        success: false,
        deposit: deposit.toObject(),
        message: "Payment was not successful. Please try again.",
      })
    } else if (normalizedStatus === "cancelled") {
      deposit.status = "cancelled"
      await deposit.save()
      return NextResponse.json({
        success: false,
        deposit: deposit.toObject(),
        message: "Payment was cancelled.",
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
    const message = error instanceof Error ? error.message : "Failed to verify deposit"
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

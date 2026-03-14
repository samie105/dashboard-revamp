import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Deposit from "@/models/Deposit"

// ── GlobalPay Webhook ──────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    console.log("GlobalPay webhook received:", JSON.stringify(body).slice(0, 1000))

    const transactionReference =
      body.transactionReference ||
      body.data?.transactionReference ||
      body.TransactionReference ||
      body.data?.TransactionReference ||
      ""

    const merchantReference =
      body.merchantTransactionReference ||
      body.data?.merchantTransactionReference ||
      body.MerchantTransactionReference ||
      body.data?.MerchantTransactionReference ||
      ""

    const paymentStatus = (
      body.transactionStatus ||
      body.data?.transactionStatus ||
      body.TransactionStatus ||
      body.data?.TransactionStatus ||
      body.status ||
      ""
    ).toLowerCase()

    if (!transactionReference && !merchantReference) {
      return NextResponse.json({ success: false, message: "No transaction reference" }, { status: 400 })
    }

    await connectDB()

    let deposit = null
    if (transactionReference) {
      deposit = await Deposit.findOne({ globalPayTransactionReference: transactionReference })
    }
    if (!deposit && merchantReference) {
      deposit = await Deposit.findOne({ merchantTransactionReference: merchantReference })
    }

    if (!deposit) {
      return NextResponse.json({ success: false, message: "Deposit not found" }, { status: 404 })
    }

    if (["completed", "cancelled"].includes(deposit.status)) {
      return NextResponse.json({ success: true, message: `Deposit already ${deposit.status}` })
    }

    if (paymentStatus === "successful" || paymentStatus === "completed" || paymentStatus === "approved") {
      deposit.status = "payment_confirmed"
      await deposit.save()

      // Mark as sending — actual USDT delivery handled by treasury service
      deposit.status = "sending_usdt"
      await deposit.save()

      return NextResponse.json({ success: true, message: "Payment processed" })
    } else if (paymentStatus === "failed" || paymentStatus === "declined") {
      deposit.status = "payment_failed"
      await deposit.save()
      return NextResponse.json({ success: true, message: "Payment failure recorded" })
    } else {
      return NextResponse.json({ success: true, message: `Status noted: ${paymentStatus}` })
    }
  } catch (error) {
    console.error("GlobalPay webhook error:", error)
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: "active", endpoint: "GlobalPay deposit webhook" })
}

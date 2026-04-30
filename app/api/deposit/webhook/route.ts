import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Deposit from "@/models/Deposit"
import { verifyCharge } from "@/lib/flutterwave/verify"
import {
  verifyWebhookSignature,
  extractChargeIdFromWebhook,
  extractWebhookEventId,
  extractWebhookReference,
  normalizeFlutterwaveStatus,
} from "@/lib/flutterwave/webhook"

const FLW_SECRET_HASH = process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH
const isDev = process.env.NODE_ENV !== "production"

// ── Flutterwave Webhook ──────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Read raw body for signature verification
    const rawBody = await request.text()
    const signature = request.headers.get("flutterwave-signature")

    // Verify signature
    if (FLW_SECRET_HASH) {
      const isValid = verifyWebhookSignature(rawBody, signature, FLW_SECRET_HASH)
      if (!isValid) {
        console.error("Invalid Flutterwave webhook signature")
        return NextResponse.json({ success: false, message: "Invalid signature" }, { status: 401 })
      }
    } else if (isDev) {
      console.warn("Webhook accepted without signature verification (dev mode)")
    } else {
      console.error("FLUTTERWAVE_WEBHOOK_SECRET_HASH not set in production")
      return NextResponse.json({ success: false, message: "Webhook secret not configured" }, { status: 401 })
    }

    const payload = JSON.parse(rawBody)
    console.log("Flutterwave webhook received:", JSON.stringify(payload).slice(0, 1000))

    const eventId = extractWebhookEventId(payload)
    const chargeId = extractChargeIdFromWebhook(payload)
    const reference = extractWebhookReference(payload)

    if (!chargeId) {
      return NextResponse.json({ success: false, message: "No charge ID in webhook" }, { status: 400 })
    }

    // Filter by tx_ref prefix — ignore non-deposit events
    if (reference && !reference.startsWith("WS-DEP-")) {
      console.log("Ignoring non-deposit webhook event:", reference)
      return NextResponse.json({ success: true, message: "Non-deposit event ignored" })
    }

    await connectDB()

    // ── Idempotency: check if we've already processed this event ──
    if (eventId) {
      const alreadyProcessed = await Deposit.findOne({ webhookEventId: eventId })
      if (alreadyProcessed) {
        console.log(`Webhook event ${eventId} already processed`)
        return NextResponse.json({ success: true, message: "Event already processed" })
      }
    }

    // Find deposit by charge ID or reference
    let deposit = null
    if (chargeId) {
      deposit = await Deposit.findOne({ flutterwaveChargeId: chargeId })
    }
    if (!deposit && reference) {
      deposit = await Deposit.findOne({ flutterwaveReference: reference })
    }

    if (!deposit) {
      console.error("Deposit not found for webhook:", { chargeId, reference })
      return NextResponse.json({ success: false, message: "Deposit not found" }, { status: 404 })
    }

    if (["completed", "cancelled", "payment_confirmed", "payment_failed"].includes(deposit.status)) {
      return NextResponse.json({ success: true, message: `Deposit already ${deposit.status}` })
    }

    // ── CRITICAL: Re-verify via API before giving value ──
    const charge = await verifyCharge(chargeId)
    const normalizedStatus = normalizeFlutterwaveStatus(charge.status)

    // Validate amount/currency with tolerance
    const amountDiff = Math.abs(charge.amount - deposit.fiatAmount)
    if (amountDiff > 1.0 || charge.currency !== deposit.fiatCurrency) {
      console.error("Amount/currency mismatch:", {
        depositId: deposit._id,
        expected: { amount: deposit.fiatAmount, currency: deposit.fiatCurrency },
        actual: { amount: charge.amount, currency: charge.currency },
      })
      return NextResponse.json({ success: false, message: "Amount/currency mismatch" }, { status: 400 })
    }

    if (normalizedStatus === "successful") {
      deposit.status = "payment_confirmed"
      deposit.flutterwaveChargeId = chargeId
      deposit.webhookEventId = eventId || undefined
      deposit.webhookProcessedAt = new Date()
      await deposit.save()

      return NextResponse.json({ success: true, message: "Payment confirmed" })
    } else if (normalizedStatus === "failed") {
      deposit.status = "payment_failed"
      deposit.flutterwaveChargeId = chargeId
      deposit.webhookEventId = eventId || undefined
      deposit.webhookProcessedAt = new Date()
      await deposit.save()
      return NextResponse.json({ success: true, message: "Payment failure recorded" })
    } else if (normalizedStatus === "cancelled") {
      deposit.status = "cancelled"
      deposit.flutterwaveChargeId = chargeId
      deposit.webhookEventId = eventId || undefined
      deposit.webhookProcessedAt = new Date()
      await deposit.save()
      return NextResponse.json({ success: true, message: "Payment cancelled" })
    } else {
      return NextResponse.json({ success: true, message: `Status noted: ${charge.status}` })
    }
  } catch (error) {
    console.error("Flutterwave webhook error:", error)
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: "active", endpoint: "Flutterwave deposit webhook" })
}

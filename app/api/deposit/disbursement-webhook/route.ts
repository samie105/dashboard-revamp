import { createHmac, timingSafeEqual } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Deposit from "@/models/Deposit"

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000

interface AdminDisbursementWebhook {
  event: "fiat_disbursement.submitted" | "fiat_disbursement.failed"
  externalReference: string
  adminDepositId?: string
  txHash?: string
  reason?: string
  error?: string
}

function signaturesMatch(expected: string, received: string) {
  const cleanReceived = received.replace(/^sha256=/, "")
  const expectedBuffer = Buffer.from(expected)
  const receivedBuffer = Buffer.from(cleanReceived)
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer)
}

function verifyAdminSignature(rawBody: string, signature: string | null, timestamp: string | null) {
  const secret = process.env.ADMIN_WEBHOOK_SECRET
  if (!secret) return false
  if (!signature || !timestamp) return false

  const timestampMs = Number(timestamp)
  if (!Number.isFinite(timestampMs)) return false
  if (Math.abs(Date.now() - timestampMs) > MAX_CLOCK_SKEW_MS) return false

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")
  return signaturesMatch(expected, signature)
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get("x-worldstreet-signature")
    const timestamp = request.headers.get("x-worldstreet-timestamp")
    const eventId = request.headers.get("x-worldstreet-event-id")

    if (!verifyAdminSignature(rawBody, signature, timestamp)) {
      return NextResponse.json({ success: false, message: "Invalid signature" }, { status: 401 })
    }

    const payload = JSON.parse(rawBody) as AdminDisbursementWebhook
    if (!payload.externalReference?.startsWith("WS-DEP-")) {
      return NextResponse.json({ success: false, message: "Invalid reference" }, { status: 400 })
    }

    await connectDB()

    const deposit = await Deposit.findOne({
      $or: [
        { merchantTransactionReference: payload.externalReference },
        { flutterwaveReference: payload.externalReference },
      ],
    })

    if (!deposit) {
      return NextResponse.json({ success: false, message: "Deposit not found" }, { status: 404 })
    }

    if (eventId && deposit.adminWebhookEventId === eventId) {
      return NextResponse.json({ success: true, message: "Event already processed" })
    }

    if (deposit.adminDepositId && payload.adminDepositId && deposit.adminDepositId !== payload.adminDepositId) {
      return NextResponse.json({ success: false, message: "Admin deposit mismatch" }, { status: 409 })
    }

    if (payload.adminDepositId) deposit.adminDepositId = payload.adminDepositId
    if (eventId) deposit.adminWebhookEventId = eventId
    deposit.adminWebhookProcessedAt = new Date()

    if (payload.event === "fiat_disbursement.submitted") {
      if (!payload.txHash) {
        return NextResponse.json({ success: false, message: "txHash is required" }, { status: 400 })
      }

      deposit.status = "completed"
      deposit.txHash = payload.txHash
      deposit.deliveryError = undefined
      deposit.completedAt = deposit.completedAt || new Date()
      await deposit.save()

      return NextResponse.json({ success: true, message: "Deposit completed" })
    }

    if (payload.event === "fiat_disbursement.failed") {
      if (deposit.status !== "completed") {
        deposit.status = "delivery_failed"
        deposit.deliveryError = payload.reason || payload.error || "Admin disbursement failed"
      }
      await deposit.save()

      return NextResponse.json({ success: true, message: "Delivery failure recorded" })
    }

    return NextResponse.json({ success: false, message: "Unsupported event" }, { status: 400 })
  } catch (error) {
    console.error("POST /api/deposit/disbursement-webhook error:", error)
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 })
  }
}

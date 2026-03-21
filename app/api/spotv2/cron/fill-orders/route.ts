import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import SpotV2Order from "@/models/SpotV2Order"
import {
  fillLimitBuy,
  fillLimitSell,
  getBinancePrices,
} from "@/lib/spotv2/ledger-actions"

export const dynamic = "force-dynamic"
export const maxDuration = 30

/**
 * Cron endpoint: scans all open limit/stop-limit orders and fills those
 * whose price conditions are met against current Binance spot prices.
 *
 * Security: requires `x-cron-secret` header matching API_CRON_SECRET env var.
 *
 * GET /api/spotv2/cron/fill-orders
 */
export async function GET(req: NextRequest) {
  const start = Date.now()

  // ── Auth ─────────────────────────────────────────────────────────────
  const secret = req.headers.get("x-cron-secret")
  const expected = process.env.API_CRON_SECRET
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    await connectDB()

    // ── 1. Fetch all pending orders ──────────────────────────────────
    const pendingOrders = await SpotV2Order.find({
      status: { $in: ["OPEN", "STOP_TRIGGERED"] },
      orderType: { $in: ["LIMIT", "STOP_LIMIT"] },
    }).lean()

    if (pendingOrders.length === 0) {
      return NextResponse.json({
        success: true,
        checked: 0,
        filled: 0,
        triggered: 0,
        errors: 0,
        duration: `${Date.now() - start}ms`,
      })
    }

    // ── 2. Collect unique tokens & fetch prices ──────────────────────
    const tokens = [...new Set(pendingOrders.map((o) => o.token as string))]
    const prices = await getBinancePrices(tokens)

    // ── 3. Process each order ────────────────────────────────────────
    let filled = 0
    let triggered = 0
    let errors = 0

    for (const order of pendingOrders) {
      const orderId = String(order._id)
      const token = order.token as string
      const currentPrice = prices.get(token)

      // Skip if we couldn't fetch a price for this token
      if (currentPrice === undefined) continue

      const side = order.side as "BUY" | "SELL"
      const orderType = order.orderType as "LIMIT" | "STOP_LIMIT"
      const status = order.status as "OPEN" | "STOP_TRIGGERED"
      const limitPrice = order.limitPrice as number | undefined
      const stopPrice = order.stopPrice as number | undefined

      try {
        // ── Stop-limit: check stop trigger first ───────────────────
        if (orderType === "STOP_LIMIT" && status === "OPEN" && stopPrice) {
          const stopTriggered =
            (side === "BUY" && currentPrice >= stopPrice) ||
            (side === "SELL" && currentPrice <= stopPrice)

          if (stopTriggered) {
            // Atomically flip to STOP_TRIGGERED
            const updated = await SpotV2Order.findOneAndUpdate(
              { _id: orderId, status: "OPEN" },
              { $set: { status: "STOP_TRIGGERED" } },
              { new: true },
            )
            if (updated) {
              triggered++
              // Don't fill yet — let the next cron run (or below) check the limit
              // Actually, check limit condition immediately in same run:
              if (limitPrice) {
                const limitMet =
                  (side === "BUY" && currentPrice <= limitPrice) ||
                  (side === "SELL" && currentPrice >= limitPrice)

                if (limitMet) {
                  const result =
                    side === "BUY"
                      ? await fillLimitBuy(orderId, currentPrice)
                      : await fillLimitSell(orderId, currentPrice)
                  if (result.success) filled++
                  else errors++
                }
              }
              continue
            }
          }
          // Stop not triggered yet — skip
          continue
        }

        // ── Already triggered stop-limit or regular limit ──────────
        if (
          (orderType === "LIMIT" && status === "OPEN") ||
          (orderType === "STOP_LIMIT" && status === "STOP_TRIGGERED")
        ) {
          if (!limitPrice) continue

          const limitMet =
            (side === "BUY" && currentPrice <= limitPrice) ||
            (side === "SELL" && currentPrice >= limitPrice)

          if (limitMet) {
            const result =
              side === "BUY"
                ? await fillLimitBuy(orderId, currentPrice)
                : await fillLimitSell(orderId, currentPrice)
            if (result.success) filled++
            else errors++
          }
        }
      } catch (err) {
        console.error(`[Cron] Error processing order ${orderId}:`, err)
        errors++
      }
    }

    return NextResponse.json({
      success: true,
      checked: pendingOrders.length,
      filled,
      triggered,
      errors,
      duration: `${Date.now() - start}ms`,
    })
  } catch (err) {
    console.error("[Cron fill-orders] Fatal error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}

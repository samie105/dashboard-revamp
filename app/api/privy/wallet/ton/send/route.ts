import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"

/**
 * POST /api/privy/wallet/ton/send
 * Send TON using Privy wallet
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      )
    }

    const { to, amount } = await request.json()

    if (!to || !amount) {
      return NextResponse.json(
        { error: "Missing required fields: to, amount" },
        { status: 400 },
      )
    }

    console.log("[TON Send API] Sending", amount, "TON to", to)

    // TON is a Tier 2 chain that requires custom implementation via Privy
    return NextResponse.json(
      {
        error: "TON transactions not yet supported via Privy",
        details:
          "TON is a Tier 2 chain that requires custom implementation",
      },
      { status: 501 },
    )
  } catch (error: any) {
    console.error("[TON Send API] Error:", error)
    return NextResponse.json(
      {
        error: "Failed to send TON transaction",
        details: error.message,
      },
      { status: 500 },
    )
  }
}

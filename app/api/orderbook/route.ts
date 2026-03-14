import { NextRequest, NextResponse } from "next/server"

const GATEIO_API = "https://api.gateio.ws"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const symbol = searchParams.get("symbol") || "BTC_USDT"

    const response = await fetch(
      `${GATEIO_API}/api/v4/spot/order_book?currency_pair=${encodeURIComponent(symbol)}&limit=20`,
      { cache: "no-store" }
    )

    if (!response.ok) {
      throw new Error(`Gate.io error: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch order book" },
      { status: 500 }
    )
  }
}

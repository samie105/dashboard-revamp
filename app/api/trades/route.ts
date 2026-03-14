import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const symbol = request.nextUrl.searchParams.get("symbol")
    if (!symbol) {
      return NextResponse.json({ error: "symbol required" }, { status: 400 })
    }

    const response = await fetch(
      `https://api.kucoin.com/api/v1/market/histories?symbol=${encodeURIComponent(symbol)}`,
      { cache: "no-store" }
    )

    if (!response.ok) {
      throw new Error(`KuCoin error: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch trades" },
      { status: 500 }
    )
  }
}

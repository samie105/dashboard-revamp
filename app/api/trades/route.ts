import { NextRequest, NextResponse } from "next/server"
import { getTrades } from "@/lib/actions"

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")
  if (!symbol) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 })
  }

  const limit = parseInt(request.nextUrl.searchParams.get("limit") ?? "8", 10)
  const result = await getTrades(symbol, Math.min(limit, 50))
  return NextResponse.json(result)
}

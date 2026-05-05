import { NextRequest, NextResponse } from "next/server"
import { getGmxCandles } from "@/lib/gmx/actions"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const marketToken = searchParams.get("marketToken")
    const interval = searchParams.get("interval") || "1h"
    const start = Number(searchParams.get("start"))
    const end = Number(searchParams.get("end"))

    if (!marketToken || !start || !end) {
      return NextResponse.json(
        { success: false, error: "Missing required params: marketToken, start, end" },
        { status: 400 },
      )
    }

    const candles = await getGmxCandles(marketToken, interval, start, end)
    return NextResponse.json({ success: true, data: candles })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch GMX candles"
    console.error("[GMX Candles] Error:", err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

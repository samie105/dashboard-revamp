import { NextResponse } from "next/server"
import { getGmxMarkets } from "@/lib/gmx/actions"

export async function GET() {
  try {
    const markets = await getGmxMarkets()
    return NextResponse.json({ success: true, data: markets })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch GMX markets"
    console.error("[GMX Markets] Error:", err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

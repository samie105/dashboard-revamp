import { NextRequest, NextResponse } from "next/server"
import { HttpTransport, InfoClient } from "@nktkas/hyperliquid"

const info = new InfoClient({
  transport: new HttpTransport({ isTestnet: false }),
})

/**
 * GET /api/hyperliquid/candles?coin=BTC&interval=30m&limit=500
 * Returns OHLCV candle data from Hyperliquid for any spot token.
 * Resolves human-readable base (e.g. "HYPE") → HL spot universe name (e.g. "@107").
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rawCoin = searchParams.get("coin") || "BTC"
    const interval = searchParams.get("interval") || "30m"
    const limit = Math.min(Number(searchParams.get("limit") || "500"), 5000)

    // Resolve the human-readable base asset to HL's spot coin name
    const baseName = rawCoin
      .replace(/[\/\-_]/g, "")
      .replace(/(USDC|USDT|USD|USDH)$/i, "")
      .toUpperCase()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spotMeta = await info.spotMeta() as any

    // Find base token index by name
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseToken = spotMeta.tokens.find(
      (t: { name: string }) => t.name.toUpperCase() === baseName
    )

    let coinName = baseName // fallback: use as-is (works for perps like "BTC")
    if (baseToken) {
      const universeEntry = spotMeta.universe.find(
        (u: { tokens: number[]; name: string }) => u.tokens[0] === baseToken.index
      )
      if (universeEntry) {
        coinName = universeEntry.name // e.g. "@107" or "PURR/USDC"
      }
    }

    // Fetch candles from Hyperliquid
    const endTime = Number(searchParams.get("endTime")) || Date.now()
    const candles = await info.candleSnapshot({
      coin: coinName,
      interval: interval as Parameters<typeof info.candleSnapshot>[0]["interval"],
      startTime: endTime - intervalToMs(interval) * limit,
      endTime,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (candles as any[]).map((c: any) => ({
      time: Math.floor(c.t / 1000), // epoch seconds for lightweight-charts
      open: Number(c.o),
      high: Number(c.h),
      low: Number(c.l),
      close: Number(c.c),
      volume: Number(c.v),
    }))

    return NextResponse.json({ success: true, data, coinName })
  } catch (error: unknown) {
    console.error("[Hyperliquid Candles] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch candles",
      },
      { status: 500 }
    )
  }
}

function intervalToMs(interval: string): number {
  const map: Record<string, number> = {
    "1m": 60_000,
    "3m": 180_000,
    "5m": 300_000,
    "15m": 900_000,
    "30m": 1_800_000,
    "1h": 3_600_000,
    "2h": 7_200_000,
    "4h": 14_400_000,
    "8h": 28_800_000,
    "12h": 43_200_000,
    "1d": 86_400_000,
    "3d": 259_200_000,
    "1w": 604_800_000,
    "1M": 2_592_000_000,
  }
  return map[interval] || 1_800_000
}

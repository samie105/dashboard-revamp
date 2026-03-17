import { NextRequest, NextResponse } from "next/server"
import { HttpTransport, InfoClient } from "@nktkas/hyperliquid"

const GATEIO_API = "https://api.gateio.ws/api/v4/spot/candlesticks"

const info = new InfoClient({
  transport: new HttpTransport({ isTestnet: false }),
})

/**
 * GET /api/hyperliquid/candles?coin=BTC&interval=30m&limit=1000
 * Tries Gate.io first (richer history for major tokens), falls back
 * to Hyperliquid candles for HL-native tokens not listed on Gate.io.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rawCoin = searchParams.get("coin") || "BTC"
    const interval = searchParams.get("interval") || "30m"
    const limit = Math.min(Number(searchParams.get("limit") || "1000"), 2000)

    const baseName = rawCoin
      .replace(/[\/\-_]/g, "")
      .replace(/(USDC|USDT|USD|USDH)$/i, "")
      .toUpperCase()

    // --- Try Gate.io first ---
    const gateResult = await tryGateio(baseName, interval, limit)
    if (gateResult) {
      return NextResponse.json({
        success: true,
        data: gateResult,
        coinName: `${baseName}_USDT`,
        source: "gateio",
      })
    }

    // --- Fallback to Hyperliquid ---
    const hlResult = await tryHyperliquid(baseName, interval, limit)
    if (hlResult.data.length > 0) {
      return NextResponse.json({
        success: true,
        data: hlResult.data,
        coinName: hlResult.coinName,
        source: "hyperliquid",
      })
    }

    return NextResponse.json(
      { success: false, error: "No candle data available from any source" },
      { status: 404 }
    )
  } catch (error: unknown) {
    console.error("[Candles] Error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch candles" },
      { status: 500 }
    )
  }
}

// ---- Gate.io ----
async function tryGateio(
  baseName: string,
  interval: string,
  limit: number
): Promise<{ time: number; open: number; high: number; low: number; close: number; volume: number }[] | null> {
  try {
    const pair = `${baseName}_USDT`
    const gateInterval = mapGateInterval(interval)
    const url = `${GATEIO_API}?currency_pair=${encodeURIComponent(pair)}&interval=${encodeURIComponent(gateInterval)}&limit=${limit}`

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    })

    if (!res.ok) return null

    const raw: string[][] = await res.json()
    if (!Array.isArray(raw) || raw.length === 0) return null

    // Gate.io format: [timestamp_s, volume, close, high, low, open, amount]
    const data = raw
      .map((c) => ({
        time: Number(c[0]),
        open: Number(c[5]),
        high: Number(c[3]),
        low: Number(c[4]),
        close: Number(c[2]),
        volume: Number(c[1]),
      }))
      .sort((a, b) => a.time - b.time)

    return data.length > 0 ? data : null
  } catch {
    return null
  }
}

// ---- Hyperliquid fallback ----
async function tryHyperliquid(
  baseName: string,
  interval: string,
  limit: number
): Promise<{ data: { time: number; open: number; high: number; low: number; close: number; volume: number }[]; coinName: string }> {
  try {
    const spotMeta = await info.spotMeta()
    const baseToken = spotMeta.tokens.find(
      (t: { name: string }) => t.name.toUpperCase() === baseName
    )

    let coinName = baseName
    if (baseToken) {
      const entry = spotMeta.universe.find(
        (u: { tokens: number[] }) => u.tokens[0] === baseToken.index
      )
      if (entry) coinName = entry.name
    }

    const endTime = Date.now()
    const candles = await info.candleSnapshot({
      coin: coinName,
      interval: interval as Parameters<typeof info.candleSnapshot>[0]["interval"],
      startTime: endTime - intervalToMs(interval) * limit,
      endTime,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (candles as any[]).map((c: any) => ({
      time: Math.floor(c.t / 1000),
      open: Number(c.o),
      high: Number(c.h),
      low: Number(c.l),
      close: Number(c.c),
      volume: Number(c.v),
    }))

    return { data, coinName }
  } catch {
    return { data: [], coinName: baseName }
  }
}

function mapGateInterval(interval: string): string {
  const map: Record<string, string> = {
    "1m": "1m",
    "3m": "3m",
    "5m": "5m",
    "15m": "15m",
    "30m": "30m",
    "1h": "1h",
    "2h": "2h",
    "4h": "4h",
    "8h": "8h",
    "12h": "12h",
    "1d": "1d",
    "3d": "3d",
    "1w": "7d",
    "1M": "30d",
  }
  return map[interval] || "30m"
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

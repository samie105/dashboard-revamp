import { NextResponse } from "next/server"

// ── In-memory cache ────────────────────────────────────────────────────────

interface RateCache {
  usdtPriceUsd: number
  fiatRates: Record<string, number>
  fetchedAt: number
}

let cache: RateCache | null = null
const CACHE_TTL = 120_000 // 2 minutes
const PLATFORM_MARKUP = 5 // 5%

const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: "₦",
  USD: "$",
  GBP: "£",
}

async function fetchRates(): Promise<RateCache> {
  const geckoRes = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=usd,ngn,gbp",
    { signal: AbortSignal.timeout(10_000) },
  )
  if (!geckoRes.ok) throw new Error(`CoinGecko returned ${geckoRes.status}`)

  const geckoData = await geckoRes.json()
  const tether = geckoData.tether || {}

  return {
    usdtPriceUsd: tether.usd || 1,
    fiatRates: {
      NGN: tether.ngn || 1580,
      USD: tether.usd || 1,
      GBP: tether.gbp || 0.79,
    },
    fetchedAt: Date.now(),
  }
}

function buildResponse(data: RateCache, cached: boolean, stale = false) {
  const rates: Record<string, { buyRate: number; sellRate: number; marketRate: number; symbol: string }> = {}

  for (const [currency, marketRate] of Object.entries(data.fiatRates)) {
    const buyRate = marketRate * (1 + PLATFORM_MARKUP / 100)
    const sellRate = marketRate * (1 - PLATFORM_MARKUP / 100)

    rates[currency] = {
      marketRate: Math.round(marketRate * 100) / 100,
      buyRate: Math.round(buyRate * 100) / 100,
      sellRate: Math.round(sellRate * 100) / 100,
      symbol: CURRENCY_SYMBOLS[currency] || currency,
    }
  }

  return NextResponse.json({ rates, markup: PLATFORM_MARKUP, cached, stale, fetchedAt: data.fetchedAt })
}

export async function GET() {
  const now = Date.now()

  if (cache && now - cache.fetchedAt < CACHE_TTL) {
    return buildResponse(cache, true)
  }

  try {
    cache = await fetchRates()
    return buildResponse(cache, false)
  } catch (error) {
    console.error("P2P rate fetch error:", error)
    if (cache) return buildResponse(cache, true, true)
    return NextResponse.json({ rates: {}, error: "Failed to fetch exchange rates" }, { status: 502 })
  }
}

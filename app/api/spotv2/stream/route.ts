import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * REST endpoint: returns order-book depth + recent trades for a symbol.
 * Uses KuCoin → Gate.io fallback chain (no Binance WS dependency).
 *
 * Usage: GET /api/spotv2/stream?symbol=BTC
 */

// ── KuCoin helpers ───────────────────────────────────────────────────────

function toKuCoinSymbol(symbol: string): string {
  return `${symbol.toUpperCase()}-USDT`
}

async function fetchKuCoinOrderBook(symbol: string) {
  const kc = toKuCoinSymbol(symbol)
  const res = await fetch(
    `https://api.kucoin.com/api/v1/market/orderbook/level2_20?symbol=${encodeURIComponent(kc)}`,
    { signal: AbortSignal.timeout(8_000) },
  )
  if (!res.ok) return null
  const json = await res.json()
  if (json.code !== "200000" || !json.data?.asks || !json.data?.bids) return null

  return {
    bids: (json.data.bids as [string, string][]).map(([p, a]) => [parseFloat(p), parseFloat(a)]),
    asks: (json.data.asks as [string, string][]).map(([p, a]) => [parseFloat(p), parseFloat(a)]),
  }
}

async function fetchKuCoinTrades(symbol: string) {
  const kc = toKuCoinSymbol(symbol)
  const res = await fetch(
    `https://api.kucoin.com/api/v1/market/histories?symbol=${encodeURIComponent(kc)}`,
    { signal: AbortSignal.timeout(8_000) },
  )
  if (!res.ok) return null
  const json = await res.json()
  if (json.code !== "200000" || !Array.isArray(json.data)) return null

  return json.data.slice(0, 50).map((t: Record<string, unknown>) => ({
    id: Number(t.sequence) || Math.floor((t.time as number) / 1000),
    price: parseFloat(t.price as string),
    qty: parseFloat(t.size as string),
    time: Math.floor((t.time as number) / 1e6),
    isBuyerMaker: t.side === "sell",
  }))
}

// ── Gate.io helpers ──────────────────────────────────────────────────────

function toGatePair(symbol: string): string {
  return `${symbol.toUpperCase()}_USDT`
}

async function fetchGateOrderBook(symbol: string) {
  const pair = toGatePair(symbol)
  const res = await fetch(
    `https://api.gateio.ws/api/v4/spot/order_book?currency_pair=${encodeURIComponent(pair)}&limit=20`,
    { signal: AbortSignal.timeout(8_000) },
  )
  if (!res.ok) return null
  const data = await res.json()
  if (!data.asks || !data.bids) return null

  return {
    bids: (data.bids as [string, string][]).map(([p, a]) => [parseFloat(p), parseFloat(a)]),
    asks: (data.asks as [string, string][]).map(([p, a]) => [parseFloat(p), parseFloat(a)]),
  }
}

async function fetchGateTrades(symbol: string) {
  const pair = toGatePair(symbol)
  const res = await fetch(
    `https://api.gateio.ws/api/v4/spot/trades?currency_pair=${encodeURIComponent(pair)}&limit=50`,
    { signal: AbortSignal.timeout(8_000) },
  )
  if (!res.ok) return null
  const data = await res.json()
  if (!Array.isArray(data)) return null

  return data.map((t: Record<string, unknown>) => ({
    id: Number(t.id),
    price: parseFloat(t.price as string),
    qty: parseFloat(t.amount as string),
    time: Math.floor(Number(t.create_time_ms ?? t.create_time) * (String(t.create_time_ms).length > 10 ? 1 : 1000)),
    isBuyerMaker: t.side === "sell",
  }))
}

// ── Route handler ────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")
  if (!symbol) {
    return NextResponse.json({ error: "symbol query param required" }, { status: 400 })
  }

  // Fetch order book and trades in parallel, with KuCoin → Gate.io fallback
  const [orderBook, trades] = await Promise.all([
    fetchKuCoinOrderBook(symbol).catch(() => null).then((r) => r ?? fetchGateOrderBook(symbol).catch(() => null)),
    fetchKuCoinTrades(symbol).catch(() => null).then((r) => r ?? fetchGateTrades(symbol).catch(() => null)),
  ])

  return NextResponse.json({
    bids: orderBook?.bids ?? [],
    asks: orderBook?.asks ?? [],
    trades: trades ?? [],
  })
}

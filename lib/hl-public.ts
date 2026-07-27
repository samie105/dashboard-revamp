/**
 * Hyperliquid public info API — read-only market data the crypto service
 * doesn't proxy (order book depth, candles). No auth: these hit HL's public
 * endpoint straight from the client and power the trade page's book + chart.
 * Mirrors the mobile app's src/features/crypto/api/hlPublic.ts.
 *
 * Coin identifiers: futures use the bare symbol ("BTC"); spot uses the
 * universe name from the backend's `coinName` field ("HYPE/USDC" or "@107").
 */

const HL_INFO_URL = "https://api.hyperliquid.xyz/info"

async function infoRequest<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(HL_INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Hyperliquid info request failed (${res.status})`)
  return (await res.json()) as T
}

// ── Order book ──────────────────────────────────────────────────────────────

export type HlBookLevel = {
  price: number
  size: number
  /** Cumulative size from the touch outward — drives the depth bars. */
  total: number
}

export type HlOrderBook = {
  /** Best bid first, descending. */
  bids: HlBookLevel[]
  /** Best ask first, ascending. */
  asks: HlBookLevel[]
  midPrice: number
  spread: number
  /** Share of visible depth sitting on the bid side, 0..1. */
  buyRatio: number
  time: number
}

type RawBookLevel = { px: string; sz: string; n: number }

function toLevels(raw: RawBookLevel[]): HlBookLevel[] {
  let total = 0
  return raw.map((l) => {
    const size = parseFloat(l.sz)
    total += size
    return { price: parseFloat(l.px), size, total }
  })
}

export async function fetchHlOrderBook(coin: string, depth = 12): Promise<HlOrderBook> {
  const raw = await infoRequest<{ time: number; levels: [RawBookLevel[], RawBookLevel[]] }>({
    type: "l2Book",
    coin,
  })
  const bids = toLevels((raw.levels?.[0] ?? []).slice(0, depth))
  const asks = toLevels((raw.levels?.[1] ?? []).slice(0, depth))
  const bestBid = bids[0]?.price ?? 0
  const bestAsk = asks[0]?.price ?? 0
  const midPrice = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : bestBid || bestAsk
  const bidDepth = bids.reduce((s, l) => s + l.size, 0)
  const askDepth = asks.reduce((s, l) => s + l.size, 0)
  return {
    bids,
    asks,
    midPrice,
    spread: bestBid && bestAsk ? bestAsk - bestBid : 0,
    buyRatio: bidDepth + askDepth > 0 ? bidDepth / (bidDepth + askDepth) : 0.5,
    time: raw.time,
  }
}

// ── Candles ─────────────────────────────────────────────────────────────────

export type HlCandleInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d"

export type HlCandle = {
  time: number // open time, seconds (lightweight-charts convention)
  open: number
  high: number
  low: number
  close: number
  volume: number
}

const INTERVAL_MS: Record<HlCandleInterval, number> = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1d": 24 * 60 * 60_000,
}

type RawCandle = { t: number; o: string; h: string; l: string; c: string; v: string }

export async function fetchHlCandles(
  coin: string,
  interval: HlCandleInterval,
  bars = 200,
): Promise<HlCandle[]> {
  const endTime = Date.now()
  const startTime = endTime - bars * INTERVAL_MS[interval]
  const raw = await infoRequest<RawCandle[]>({
    type: "candleSnapshot",
    req: { coin, interval, startTime, endTime },
  })
  return (raw ?? []).map((c) => ({
    time: Math.floor(c.t / 1000),
    open: parseFloat(c.o),
    high: parseFloat(c.h),
    low: parseFloat(c.l),
    close: parseFloat(c.c),
    volume: parseFloat(c.v),
  }))
}

/** 24h change % for a coin, from daily candles. */
export async function fetchHlDayChange(coin: string): Promise<number | null> {
  const candles = await fetchHlCandles(coin, "1h", 25)
  if (candles.length < 2) return null
  const first = candles[0].open
  const last = candles[candles.length - 1].close
  return first > 0 ? ((last - first) / first) * 100 : null
}

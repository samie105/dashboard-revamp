/**
 * A spot token's recent DEX trades, for the trade screen's Trades tab.
 *
 * The same pool the chart reads (lib/gecko-pool.ts findPool), its trades from
 * GeckoTerminal, priced in the requested token (lib/chart-trades.ts). Served
 * from the origin and cached briefly, so every open tab shares one upstream
 * request instead of each earning its own rate limit.
 */

import { NextResponse } from "next/server"

import { CHAIN_SLUG, GECKO, findPool } from "@/lib/gecko-pool"
import { normalizeGeckoTrades } from "@/lib/chart-trades"
import type { TapeFill } from "@/lib/hl-public"

const TTL_MS = 8_000
const cache = new Map<string, { value: TapeFill[]; expires: number }>()
const inflight = new Map<string, Promise<TapeFill[]>>()

async function load(slug: string, token: string): Promise<TapeFill[]> {
  const signal = AbortSignal.timeout(8_000)
  const pool = await findPool(slug, token, signal)
  if (!pool) return []
  const res = await fetch(`${GECKO}/networks/${slug}/pools/${pool}/trades`, { headers: { accept: "application/json" }, signal })
  if (!res.ok) throw new Error(`trades ${res.status}`)
  const body = (await res.json()) as { data?: Parameters<typeof normalizeGeckoTrades>[0] }
  return normalizeGeckoTrades(body.data, token)
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const network = url.searchParams.get("network") ?? ""
  const token = url.searchParams.get("token") ?? ""
  const slug = CHAIN_SLUG[network]
  if (!slug || !token) return NextResponse.json({ trades: [] }, { status: 400 })

  const key = `${slug}:${token.toLowerCase()}`
  const hit = cache.get(key)
  if (hit && hit.expires > Date.now()) return NextResponse.json({ trades: hit.value })

  let flight = inflight.get(key)
  if (!flight) {
    flight = load(slug, token).finally(() => inflight.delete(key))
    inflight.set(key, flight)
  }
  try {
    const trades = await flight
    cache.set(key, { value: trades, expires: Date.now() + TTL_MS })
    if (cache.size > 300) cache.delete(cache.keys().next().value!)
    return NextResponse.json({ trades })
  } catch {
    // Keep serving the last good tape through an upstream wobble.
    return NextResponse.json({ trades: hit?.value ?? [] }, { status: hit ? 200 : 502 })
  }
}

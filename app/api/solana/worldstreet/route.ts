/**
 * Read-only Solana data for the Worldstreet token card: WMNA market state
 * from the Raydium API plus the caller's MNA/WMNA balances via JSON-RPC.
 *
 * Lives server-side so credentialed RPC endpoints never reach the browser —
 * set SOLANA_RPC_URLS as a comma-separated list in the environment. The
 * legacy SOLANA_RPC_URL remains accepted as a single-provider fallback. No
 * Solana SDK: balances come from
 * getTokenAccountsByOwner filtered by mint with jsonParsed encoding, which
 * works for Token-2022 (MNA) and legacy SPL (WMNA) alike and needs no ATA
 * derivation.
 *
 * More specific than the app's /api/[...path] backend proxy, so Next routes
 * requests here first.
 */

import { NextRequest, NextResponse } from "next/server"
import {
  MNA_MINT,
  WMNA_MINT,
  WMNA_RAYDIUM_POOL,
  looksLikeSolanaAddress,
  type WorldstreetTokenSnapshot,
} from "@/lib/worldstreet-token"

const RPC_URLS = [
  ...(process.env.SOLANA_RPC_URLS ?? "").split(",").map((url) => url.trim()).filter(Boolean),
  ...(process.env.SOLANA_RPC_URL ? [process.env.SOLANA_RPC_URL] : []),
].filter((url, index, urls) => urls.indexOf(url) === index)
const RAYDIUM_POOL_INFO = `https://api-v3.raydium.io/pools/info/ids?ids=${WMNA_RAYDIUM_POOL}`

/** Sum of a wallet's parsed token-account balances for one mint. */
async function tokenBalance(owner: string, mint: string): Promise<number> {
  let lastError: Error | undefined
  for (const url of RPC_URLS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTokenAccountsByOwner",
          params: [owner, { mint }, { encoding: "jsonParsed", commitment: "confirmed" }],
        }),
        cache: "no-store",
      })
      if (!res.ok) throw new Error(`RPC ${res.status}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error.message ?? "RPC error")
      const accounts: unknown[] = json.result?.value ?? []
      let total = 0
      for (const acc of accounts) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ui = (acc as any)?.account?.data?.parsed?.info?.tokenAmount?.uiAmount
        if (typeof ui === "number") total += ui
      }
      return total
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("RPC request failed")
    }
  }
  throw lastError ?? new Error("No Solana RPC provider configured")
}

async function poolMarket(): Promise<WorldstreetTokenSnapshot["market"]> {
  // Cached across users for 30s — pool state is global, not per-caller.
  const res = await fetch(RAYDIUM_POOL_INFO, { next: { revalidate: 30 } })
  if (!res.ok) return null
  const json = await res.json()
  const pool = json?.data?.[0]
  if (!pool || typeof pool.price !== "number") return null
  // Raydium reports -1 for min/max in windows with no trades.
  const range: [number, number] | null =
    pool.week && pool.week.priceMin > 0 && pool.week.priceMax > 0
      ? [pool.week.priceMin, pool.week.priceMax]
      : null
  return {
    price: pool.price,
    tvlUsd: typeof pool.tvl === "number" ? pool.tvl : 0,
    poolWmna: typeof pool.mintAmountA === "number" ? pool.mintAmountA : 0,
    poolUsdc: typeof pool.mintAmountB === "number" ? pool.mintAmountB : 0,
    weekVolumeUsd: pool.week && typeof pool.week.volume === "number" ? pool.week.volume : 0,
    weekRange: range,
    feeRate: typeof pool.feeRate === "number" ? pool.feeRate : 0.0025,
  }
}

export async function GET(req: NextRequest) {
  const owner = req.nextUrl.searchParams.get("owner")

  const [market, balances] = await Promise.all([
    poolMarket().catch(() => null),
    owner && looksLikeSolanaAddress(owner)
      ? Promise.all([tokenBalance(owner, MNA_MINT), tokenBalance(owner, WMNA_MINT)])
          .then(([mna, wmna]) => ({ mna, wmna }))
          .catch(() => null)
      : Promise.resolve(null),
  ])

  const snapshot: WorldstreetTokenSnapshot = { market, balances, fetchedAt: Date.now() }
  return NextResponse.json(snapshot, {
    headers: { "cache-control": "private, max-age=20" },
  })
}

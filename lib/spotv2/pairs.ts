import type { SpotV2Pair } from "@/components/spotv2/spotv2-types"

let cachedPairs: SpotV2Pair[] | null = null
let cacheTimestamp = 0
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

/**
 * Fetch pairs from the /api/spotv2/pairs route (server-side cache).
 * Client-side, we add a local memory cache to avoid redundant fetches.
 */
export async function fetchSpotV2Pairs(): Promise<SpotV2Pair[]> {
  const now = Date.now()
  if (cachedPairs && now - cacheTimestamp < CACHE_TTL) {
    return cachedPairs
  }

  const baseUrl = typeof window === "undefined"
    ? process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    : ""

  const res = await fetch(`${baseUrl}/api/spotv2/pairs`, {
    next: typeof window === "undefined" ? { revalidate: 3600 } : undefined,
  })

  if (!res.ok) {
    if (cachedPairs) return cachedPairs
    throw new Error("Failed to fetch SpotV2 pairs")
  }

  const data = await res.json()
  if (data.success && Array.isArray(data.pairs)) {
    cachedPairs = data.pairs
    cacheTimestamp = now
    return data.pairs
  }

  if (cachedPairs) return cachedPairs
  return []
}

const CHAIN_LABELS: Record<string, string> = {
  ethereum: "ETH",
  bsc: "BSC",
  solana: "SOL",
  avalanche: "AVAX",
  arbitrum: "ARB",
  polygon: "POLY",
  base: "BASE",
  optimism: "OP",
}

export function getChainLabel(chain: string): string {
  return CHAIN_LABELS[chain] ?? chain.toUpperCase()
}

const CHAIN_COLORS: Record<string, string> = {
  ethereum: "bg-blue-500/15 text-blue-400",
  bsc: "bg-yellow-500/15 text-yellow-400",
  solana: "bg-purple-500/15 text-purple-400",
  avalanche: "bg-red-500/15 text-red-400",
  arbitrum: "bg-sky-500/15 text-sky-400",
  polygon: "bg-violet-500/15 text-violet-400",
  base: "bg-blue-400/15 text-blue-300",
  optimism: "bg-red-400/15 text-red-300",
}

export function getChainColorClass(chain: string): string {
  return CHAIN_COLORS[chain] ?? "bg-muted text-muted-foreground"
}

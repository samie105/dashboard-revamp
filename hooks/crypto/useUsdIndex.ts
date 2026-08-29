"use client"

import { useQuery } from "@tanstack/react-query"

import { getPrices } from "@/lib/actions"

/**
 * Symbol → USD price, read from the exact feed the Assets page values its
 * backend balances with: the `getPrices()` server action (Hyperliquid first,
 * KuCoin then CoinGecko as fallbacks). Every path in that action seeds
 * `USDT`/`USDC` at 1, so a cold feed can't make $2,500 of USDT read as $0 —
 * which is why this hook does no stablecoin special-casing of its own.
 *
 * `null` means "the first read hasn't landed"; `{}` is a settled answer
 * meaning "the feed gave us nothing". Callers need that difference: valuing
 * balances against a not-yet-loaded index prints a total that is wrong for a
 * beat and then jumps — the bug documented at `assets-client.tsx:575-580`.
 * A caller that only wants prices can read `index?.[symbol]` and treat both
 * states the same.
 */
export function useUsdIndex(): Record<string, number> | null {
  const query = useQuery({
    queryKey: ["usd-price-index"],
    queryFn: () => getPrices(),
    // The action caches for 5 minutes server-side; a minute of client
    // staleness keeps the wallet from re-posting on every mount.
    staleTime: 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
  })

  // isPending covers "no data and no error yet". Once the query settles —
  // even by failing — an empty index is the honest answer, so the hero stops
  // waiting instead of shimmering forever.
  if (query.isPending) return null
  return query.data?.prices ?? {}
}

/**
 * Symbol → 24h percent change, from the same query (and therefore the same
 * cache entry) as `useUsdIndex`. A symbol the feed didn't move-stamp is
 * simply absent — callers render nothing rather than a fake 0.00%.
 */
export function useUsdChangeIndex(): Record<string, number> | null {
  const query = useQuery({
    queryKey: ["usd-price-index"],
    queryFn: () => getPrices(),
    staleTime: 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
  })

  if (query.isPending) return null
  const changes: Record<string, number> = {}
  for (const coin of query.data?.coins ?? []) {
    if (Number.isFinite(coin.change24h) && coin.change24h !== 0) changes[coin.symbol.toUpperCase()] = coin.change24h
  }
  return changes
}

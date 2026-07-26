"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { fetchHlAccount, type HlAccount } from "@/lib/crypto-api"

/**
 * The user's Hyperliquid trading account via GET /api/trade/account — spot
 * balances, perps value, positions and open orders in one call. This is the
 * single source for every "Spot"/"Futures" figure in the dashboard, replacing
 * the spotv2 ledger reads and the old /api/hyperliquid/* hooks.
 */
export function useTradeAccount(refreshMs = 30_000) {
  const [account, setAccount] = useState<HlAccount | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)

  const refetch = useCallback(async () => {
    try {
      const data = await fetchHlAccount()
      if (mounted.current) {
        setAccount(data)
        setError(null)
      }
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : "Failed to load account")
    } finally {
      if (mounted.current) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    refetch()
    const id = refreshMs > 0 ? setInterval(refetch, refreshMs) : undefined
    return () => {
      mounted.current = false
      if (id) clearInterval(id)
    }
  }, [refetch, refreshMs])

  const balances = account?.balances ?? null

  // Spot = USDC in spot + market value of spot token holdings (positions in
  // spot tokens are priced by the account's own mark data when present).
  const spotUsd = balances ? balances.spotUsdc + (balances.spotUsdcHold ?? 0) : 0
  const futuresUsd = balances?.perpsAccountValueUsdc ?? 0

  return {
    account,
    ready: account?.ready ?? false,
    balances,
    positions: account?.positions ?? [],
    openOrders: account?.openOrders ?? [],
    spotUsd,
    futuresUsd,
    isLoading,
    error,
    refetch,
  }
}

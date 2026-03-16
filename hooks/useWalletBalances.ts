"use client"

import { useState, useCallback, useEffect, useRef } from "react"

export interface TokenBalance {
  symbol: string
  name: string
  chain: string
  balance: number
  contractAddress?: string
  isNative: boolean
}

interface UseWalletBalancesReturn {
  balances: TokenBalance[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * Hook to fetch on-chain wallet balances across all chains.
 * Polls every `refreshInterval` ms (default 30s).
 */
export function useWalletBalances(refreshInterval = 30_000): UseWalletBalancesReturn {
  const [balances, setBalances] = useState<TokenBalance[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const fetchBalances = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/wallet/balances", { credentials: "include" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      if (mountedRef.current) {
        setBalances(data.balances ?? [])
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to fetch balances")
      }
    } finally {
      if (mountedRef.current) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    fetchBalances()
    return () => { mountedRef.current = false }
  }, [fetchBalances])

  useEffect(() => {
    if (refreshInterval <= 0) return
    const id = setInterval(fetchBalances, refreshInterval)
    return () => clearInterval(id)
  }, [refreshInterval, fetchBalances])

  return { balances, isLoading, error, refetch: fetchBalances }
}

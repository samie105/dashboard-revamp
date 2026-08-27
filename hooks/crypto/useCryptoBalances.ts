"use client"

import { useCallback, useEffect, useState } from "react"

import { useAuth } from "@/components/auth-provider"
import { cryptoBackendClient, isCryptoBackendEnabled } from "@/lib/crypto-backend"
import type { CryptoBalance, CryptoBalanceSnapshot } from "@/lib/crypto-backend"

export type CryptoBalanceResult = CryptoBalance & {
  accountId: string
  networkId: string
  networkName: string
}

export function useCryptoBalances() {
  const { user, isLoaded, isSignedIn } = useAuth()
  const enabled = isCryptoBackendEnabled && isLoaded && isSignedIn
  const [snapshot, setSnapshot] = useState<CryptoBalanceSnapshot | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(false)

  const fetchSnapshot = useCallback(async (signal?: AbortSignal) => {
    if (!enabled) return
    setIsFetching(true)
    setIsLoading(true)
    try {
      // Deliberately bypass both frontend and backend snapshot caches while
      // the balance response is being verified end-to-end.
      const next = await cryptoBackendClient.listBalanceSnapshot(true, signal)
      setSnapshot(next)
      setError(null)
    } catch (nextError) {
      if (nextError instanceof Error && nextError.name === "AbortError") return
      setError(nextError)
    } finally {
      setIsLoading(false)
      setIsFetching(false)
    }
  }, [enabled])

  useEffect(() => {
    setSnapshot(null)
    setError(null)
    if (!enabled) return
    const controller = new AbortController()
    void fetchSnapshot(controller.signal)
    return () => controller.abort()
  }, [enabled, fetchSnapshot])

  // Treat an incomplete payload as an empty snapshot instead of crashing the
  // page while the fresh aggregate request is in flight.
  const results = Array.isArray(snapshot?.results) ? snapshot.results : []
  const balances: CryptoBalanceResult[] = results.flatMap((result) => result.balances.map((balance) => ({
      ...balance,
      accountId: result.accountId,
      networkId: result.networkId,
      networkName: result.networkName,
    }))) ?? []

  return {
    balances,
    unavailableNetworks: results.filter((result) => result.status === "unavailable"),
    snapshot,
    isLoading,
    isFetching,
    isStale: false,
    error,
    refetch: async () => { await fetchSnapshot() },
  }
}

/** Precision-preserving display formatter. The raw value remains authoritative. */
export function formatCryptoAmount(amountBaseUnits: string, decimals: number, maxFractionDigits = 6) {
  if (!/^\d+$/.test(amountBaseUnits) || decimals < 0) return "0"
  const normalized = amountBaseUnits.replace(/^0+(?=\d)/, "")
  if (decimals === 0) return normalized
  const padded = normalized.padStart(decimals + 1, "0")
  const whole = padded.slice(0, -decimals) || "0"
  const fraction = padded.slice(-decimals).replace(/0+$/, "").slice(0, maxFractionDigits)
  return fraction ? `${whole}.${fraction}` : whole
}

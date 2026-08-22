"use client"

/**
 * Live WMNA market state + the user's MNA/WMNA holdings, via the app's
 * server-side Solana route. Refreshes every 60s while mounted; balances
 * ride along whenever the custodial Solana address is known and valid
 * (the dev bypass's fake address is filtered out server-side and just
 * yields balances: null).
 */

import * as React from "react"
import { useWallet } from "@/components/wallet-provider"
import { looksLikeSolanaAddress, type WorldstreetTokenSnapshot } from "@/lib/worldstreet-token"

const REFRESH_MS = 60_000

export function useWorldstreetToken() {
  const { addresses } = useWallet()
  const solana = addresses?.solana && looksLikeSolanaAddress(addresses.solana) ? addresses.solana : null

  const [data, setData] = React.useState<WorldstreetTokenSnapshot | null>(null)
  const [error, setError] = React.useState(false)
  const loading = data === null && !error

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/solana/worldstreet${solana ? `?owner=${solana}` : ""}`)
        if (!res.ok) throw new Error(String(res.status))
        const json: WorldstreetTokenSnapshot = await res.json()
        if (!cancelled) {
          setData(json)
          setError(false)
        }
      } catch {
        // Keep the last good snapshot if we have one; only flag error when
        // there is nothing at all to show.
        if (!cancelled) setError((prev) => prev || data === null)
      }
    }
    load()
    const id = setInterval(load, REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solana])

  return { data, loading, error }
}

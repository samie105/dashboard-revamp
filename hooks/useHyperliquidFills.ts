"use client"

/**
 * Closed/realized Hyperliquid trade history — separate from useTradeAccount,
 * which only ever reflects what's still open. A one-shot fetch with manual
 * refetch is enough here: unlike positions, fill history doesn't need to
 * live-poll.
 */
import * as React from "react"
import { fetchHlFills, type HlFill } from "@/lib/crypto-api"

export function useHyperliquidFills(enabled = true) {
  const [fills, setFills] = React.useState<HlFill[]>([])
  const [isLoading, setIsLoading] = React.useState(enabled)
  const [error, setError] = React.useState<string | null>(null)

  const refetch = React.useCallback(async () => {
    if (!enabled) return
    setIsLoading(true)
    try {
      const { fills: rows } = await fetchHlFills()
      setFills(rows)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load trade history")
    } finally {
      setIsLoading(false)
    }
  }, [enabled])

  React.useEffect(() => {
    void refetch()
  }, [refetch])

  return { fills, isLoading, error, refetch }
}

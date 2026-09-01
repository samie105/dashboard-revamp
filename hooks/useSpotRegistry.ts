"use client"

/**
 * The tradable spot registry, as a lookup — what /trading/markets was missing.
 *
 * The Markets page lists the broad Worldstreet price feed: hundreds of assets
 * with market cap, volume and a 7-day curve. The trade workspace lists the
 * backend's spot registry: the far smaller set that can actually be routed,
 * one row per chain. The two were never introduced to each other, so every row
 * on Markets carried a "Trade" button and a `/trade?symbol=X` link, including
 * for assets that have no market behind them — the link resolved to whatever
 * pair the workspace defaulted to, or to a dead ticket.
 *
 * This hook is the join. It answers two questions per symbol: is it tradable,
 * and on which chains — which is also what makes a chain filter possible on a
 * feed that carries no chain of its own.
 */

import * as React from "react"
import { cryptoBackendClient, isCryptoBackendEnabled } from "@/lib/crypto-backend"
import { chainLabel } from "@/lib/spot-market-search"

export type RegistryRow = {
  id: string
  symbol: string
  networkId: string
  quote: string
  price: number
}

export type SpotRegistry = {
  loading: boolean
  /** Upper-cased symbol → the rows that trade it, one per chain. */
  bySymbol: Map<string, RegistryRow[]>
  /** Chains present in the registry, with how many markets each carries. */
  chains: { id: string; label: string; count: number }[]
}

const EMPTY: SpotRegistry = { loading: false, bySymbol: new Map(), chains: [] }

export function useSpotRegistry(enabled = true): SpotRegistry {
  const [rows, setRows] = React.useState<RegistryRow[] | null>(null)
  const [loading, setLoading] = React.useState(false)
  const started = React.useRef(false)

  React.useEffect(() => {
    if (!enabled || started.current || !isCryptoBackendEnabled) return
    started.current = true
    setLoading(true)
    cryptoBackendClient
      .getModernSpotMarkets()
      .then((result) =>
        setRows(
          result.markets
            .filter((m) => m.chartSupported)
            .map((m) => ({
              id: m.id,
              symbol: m.symbol.toUpperCase(),
              networkId: m.networkId,
              quote: (m.quote ?? "USDC").toUpperCase(),
              price: m.price ?? 0,
            })),
        ),
      )
      // A registry we couldn't reach must not turn every row un-tradable:
      // `rows` stays null and the callers fall back to showing the link.
      .catch(() => setRows(null))
      .finally(() => setLoading(false))
  }, [enabled])

  return React.useMemo(() => {
    if (!rows) return { ...EMPTY, loading }
    const bySymbol = new Map<string, RegistryRow[]>()
    const counts = new Map<string, number>()
    for (const r of rows) {
      const list = bySymbol.get(r.symbol)
      if (list) list.push(r)
      else bySymbol.set(r.symbol, [r])
      counts.set(r.networkId, (counts.get(r.networkId) ?? 0) + 1)
    }
    return {
      loading,
      bySymbol,
      chains: [...counts].map(([id, count]) => ({ id, label: chainLabel(id), count })),
    }
  }, [rows, loading])
}

/** The deep link into the workspace for a registry row (spec §8: id, not symbol). */
export function tradeHref(row: RegistryRow): string {
  return `/trade?market=spot&symbol=${encodeURIComponent(row.symbol)}&id=${encodeURIComponent(row.id)}`
}

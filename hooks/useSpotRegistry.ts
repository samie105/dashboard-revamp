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
  /** The base token's address on its chain, where the registry states one. */
  address: string | null
  /** The market's own icon, so an order row shows the token, not initials. */
  icon: string | null
  /** The quote token's address — the other side of a sell. */
  quoteAddress: string | null
  /* Precision as the REGISTRY states it. Undefined means the backend didn't
     say, and a size in base units then cannot be read back — a guessed
     exponent misstates an order by a factor of a billion, so callers refuse
     rather than assume. */
  baseDecimals?: number
  quoteDecimals?: number
}

export type SpotRegistry = {
  loading: boolean
  /** Upper-cased symbol → the rows that trade it, one per chain. */
  bySymbol: Map<string, RegistryRow[]>
  /** Chains present in the registry, with how many markets each carries. */
  chains: { id: string; label: string; count: number }[]
  /** `networkId:loweraddress` → row. Orders carry addresses, not symbols. */
  byAddress: Map<string, RegistryRow>
}

const EMPTY: SpotRegistry = {
  loading: false,
  bySymbol: new Map(),
  chains: [],
  byAddress: new Map(),
}

/** The key an address is looked up by — EVM hex is case-insensitive, and a
 *  Solana mint is base58 and case-SENSITIVE, so both are lowercased for the
 *  key only and never for use. */
export function addressKey(networkId: string, address: string): string {
  return `${networkId}:${address.toLowerCase()}`
}

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
              address: m.buyToken ?? m.outputMint ?? null,
              icon: m.icon ?? null,
              quoteAddress: m.sellToken ?? m.inputMint ?? null,
              ...(typeof m.baseDecimals === "number" ? { baseDecimals: m.baseDecimals } : {}),
              ...(typeof m.quoteDecimals === "number" ? { quoteDecimals: m.quoteDecimals } : {}),
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
    const byAddress = new Map<string, RegistryRow>()
    const counts = new Map<string, number>()
    for (const r of rows) {
      const list = bySymbol.get(r.symbol)
      if (list) list.push(r)
      else bySymbol.set(r.symbol, [r])
      /* BASE addresses only. Indexing the quote side too looked helpful — a
         sell receives the quote — but every USDC-quoted market shares one
         quote address, so USDC resolved to whichever market happened to be
         indexed first and every sell was labelled with a stranger's ticker.
         A sell is identified by the token it SPENT; see `resolveOrder`. */
      if (r.address) byAddress.set(addressKey(r.networkId, r.address), r)
      counts.set(r.networkId, (counts.get(r.networkId) ?? 0) + 1)
    }
    return {
      loading,
      bySymbol,
      byAddress,
      chains: [...counts].map(([id, count]) => ({ id, label: chainLabel(id), count })),
    }
  }, [rows, loading])
}

/** The deep link into the workspace for a registry row (spec §8: id, not symbol). */
export function tradeHref(row: RegistryRow): string {
  return `/trade?market=spot&symbol=${encodeURIComponent(row.symbol)}&id=${encodeURIComponent(row.id)}`
}

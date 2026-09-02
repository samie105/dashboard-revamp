"use client"

/**
 * The user's spot orders — the ledger is the list, the chain is the value.
 *
 * On spot there are no positions and no resting orders: a swap either settles
 * or it doesn't, and what you hold afterwards is a wallet balance. So the two
 * tables under the chart ("Positions", "Open orders") could only ever say
 * "none" on this tab. What a spot trader actually wants there is the orders
 * they have placed and what became of them.
 *
 * The backend's `/transactions` records are the ledger: one row per broadcast,
 * with the network, the hash and the settlement status the reconciler keeps
 * up to date from the chain — and now `summary`, the intent's own
 * `normalizedSummary`, carrying the amount, the two tokens and the router.
 *
 * That last field is why this is one request. The record used to store only
 * `assetSummary.asset`, so describing a trade meant fetching its intent, and
 * a page of history meant a request per row. The backend denormalises the
 * summary at broadcast now, and fills it in from the intent for older rows in
 * a single query, so the client just reads it.
 */

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@/components/auth-provider"
import {
  cryptoBackendClient,
  cryptoQueryKeys,
  isCryptoBackendEnabled,
} from "@/lib/crypto-backend"
import type { CryptoTransactionRecord } from "@/lib/crypto-backend"

/** Intents whose action means "a spot trade", as the backend names them. */
const SWAP_ACTIONS = new Set(["spot-swap", "jupiter-swap"])

export type SpotOrder = {
  id: string
  /** Ledger status, reconciled from the chain by the backend. */
  status: string
  networkId: string
  txHash: string
  createdAt: string | null
  /** Token spent and token received, as addresses. */
  sellToken: string | null
  buyToken: string | null
  /** Base units of the token received, as the backend recorded them. */
  amount: string | null
  router: string | null
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

function str(value: unknown): string | null {
  return typeof value === "string" && value ? value : null
}

export function useSpotOrders(enabled = true) {
  const { user } = useAuth()
  const userId = user?.userId ?? "anonymous"
  const active = enabled && isCryptoBackendEnabled && Boolean(user?.userId)

  const ledger = useQuery({
    queryKey: [...cryptoQueryKeys.all, "spot-orders", userId],
    queryFn: ({ signal }) => cryptoBackendClient.listTransactions(50, signal),
    enabled: active,
    staleTime: 15_000,
    // A submitted order settles in seconds; the reconciler writes the outcome
    // to the ledger, so polling it is how "Filling" becomes "Filled".
    refetchInterval: 20_000,
  })

  const orders = React.useMemo<SpotOrder[]>(() => {
    const out: SpotOrder[] = []
    for (const record of (ledger.data ?? []) as CryptoTransactionRecord[]) {
      const summary = asRecord(record.summary)
      const action = str(summary.action)
      // The ledger holds transfers and deposits too; the action names a trade.
      if (!action || !SWAP_ACTIONS.has(action)) continue
      out.push({
        id: record.id,
        // The ledger's status, not the intent's: the reconciler writes it from
        // the chain, which is the only thing that knows whether this settled.
        status: String(record.status ?? "unknown"),
        networkId: String(record.networkId ?? ""),
        txHash: String(record.txHash ?? ""),
        createdAt: str(record.submittedAt) ?? str(record.createdAt),
        sellToken: str(summary.sellToken),
        buyToken: str(summary.buyToken) ?? str(asRecord(summary.asset).identifier),
        amount: str(summary.amount),
        router: str(summary.router),
      })
    }
    return out
  }, [ledger.data])

  return {
    orders,
    loading: ledger.isLoading,
    error: ledger.error,
    refetch: ledger.refetch,
  }
}

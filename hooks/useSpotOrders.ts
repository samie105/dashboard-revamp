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
 * up to date from the chain. What they do NOT carry is the trade — the record
 * stores only `assetSummary.asset`, so the amount, the direction and the
 * router live on the INTENT. Hence the hydration below: the list comes from
 * the ledger in one request, and each row's terms are read from its intent,
 * cached forever because a terminal intent never changes again.
 */

import * as React from "react"
import { useQueries, useQuery } from "@tanstack/react-query"
import { useAuth } from "@/components/auth-provider"
import {
  cryptoBackendClient,
  cryptoQueryKeys,
  isCryptoBackendEnabled,
} from "@/lib/crypto-backend"
import type { CryptoTransactionRecord } from "@/lib/crypto-backend"

/** Intents whose action means "a spot trade", as the backend names them. */
const SWAP_ACTIONS = new Set(["spot-swap", "jupiter-swap"])

/** How many recent ledger rows to read terms for. */
const HYDRATE_LIMIT = 25

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
    refetchInterval: 20_000,
  })

  /* Only the most recent rows are hydrated. The ledger holds transfers and
     deposits too, and there is no way to tell a swap from a transfer without
     reading the intent — so this reads a bounded window rather than issuing a
     request per row of an unbounded history. */
  const candidates = React.useMemo(
    () => (ledger.data ?? []).slice(0, HYDRATE_LIMIT),
    [ledger.data],
  )

  const intents = useQueries({
    queries: candidates.map((record) => ({
      queryKey: cryptoQueryKeys.intent(userId, String(record.intentId ?? record.id)),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        cryptoBackendClient.getIntent(String(record.intentId ?? record.id), signal),
      enabled: active && Boolean(record.intentId),
      // An intent is immutable once written; only its status moves, and the
      // ledger row already carries that.
      staleTime: Number.POSITIVE_INFINITY,
      gcTime: 30 * 60_000,
      retry: false,
    })),
  })

  const orders = React.useMemo<SpotOrder[]>(() => {
    const out: SpotOrder[] = []
    candidates.forEach((record: CryptoTransactionRecord, i) => {
      const intent = intents[i]?.data as Record<string, unknown> | undefined
      if (!intent) return
      const summary = asRecord(intent.normalizedSummary)
      const payload = asRecord(intent.intentPayload)
      const action = str(summary.action) ?? str(payload.type)
      if (!action || !SWAP_ACTIONS.has(action)) return
      out.push({
        id: record.id,
        // The ledger's status, not the intent's: the reconciler writes it from
        // the chain, which is the only thing that knows whether this settled.
        status: String(record.status ?? "unknown"),
        networkId: String(record.networkId ?? ""),
        txHash: String(record.txHash ?? ""),
        createdAt: str(record.submittedAt) ?? str(record.createdAt),
        sellToken: str(summary.sellToken) ?? str(payload.sellToken) ?? str(payload.inputMint),
        buyToken: str(summary.buyToken) ?? str(payload.buyToken) ?? str(payload.outputMint),
        amount: str(summary.amount),
        router: str(summary.router) ?? str(payload.router),
      })
    })
    return out
  }, [candidates, intents])

  // Hydration is progressive: rows appear as their intents land, so the panel
  // is never blocked on the slowest of twenty-five requests.
  const hydrating = intents.some((query) => query.isLoading)

  return {
    orders,
    loading: ledger.isLoading,
    hydrating,
    error: ledger.error,
    refetch: ledger.refetch,
  }
}

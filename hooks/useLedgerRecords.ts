"use client"

/**
 * The wallet's ledger — one query, shared by everything that shows movements.
 *
 * The dashboard's Activity card and its Recent Trades card were both reading
 * `/api/transactions/unified`, an endpoint the crypto backend does not
 * implement. The proxy forwards it, the request fails, and both cards catch
 * the error and render their empty state. So a user with a page of real
 * transfers and swaps was told "No activity yet" — the most confidence-
 * destroying thing a money dashboard can say, because it isn't a blank
 * screen, it is a wrong answer stated plainly.
 *
 * `/transactions` is the endpoint that exists and holds those records, with
 * the settlement status reconciled from the chain and — since the backend
 * denormalises it — the intent summary describing what each one was.
 */

import { useQuery } from "@tanstack/react-query"

import { useAuth } from "@/components/auth-provider"
import {
  cryptoBackendClient,
  cryptoQueryKeys,
  isCryptoBackendEnabled,
} from "@/lib/crypto-backend"
import type { CryptoTransactionRecord } from "@/lib/crypto-backend"

export function useLedgerRecords(limit = 50) {
  const { user } = useAuth()
  const userId = user?.userId ?? "anonymous"

  const query = useQuery({
    // One key for every consumer, so the Activity card and the trades card
    // share a single request rather than racing each other for the same rows.
    queryKey: [...cryptoQueryKeys.all, "ledger-records", userId, limit],
    queryFn: ({ signal }) => cryptoBackendClient.listTransactions(limit, signal),
    enabled: isCryptoBackendEnabled && Boolean(user?.userId),
    staleTime: 15_000,
    // Pending rows settle in seconds and the reconciler writes the outcome
    // here; polling is how "in flight" becomes "confirmed" without a reload.
    refetchInterval: 20_000,
  })

  return {
    records: (query.data ?? []) as CryptoTransactionRecord[],
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

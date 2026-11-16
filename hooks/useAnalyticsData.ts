"use client"

/**
 * Everything /analytics reads, from one place.
 *
 * Live: the transactions page's hook (GET /transactions at the backend's cap
 * of 100), GET /fiat/orders, GET /trading/hyperliquid/fills and the trading
 * account (positions and open orders). Exit reasons are null: no route serves
 * them yet.
 *
 * Sample: with ANALYTICS_MOCKS_ENABLED (next dev + NEXT_PUBLIC_ANALYTICS_MOCKS),
 * the same shapes come from lib/analytics-mock.ts. Its import sits behind
 * process.env.NODE_ENV, a build-time literal, so production never ships it.
 * The live hooks still run (hooks can't be skipped conditionally); their
 * results are simply not shown.
 */

import * as React from "react"

import { ANALYTICS_MOCKS_ENABLED } from "@/lib/analytics-mocks"
import { useUnifiedTransactions } from "@/hooks/use-unified-transactions"
import { useFiatOrders } from "@/hooks/crypto/useFiatOrders"
import { useHyperliquidFills } from "@/hooks/useHyperliquidFills"
import { useTradeAccount } from "@/hooks/useTradeAccount"
import type { FiatOrder } from "@/lib/crypto-backend/types"
import type { HlFill, HlOpenOrder, HlPosition } from "@/lib/crypto-api"
import type { ExitReason } from "@/lib/trading-analytics"
import type { UnifiedTransaction } from "@/types/transactions"

/** GET /transactions returns at most this many rows. */
export const LEDGER_CAP = 100
/** GET /trading/hyperliquid/fills returns at most this many fills. */
export const FILLS_CAP = 200

type Sample = {
  rows: UnifiedTransaction[]
  orders: FiatOrder[]
  fills: HlFill[]
  positions: HlPosition[]
  openOrders: HlOpenOrder[]
  exits: Map<string, ExitReason>
}

const loadSample: () => Promise<Sample> =
  process.env.NODE_ENV === "development"
    ? () =>
        import("@/lib/analytics-mock").then((m) => {
          const now = Date.now()
          return { rows: m.mockWalletRows(now), orders: m.mockOrders(now), ...m.mockTrading(now) }
        })
    : () => Promise.reject(new Error("Sample data is only available in development"))

export function useAnalyticsData() {
  const model = useUnifiedTransactions({ pollInterval: 60_000, limit: LEDGER_CAP })
  const orders = useFiatOrders(50)
  const fills = useHyperliquidFills(!ANALYTICS_MOCKS_ENABLED)
  const account = useTradeAccount()

  const [sample, setSample] = React.useState<Sample | null>(null)
  React.useEffect(() => {
    if (!ANALYTICS_MOCKS_ENABLED) return
    let live = true
    void loadSample().then((s) => live && setSample(s))
    return () => {
      live = false
    }
  }, [])

  if (ANALYTICS_MOCKS_ENABLED) {
    const loading = !sample
    return {
      isMock: true as const,
      wallet: { rows: sample?.rows ?? [], isLoading: loading, error: null as string | null, refresh: () => {}, pricesReady: true },
      orders: { data: sample?.orders, isLoading: loading, error: null as unknown, refetch: () => {} },
      trading: {
        fills: sample?.fills ?? [],
        fillsLoading: loading,
        fillsError: null as string | null,
        refetchFills: () => {},
        positions: sample?.positions ?? [],
        openOrders: sample?.openOrders ?? [],
        accountLoading: loading,
        exits: sample?.exits ?? null,
      },
    }
  }

  return {
    isMock: false as const,
    wallet: {
      rows: model.transactions,
      isLoading: model.isLoading,
      error: model.error,
      refresh: model.refresh,
      // stats is null while the USD index loads; until then nothing is priced.
      pricesReady: model.stats !== null,
    },
    orders: { data: orders.data, isLoading: orders.isLoading, error: orders.error as unknown, refetch: () => void orders.refetch() },
    trading: {
      fills: fills.fills,
      fillsLoading: fills.isLoading,
      fillsError: fills.error,
      refetchFills: () => void fills.refetch(),
      positions: account.positions,
      openOrders: account.openOrders,
      accountLoading: account.isLoading,
      exits: null as Map<string, ExitReason> | null,
    },
  }
}

"use client"

/**
 * Transactions: the preview's page (app/(redesign)/transactions-unauth) on
 * real data. Same heading, summary row and history workspace; the list, the
 * stats, the polling and every filter are useUnifiedTransactions exactly as
 * the previous page used it (components/transactions/transactions-client.tsx,
 * kept unused). Fiat orders (GET /fiat/orders, the same useFiatOrders query
 * the old order list made) are rows of the same history, marked "Bank"; the
 * old list (components/fiat/history/FiatOrderHistory.tsx) is kept, unused.
 * The summary cards stay wallet-only, so no money is counted twice.
 */

import * as React from "react"

import { DashScope } from "@/components/dash"
import { Rise } from "@/components/ui/system"
import { useUnifiedTransactions } from "@/hooks/use-unified-transactions"
import { useFiatOrders } from "@/hooks/crypto/useFiatOrders"
import { mergeHistory } from "@/lib/fiat-history"
import { Summary } from "@/components/transactions/redesign/summary"
import { History } from "@/components/transactions/redesign/history"

export function TransactionsPage() {
  const model = useUnifiedTransactions({ pollInterval: 30000 })
  const orders = useFiatOrders(50)
  const { transactions, stats, error } = model
  const rows = React.useMemo(() => mergeHistory(transactions, orders.data), [transactions, orders.data])
  const isLoading = model.isLoading || orders.isLoading
  const pending = rows.filter((t) => t.status === "pending" || t.status === "processing").length
  const failed = rows.filter((t) => t.status === "failed").length
  const refetchOrders = React.useCallback(() => void orders.refetch(), [orders])

  return (
    <DashScope className="ws-icon-mono mx-auto flex w-full max-w-[1720px] flex-col gap-4 md:gap-5">
      <Rise>
        <div className="flex flex-col gap-1.5 px-1">
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.03em] text-foreground md:text-[32px]">
            Transactions
          </h1>
          <p className="text-[14px] text-muted-foreground">
            Every deposit, withdrawal, swap and transfer, across all your accounts
            {!isLoading && pending > 0 && (
              <>
                {" "}· <span className="font-semibold text-warning">{pending} pending</span>
              </>
            )}
            {!isLoading && failed > 0 && (
              <>
                {" "}· <span className="font-semibold text-debit">{failed} failed</span>
              </>
            )}
          </p>
        </div>
      </Rise>
      <Rise delay={60}>
        <Summary stats={stats} transactions={transactions} />
      </Rise>
      {error && (
        <div role="alert" className="rounded-2xl border border-debit/20 bg-debit/[0.08] px-4 py-3 text-[13px] text-debit">
          {error}
        </div>
      )}
      <Rise delay={120}>
        <History model={model} rows={rows} orders={{ isLoading: orders.isLoading, error: orders.error, refetch: refetchOrders }} />
      </Rise>
    </DashScope>
  )
}

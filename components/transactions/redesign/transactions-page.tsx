"use client"

/**
 * Transactions: the preview's page (app/(redesign)/transactions-unauth) on
 * real data. Same heading, summary row and history workspace; the list, the
 * stats, the polling and every filter are useUnifiedTransactions exactly as
 * the previous page used it (components/transactions/transactions-client.tsx,
 * kept unused). The fiat order history the preview doesn't have follows below.
 */

import * as React from "react"

import { DashScope } from "@/components/dash"
import { Rise } from "@/components/ui/system"
import { FiatOrderHistory } from "@/components/fiat/history/FiatOrderHistory"
import { useUnifiedTransactions } from "@/hooks/use-unified-transactions"
import { Summary } from "@/components/transactions/redesign/summary"
import { History } from "@/components/transactions/redesign/history"

export function TransactionsPage() {
  const model = useUnifiedTransactions({ pollInterval: 30000 })
  const { transactions, stats, error, isLoading } = model
  const pending = transactions.filter((t) => t.status === "pending" || t.status === "processing").length
  const failed = transactions.filter((t) => t.status === "failed").length

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
        <History model={model} />
      </Rise>
      <Rise delay={180}>
        <FiatOrderHistory />
      </Rise>
    </DashScope>
  )
}

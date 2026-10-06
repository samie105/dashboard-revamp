import type { Metadata } from "next"

import { Rise } from "@/components/ui/system"
import { Summary } from "@/components/transactions-unauth/summary"
import { History } from "@/components/transactions-unauth/history"
import { SUMMARY } from "@/components/transactions-unauth/tx-data"

export const metadata: Metadata = {
  title: "Transactions preview",
  description: "Redesigned WorldStreet transactions page, rendered from dummy data.",
  robots: { index: false, follow: false },
}

/**
 * Transactions. The frame comes from app/(redesign)/layout.tsx. Every
 * transaction, address and hash is invented (tx-data.ts); the heading carries
 * a "Demo data" tag.
 */
export default function TransactionsUnauthPage() {
  return (
    <div className="mx-auto flex w-full max-w-[1720px] flex-col gap-4 p-4 md:gap-5 md:p-6">
      <Rise>
        <div className="flex flex-col gap-1.5 px-1">
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.03em] text-foreground md:text-[32px]">
              Transactions
            </h1>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/80">
              Demo data
            </span>
          </div>
          <p className="text-[14px] text-muted-foreground">
            Every deposit, withdrawal, swap, trade and transfer from the last 30 days
            {SUMMARY.pending > 0 && (
              <>
                {" "}· <span className="font-semibold text-warning">{SUMMARY.pending} pending</span>
              </>
            )}
            {SUMMARY.failed > 0 && (
              <>
                {" "}· <span className="font-semibold text-debit">{SUMMARY.failed} failed</span>
              </>
            )}
          </p>
        </div>
      </Rise>
      <Rise delay={60}>
        <Summary />
      </Rise>
      <Rise delay={120}>
        <History />
      </Rise>
    </div>
  )
}

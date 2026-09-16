import type { Metadata } from "next"

import { Rise } from "@/components/ui/system"
import { PreviewNotice, SectionRule } from "@/components/preview/page-chrome"
import { Summary } from "@/components/transactions-unauth/summary"
import { History } from "@/components/transactions-unauth/history"

export const metadata: Metadata = {
  title: "Transactions preview",
  description: "Redesigned WorldStreet transactions page, rendered from dummy data.",
  // A demo surface has no business in search results.
  robots: { index: false, follow: false },
}

export default function TransactionsUnauthPage() {
  return (
    <div className="flex flex-col gap-6 overflow-x-hidden p-4 md:p-6 lg:p-8">
      <PreviewNotice>
        Every transaction, address and hash below is invented. Nothing here reads a chain or an account —
        the page is open without signing in so the layout can be reviewed on its own.
      </PreviewNotice>

      <Rise>
        <div className="flex flex-col gap-3">
          <SectionRule label="This month" note="Settled transactions only" />
          <Summary />
        </div>
      </Rise>

      <Rise delay={60}>
        <div className="flex flex-col gap-3">
          <SectionRule label="History" note="Newest first" />
          <History />
        </div>
      </Rise>
    </div>
  )
}

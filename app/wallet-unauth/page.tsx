import type { Metadata } from "next"

import { Rise } from "@/components/ui/system"
import { PreviewNotice, SectionRule } from "@/components/preview/page-chrome"
import { Equity } from "@/components/wallet-unauth/equity"
import { Balances } from "@/components/wallet-unauth/balances"
import { Limits } from "@/components/wallet-unauth/limits"
import { Movements } from "@/components/wallet-unauth/movements"

export const metadata: Metadata = {
  title: "Wallet preview",
  description: "Redesigned WorldStreet wallet, rendered from dummy data.",
  // A demo surface has no business in search results.
  robots: { index: false, follow: false },
}

export default function WalletUnauthPage() {
  return (
    // overflow-x-hidden for the same reason the live pages carry it: the
    // full-bleed rails inside must not widen the document on a phone.
    <div className="flex flex-col gap-6 overflow-x-hidden p-4 md:p-6 lg:p-8">
      <PreviewNotice>
        Every balance, address and transaction below is invented. Nothing here reads a wallet, a chain or
        the live market — and none of these addresses belong to anyone, so do not send funds to them. The
        page is open without signing in so the layout can be reviewed on its own.
      </PreviewNotice>

      <Rise>
        <Equity />
      </Rise>

      <Rise delay={60}>
        <div className="flex flex-col gap-3">
          <SectionRule label="Balances" note="Spot · Funding · Futures · Earn" />
          <Balances />
        </div>
      </Rise>

      <Rise delay={120}>
        <div className="flex flex-col gap-3">
          <SectionRule label="History" note="Last 30 days" />
          {/* Movements and limits sit together: "why did that withdrawal not
              go through?" is answered by one or the other. */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <Movements />
            <Limits />
          </div>
        </div>
      </Rise>

    </div>
  )
}

import { Suspense } from "react"
import type { Metadata } from "next"

import { Rise } from "@/components/ui/system"
import { WalletHero } from "@/components/wallet-unauth/hero"
import { ActionPanel } from "@/components/wallet-unauth/action-panel"
import { BalancesTable } from "@/components/wallet-unauth/balances-table"
import { SecurityLimits, WalletActivity } from "@/components/wallet-unauth/activity"

export const metadata: Metadata = {
  title: "Wallet preview",
  description: "Redesigned WorldStreet wallet, rendered from dummy data.",
  robots: { index: false, follow: false },
}

/**
 * The wallet. The frame comes from app/(redesign)/layout.tsx; the rail's
 * Wallet / Deposit / Withdraw / Transfer rows all land here, the last three
 * with `?action=` set so the action panel opens on the right tab.
 *
 * The action panel reads the URL (useSearchParams), so each copy sits in a
 * Suspense boundary — without one the whole page would opt out of static
 * rendering. It renders twice on purpose: under the hero on a phone, where
 * it has to come before the long table, and in the side column on wide
 * screens. Only one is ever visible.
 *
 * Every balance and address is invented; the hero carries a "Demo data" tag.
 */
export default function WalletUnauthPage() {
  return (
    <div className="mx-auto grid w-full max-w-[1720px] grid-cols-1 gap-4 p-4 md:gap-5 md:p-6 2xl:grid-cols-[minmax(0,1fr)_408px]">
      <div className="flex min-w-0 flex-col gap-4 md:gap-5">
        <Rise>
          <WalletHero />
        </Rise>
        <Rise delay={60} className="2xl:hidden">
          <Suspense>
            <ActionPanel id="wallet-actions-inline" />
          </Suspense>
        </Rise>
        <Rise delay={120}>
          <BalancesTable />
        </Rise>
        <Rise delay={180}>
          <WalletActivity />
        </Rise>
      </div>

      <aside className="flex min-w-0 flex-col gap-4 md:gap-5">
        <Rise delay={80} className="hidden 2xl:block">
          <Suspense>
            <ActionPanel id="wallet-actions-side" />
          </Suspense>
        </Rise>
        <Rise delay={200}>
          <SecurityLimits />
        </Rise>
      </aside>
    </div>
  )
}

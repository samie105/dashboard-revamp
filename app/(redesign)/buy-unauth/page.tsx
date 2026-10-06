import type { Metadata } from "next"

import { Rise } from "@/components/ui/system"
import { TradePage } from "@/components/buy-sell-unauth/trade-page"

export const metadata: Metadata = {
  title: "Buy crypto preview",
  description: "Redesigned WorldStreet buy page, rendered from dummy data.",
  robots: { index: false, follow: false },
}

/**
 * Buy crypto. Not in the rail — reached from the top bar's Buy Crypto menu and the
 * dashboard's quick actions. The frame comes from app/(redesign)/layout.tsx.
 * `?asset=BTC` and `?method=card` preselect the form, so menu entries can
 * deep-link into it. Every price, method and order is invented.
 */
export default async function BuyUnauthPage({ searchParams }: { searchParams: Promise<{ asset?: string; method?: string }> }) {
  const { asset, method } = await searchParams
  return (
    <div className="mx-auto flex w-full max-w-[1720px] flex-col gap-4 p-4 md:gap-5 md:p-6">
      <Rise>
        <div className="flex flex-col gap-1.5 px-1">
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.03em] text-foreground md:text-[32px]">Buy crypto</h1>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/80">
              Demo data
            </span>
          </div>
          <p className="text-[14px] text-muted-foreground">Pay with your Dollar Account, a card or a Nigerian bank transfer. Coins land in your wallet in minutes.</p>
        </div>
      </Rise>
      {/* Keyed so switching Buy ↔ Sell (or following a deep link) starts a
          fresh form instead of carrying the other side's state. */}
      <TradePage key={`${asset ?? ""}-${method ?? ""}`} mode="buy" initialAsset={asset?.toUpperCase()} initialMethod={method} />
    </div>
  )
}

import type { Metadata } from "next"

import { Terminal } from "@/components/trade-unauth/terminal"
import type { Venue } from "@/components/trade-unauth/pair-header"

export const metadata: Metadata = {
  title: "Trade preview",
  description: "Redesigned WorldStreet trading terminal, rendered from dummy data.",
  robots: { index: false, follow: false },
}

/**
 * The trading terminal. The frame comes from app/(redesign)/layout.tsx, with
 * the rail held to an icon strip on this page so the chart gets the width.
 *
 * `?market=spot|futures&pair=SOL-USDT` pick the market, so the markets page
 * and the rail's Trade / Futures rows deep-link straight in. Every price,
 * candle, book level and fill is invented; nothing can be submitted.
 */
export default async function TradeUnauthPage({ searchParams }: { searchParams: Promise<{ market?: string; pair?: string }> }) {
  const { market, pair } = await searchParams
  const venue: Venue = market === "futures" ? "futures" : "spot"
  return (
    <div className="mx-auto flex w-full max-w-[1920px] flex-col lg:gap-3 lg:p-4">
      {/* Desktop only — the phone terminal has its own compact header. */}
      <div className="hidden items-center gap-2.5 px-1 lg:flex">
        <h1 className="font-display text-[20px] font-semibold tracking-[-0.02em] text-foreground">Trade</h1>
        <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/80">
          Demo data
        </span>
        <span className="hidden text-[12.5px] text-muted-foreground sm:inline">Prices, book and fills are invented — no order is sent.</span>
      </div>
      {/* Keyed on venue so following a rail link between Trade and Futures
          starts that venue fresh rather than carrying the other's state. */}
      <Terminal key={venue} initialVenue={venue} initialPair={pair} bareUrl={!market} />
    </div>
  )
}

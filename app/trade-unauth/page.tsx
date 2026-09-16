import type { Metadata } from "next"

import Link from "next/link"
import Image from "next/image"

import { Rise } from "@/components/ui/system"
import { PreviewNotice } from "@/components/preview/page-chrome"
import { PREVIEW_ROUTES } from "@/components/preview/routes"
import { TradeWorkspace } from "@/components/trade-unauth/workspace"

export const metadata: Metadata = {
  title: "Trade preview",
  description: "Redesigned WorldStreet trading screen, rendered from dummy data.",
  robots: { index: false, follow: false },
}

export default function TradeUnauthPage() {
  return (
    // LayoutShell renders this route full-bleed — no sidebar, no navbar — so
    // the workspace owns its own top bar and its own scroll container.
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-3 border-b border-border/40 bg-card/30 px-4 py-2.5 backdrop-blur-xl">
        <Link
          href={PREVIEW_ROUTES.markets}
          className="ws-icon-mono inline-flex items-center gap-2 rounded-full px-2 py-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M10 3.5 5.5 8l4.5 4.5" />
          </svg>
          Markets
        </Link>
        <span aria-hidden className="h-4 w-px bg-border" />
        <Link href={PREVIEW_ROUTES.dashboard} className="flex items-center gap-2">
          <Image
            src="/worldstreet-logo/WorldStreet1.png"
            alt="Worldstreet"
            width={22}
            height={22}
            className="h-[22px] w-[22px] shrink-0 object-contain"
            priority
          />
          <span className="font-display text-[14px] font-semibold tracking-[-0.01em]">WorldStreet</span>
        </Link>
        <Link
          href={PREVIEW_ROUTES.wallet}
          className="ml-auto rounded-full bg-surface-sunken px-3 py-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Back to wallet
        </Link>
      </header>

      <div className="slim-scroll flex flex-1 flex-col gap-5 overflow-y-auto overflow-x-hidden p-4 md:p-5 lg:p-6">
      <PreviewNotice>
        Every price, candle, order-book level and fill below is invented and frozen. Nothing here reaches a
        venue — no order you place can be submitted. The page is open without signing in so the layout can
        be reviewed on its own.
      </PreviewNotice>

        <Rise>
          <TradeWorkspace />
        </Rise>
      </div>
    </div>
  )
}

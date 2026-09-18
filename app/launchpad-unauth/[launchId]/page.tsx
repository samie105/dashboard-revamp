import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { CardShell, Rise } from "@/components/ui/system"
import { CARD_HUE } from "@/components/ui/surface"
import { PreviewNotice, SectionRule } from "@/components/preview/page-chrome"
import { PREVIEW_ROUTES } from "@/components/preview/routes"
import { CurveChart } from "@/components/launchpad-unauth/curve-chart"
import { ManifestCard } from "@/components/launchpad-unauth/parts"
import {
  AboutPanel,
  AllocationPanel,
  ProgressRail,
  TermsPanel,
  TicketPlaceholder,
  TokenHero,
} from "@/components/launchpad-unauth/token-panels"
import {
  LAUNCHES,
  launchById,
  viewOf,
} from "@/components/launchpad-unauth/launch-data"

type Props = { params: Promise<{ launchId: string }> }

/** Every preview launch is known at build time, so each page is static. */
export function generateStaticParams() {
  return LAUNCHES.map((l) => ({ launchId: l.id }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { launchId } = await params
  const launch = launchById(launchId)
  return {
    title: launch
      ? `${launch.name} (${launch.symbol}) · Launchpad preview`
      : "Launchpad preview",
    robots: { index: false, follow: false },
  }
}

export default async function LaunchUnauthPage({ params }: Props) {
  const { launchId } = await params
  const launch = launchById(launchId)
  if (!launch) notFound()
  const v = viewOf(launch)

  return (
    <div className="flex flex-col gap-6 overflow-x-hidden p-4 md:p-6 lg:p-8">
      <PreviewNotice>
        {v.name} is invented, and so is every figure on this page. The curve
        arithmetic is real — price, market cap and progress all come from one
        formula — but nothing here exists on chain.
      </PreviewNotice>

      <Link
        href={PREVIEW_ROUTES.launchpad}
        className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3">
          <path
            d="M7.5 2.5 4 6l3.5 3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        All launches
      </Link>

      <Rise>
        <TokenHero launch={v} />
      </Rise>

      {/* Chart and progress on the left, the ticket's place and the creator's
          share on the right — so the two things a buyer weighs, "where is the
          price going" and "how much does the creator hold", are side by side. */}
      <Rise delay={60}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-col gap-3">
              <SectionRule
                label="The curve"
                note="Price rises as supply is bought"
              />
              <CardShell className={CARD_HUE}>
                <div className="p-4 sm:p-5">
                  <CurveChart launch={v} />
                </div>
              </CardShell>
            </div>
            <ProgressRail launch={v} />
            <AboutPanel launch={v} />
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <TicketPlaceholder launch={v} />
            <AllocationPanel launch={v} />
            <TermsPanel launch={v} />
          </div>
        </div>
      </Rise>

      <Rise delay={120}>
        <ManifestCard page="token" />
      </Rise>
    </div>
  )
}

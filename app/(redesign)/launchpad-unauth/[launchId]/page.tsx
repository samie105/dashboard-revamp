import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { Rise } from "@/components/ui/system"
import { AboutCard, CurveChart, CurveTicket, GraduationCard, SupplyCard, TokenHeader, TradesCard } from "@/components/launchpad-unauth/token"
import { PreviewControls } from "@/components/launchpad-unauth/ui"
import { LAUNCHES, launchById, viewOf } from "@/components/launchpad-unauth/launch-data"

type Props = { params: Promise<{ launchId: string }> }

/** Every preview launch is known at build time, so each page is static. */
export function generateStaticParams() {
  return LAUNCHES.map((l) => ({ launchId: l.id }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { launchId } = await params
  const launch = launchById(launchId)
  return {
    title: launch ? `${launch.name} (${launch.symbol}) · Launchpad preview` : "Launchpad preview",
    robots: { index: false, follow: false },
  }
}

/**
 * One launch. The frame comes from app/(redesign)/layout.tsx. The launch is
 * invented; the curve arithmetic is real, so the chart, progress and quote
 * agree by construction.
 */
export default async function LaunchUnauthPage({ params }: Props) {
  const { launchId } = await params
  const launch = launchById(launchId)
  if (!launch) notFound()
  const v = viewOf(launch)

  return (
    <div className="mx-auto flex w-full max-w-[1720px] flex-col gap-4 p-4 md:gap-5 md:p-6">
      <Rise>
        <TokenHeader launch={v} />
      </Rise>
      <Rise delay={60}>
        <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
          {/* On a phone the ticket comes first — it's why most people opened
              the page — so the right column is ordered before the left there. */}
          <div className="order-2 flex min-w-0 flex-col gap-4 md:gap-5 xl:order-1">
            <CurveChart launch={v} />
            <TradesCard launch={v} />
            <AboutCard launch={v} />
          </div>
          <div className="order-1 flex min-w-0 flex-col gap-4 md:gap-5 xl:sticky xl:top-4 xl:order-2">
            {v.status === "live" ? <CurveTicket launch={v} /> : <GraduationCard launch={v} />}
            <SupplyCard launch={v} />
          </div>
        </div>
      </Rise>
      <PreviewControls page="token" />
    </div>
  )
}

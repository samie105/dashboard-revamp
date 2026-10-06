import type { Metadata } from "next"
import Link from "next/link"

import { Rise } from "@/components/ui/system"
import { PREVIEW_ROUTES } from "@/components/preview/routes"
import { CreateWorkspace } from "@/components/launchpad-unauth/create"
import { PreviewControls } from "@/components/launchpad-unauth/ui"

export const metadata: Metadata = {
  title: "Launch a token · Launchpad preview",
  robots: { index: false, follow: false },
}

/**
 * Create a launch. The frame comes from app/(redesign)/layout.tsx. Nothing
 * entered leaves the page — no token is created, no icon uploaded, no fee
 * charged. Figures marked "est." await a product decision.
 */
export default function CreateLaunchUnauthPage() {
  return (
    <div className="mx-auto flex w-full max-w-[1720px] flex-col gap-4 p-4 md:gap-5 md:p-6">
      <Rise>
        <div className="flex flex-col gap-2 px-1">
          <Link href={PREVIEW_ROUTES.launchpad} className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground">
            <svg aria-hidden viewBox="0 0 12 12" className="size-3">
              <path d="M7.5 2.5 4 6l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            All launches
          </Link>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-[28px] font-semibold tracking-[-0.03em] text-foreground md:text-[32px]">Launch a token</h1>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/80">Demo</span>
          </div>
          <p className="max-w-[64ch] text-[14px] leading-relaxed text-muted-foreground">
            Four short steps. Your token starts on a bonding curve and graduates to the open market once the curve fills — the preview and the cost update as you type.
          </p>
        </div>
      </Rise>
      <Rise delay={60}>
        <CreateWorkspace />
      </Rise>
      <PreviewControls page="create" />
    </div>
  )
}

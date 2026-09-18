import type { Metadata } from "next"
import Link from "next/link"

import { Rise } from "@/components/ui/system"
import { PreviewNotice } from "@/components/preview/page-chrome"
import { PREVIEW_ROUTES } from "@/components/preview/routes"
import { CreateWorkspace } from "@/components/launchpad-unauth/create-workspace"
import { ManifestCard } from "@/components/launchpad-unauth/parts"

export const metadata: Metadata = {
  title: "Launch a token · Launchpad preview",
  robots: { index: false, follow: false },
}

export default function CreateLaunchUnauthPage() {
  return (
    <div className="flex flex-col gap-6 overflow-x-hidden p-4 md:p-6 lg:p-8">
      <PreviewNotice>
        Nothing you enter here leaves this page — no token is created, no icon
        is uploaded, and no fee is charged. Figures marked{" "}
        <span className="font-semibold">est.</span> are placeholders awaiting a
        product decision.
      </PreviewNotice>

      <div className="flex flex-col gap-1.5">
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
        <h1 className="font-display text-[28px] font-semibold tracking-[-0.02em]">
          Launch a token
        </h1>
        <p className="max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
          Your token starts on a bonding curve and graduates to the open market
          once the curve fills. The cost, and a preview of how your launch will
          look, update as you type.
        </p>
      </div>

      <Rise>
        <CreateWorkspace />
      </Rise>

      <Rise delay={80}>
        <ManifestCard page="create" />
      </Rise>
    </div>
  )
}

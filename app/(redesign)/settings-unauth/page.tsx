import type { Metadata } from "next"

import { SettingsHeader, SettingsWorkspace } from "@/components/settings-unauth/settings"
import { sectionOf } from "@/components/settings-unauth/sections"

export const metadata: Metadata = {
  title: "Settings preview",
  description: "Redesigned WorldStreet account settings, rendered from dummy data.",
  robots: { index: false, follow: false },
}

/**
 * Settings. The frame comes from app/(redesign)/layout.tsx. `?section=` picks
 * the section, so the account menu can deep-link. Changes persist in this
 * browser only — no account is touched.
 *
 * Deliberately NOT wrapped in <Rise>: its entrance animation uses transform,
 * which would pin the page's fixed "Saved" toast to the wrapper instead of
 * the screen.
 */
export default async function SettingsUnauthPage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const { section } = await searchParams
  const initial = sectionOf(section)
  return (
    // Full-screen: the frame drops its top bar and rail on this route (see
    // DashboardFrame), and this header is the page's whole chrome.
    <div className="flex min-h-full flex-col">
      <SettingsHeader />
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 p-4 md:gap-5 md:px-8 md:py-7">
        <SettingsWorkspace initialSection={initial} />
      </div>
    </div>
  )
}

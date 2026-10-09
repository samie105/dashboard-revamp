import type { Metadata } from "next"

import { DashScope } from "@/components/dash"
import { SettingsWorkspace } from "@/components/settings/redesign/settings"
import { sectionOf } from "@/components/settings-unauth/sections"

export const metadata: Metadata = { title: "Settings" }

/**
 * Settings. Sections and rows that aren't wired yet stay tagged "Soon"
 * inside the page. `?section=` picks the section, as in the preview.
 */
export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const { section } = await searchParams
  return (
    <DashScope className="ws-icon-mono [&_button:not(:disabled)]:cursor-pointer mx-auto flex w-full max-w-[1720px] flex-col gap-4 p-4 md:gap-5 md:p-6">
      <div className="flex flex-col gap-1.5 px-1">
        <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.03em] text-foreground md:text-[32px]">Settings</h1>
        <p className="text-[14px] text-muted-foreground">Your profile, wallet security, preferences and sessions.</p>
      </div>
      <div className="w-full max-w-[1280px]">
        <SettingsWorkspace initialSection={sectionOf(section)} />
      </div>
    </DashScope>
  )
}

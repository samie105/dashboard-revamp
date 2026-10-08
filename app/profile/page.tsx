import type { Metadata } from "next"

import { DashScope } from "@/components/dash"
import { ProfilePage } from "@/components/settings/redesign/settings"

export const metadata: Metadata = { title: "Profile" }

/** Profile — the Settings page's Profile section, on its own route. Live
 *  everywhere (unlike the rest of Settings, which is still dev-only). */
export default function ProfileRoute() {
  return (
    <DashScope className="ws-icon-mono [&_button:not(:disabled)]:cursor-pointer mx-auto flex w-full max-w-[1720px] flex-col gap-4 p-4 md:gap-5 md:p-6">
      <div className="flex flex-col gap-1.5 px-1">
        <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.03em] text-foreground md:text-[32px]">Profile</h1>
        <p className="text-[14px] text-muted-foreground">Your name, username and region, and how we reach you.</p>
      </div>
      {/* A form reads best at a measured width, left-aligned under the heading. */}
      <div className="w-full max-w-[960px]">
        <ProfilePage />
      </div>
    </DashScope>
  )
}

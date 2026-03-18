"use client"

import { VividProvider } from "@worldstreet/vivid-voice"
import { useUser, useAuth } from "@clerk/nextjs"
import { usePathname } from "next/navigation"
import VividVoiceControl from "@/components/vivid/vivid-voice-control"

const HIDE_MIC_ROUTES = ["/spot", "/futures", "/forex", "/binary", "/vivid"]

export function VividVoiceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser()
  const { isSignedIn } = useAuth()
  const pathname = usePathname()

  const hideMic = HIDE_MIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))

  return (
    <VividProvider
      user={user ? { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.primaryEmailAddress?.emailAddress } : null}
      isSignedIn={isSignedIn ?? false}
      pathname={pathname}
      requireAuth
    >
      {children}
      {!hideMic && <VividVoiceControl />}
    </VividProvider>
  )
}

"use client"

import { VividProvider } from "@worldstreet/vivid-voice"
import { useUser, useAuth } from "@clerk/nextjs"
import { usePathname } from "next/navigation"
import VividVoiceControl from "@/components/vivid/vivid-voice-control"

export function VividVoiceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser()
  const { isSignedIn } = useAuth()
  const pathname = usePathname()

  return (
    <VividProvider
      user={user ? { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.primaryEmailAddress?.emailAddress } : null}
      isSignedIn={isSignedIn ?? false}
      pathname={pathname}
      requireAuth
    >
      {children}
      <VividVoiceControl />
    </VividProvider>
  )
}

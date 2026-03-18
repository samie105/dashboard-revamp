"use client"

import { useEffect } from "react"
import { VividProvider } from "@worldstreet/vivid-voice"
import { useUser, useAuth } from "@clerk/nextjs"
import { usePathname, useRouter } from "next/navigation"
import { useProfile } from "@/components/profile-provider"
import { allFunctions } from "@/lib/vivid-functions"
import VividVoiceControl from "@/components/vivid/vivid-voice-control"

const HIDE_MIC_ROUTES = ["/spot", "/futures", "/forex", "/binary", "/vivid"]

export function VividVoiceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser()
  const { isSignedIn } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const { profile } = useProfile()

  const hideMic = HIDE_MIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))

  // Listen for vivid:navigate events dispatched by the navigateToPage function
  useEffect(() => {
    const handler = (e: Event) => {
      const path = (e as CustomEvent).detail?.path
      if (path && path !== pathname) router.push(path)
    }
    window.addEventListener("vivid:navigate", handler)
    return () => window.removeEventListener("vivid:navigate", handler)
  }, [router, pathname])

  // Build user object for VividProvider
  const vividUser = user
    ? {
        id: user.id,
        firstName: user.firstName || profile?.displayName || undefined,
        lastName: user.lastName || undefined,
        email: user.primaryEmailAddress?.emailAddress || profile?.email || undefined,
      }
    : null

  return (
    <VividProvider
      user={vividUser}
      isSignedIn={isSignedIn ?? false}
      pathname={pathname}
      requireAuth
      voice="coral"
      persistConversation={true}
      functions={allFunctions}
      platformContext={(_user: unknown, currentPath: string) => {
        // Build portfolio summary from profile data when available
        let portfolioContext = ""
        if (profile) {
          if (profile.watchlist && profile.watchlist.length > 0) {
            portfolioContext += `\nThe user's watchlist includes: ${profile.watchlist.join(", ")}.`
          }
          if (profile.preferredCurrency) {
            portfolioContext += `\nThe user's preferred currency is ${profile.preferredCurrency}.`
          }
        }

        return `
This is the WorldStreet Dashboard — a cryptocurrency trading platform within the WorldStreet ecosystem.

Current page: ${currentPath}

Available dashboard pages the user can navigate to:
- / — Dashboard home (overview & summary)
- /spot — Spot trading (buy/sell crypto)
- /futures — Futures trading
- /swap — Token swap
- /assets — User's portfolio & asset overview
- /deposit — Deposit funds
- /withdraw — Withdraw funds
- /transactions — Transaction history

You have tools to check live crypto prices, analyze markets, check the user's portfolio balance, and pull their transaction history. Use them when relevant — don't guess data you can look up.
When users ask about their portfolio, wallets, or account details, use the information provided below.
Keep responses brief and conversational since users are listening, not reading.
Be direct, natural, and sharp. Skip the filler.
${portfolioContext}
        `.trim()
      }}
    >
      {children}
      {!hideMic && <VividVoiceControl />}
    </VividProvider>
  )
}

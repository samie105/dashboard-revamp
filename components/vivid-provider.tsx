"use client"

import { useEffect } from "react"
import { VividProvider } from "@worldstreet/vivid-voice"
import { useUser, useAuth } from "@clerk/nextjs"
import { usePathname, useRouter } from "next/navigation"
import { useProfile } from "@/components/profile-provider"
import { allFunctions } from "@/lib/vivid-functions"
import { getPageInfo } from "@/lib/vivid-page-context"
import VividVoiceControl from "@/components/vivid/vivid-voice-control"
import VividSpotlight from "@/components/vivid/vivid-spotlight"

// Hide the floating mic on auth/full-chat routes. It STAYS on /trade — driving
// the trading workspace by voice is the whole point of Vivid on this app.
const HIDE_MIC_ROUTES = ["/login", "/register", "/vivid", "/community"]

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
      voice="marin"
      persistConversation={true}
      functions={allFunctions}
      onAuthRequired={() => {
        const redirectUrl = encodeURIComponent(pathname || "/")
        router.push(`/login?redirect_url=${redirectUrl}`)
      }}
      platformContext={(_user: unknown, currentPath: string) => {
        // The static WorldStreet knowledge + persona live server-side in the token
        // route; only send the dynamic, per-user bits here.
        let portfolioContext = ""
        if (profile) {
          if (profile.watchlist && profile.watchlist.length > 0) {
            portfolioContext += `\nThe user's watchlist includes: ${profile.watchlist.join(", ")}.`
          }
          if (profile.preferredCurrency) {
            portfolioContext += `\nThe user's preferred currency is ${profile.preferredCurrency}.`
          }
        }

        const page = getPageInfo(currentPath)

        // NOTE: this prompt is built once, when the session starts. The user can
        // navigate mid-session, so the page details below go stale — Vivid must
        // call getCurrentPageContext rather than trust them later on.
        return `
## Where The User Started
When this session began they were on ${currentPath} — ${page.name}.
${page.summary}
This is a starting snapshot only. They can move around while you're talking, so before answering anything about "this page" or "this screen", call getCurrentPageContext to see where they actually are.

## Getting Around
Use navigateToPage with a destination id (never a URL path). Use openPanel for the four money doors — deposit, withdraw, fund_trading, withdraw_trading — they open as modals over whatever screen the user is on.

## Your Hands On The Screen
You can control the page itself, not just talk about it. listPageControls shows every control on the current screen; then:
- spotlightSection — when the user asks WHERE something is, point at it: the page dims and only that element stays lit. Prefer showing over describing.
- fillField — type amounts, limit prices or search text into inputs for them, exactly like a keyboard.
- pressControl — press buttons, switch tabs, pick pairs. Controls marked guarded move real money: state exactly what will happen, get a clear verbal yes, only then repeat with confirmed=true.
The natural flow for "long BTC with 100 dollars": navigateToPage(trade_futures) → listPageControls → press the Long side → fillField the amount → read the ticket back → the user presses the submit button themselves, or asks you to (it is guarded — confirm out loud first).
${portfolioContext}
        `.trim()
      }}
    >
      {children}
      {!hideMic && <VividVoiceControl />}
      {/* Mounted everywhere, not just where the mic shows — the /vivid chat page
          runs the same functions and may spotlight too. */}
      <VividSpotlight />
    </VividProvider>
  )
}

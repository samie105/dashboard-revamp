"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { AppFrame } from "@/components/chrome/frame"
import { isRedesignPath } from "@/components/preview/routes"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"
import { IncomingCallProvider } from "@/components/community/incoming-call-provider"
import { MoneyFlowProvider } from "@/components/flows/money-flow-modal"
import { LiquidGlassPointer } from "@/components/liquid-glass"
import { prefetchSpotMarkets } from "@/lib/spot-markets"
import { MigrationNoticePopup } from "@/components/crypto/MigrationNotice"

/** Routes that render full-bleed (no sidebar / top-nav / navbar).
 *  /trade is here because the market rail, the chart and the book need the
 *  width. The redesigned previews (isRedesignPath) are full-bleed too: they
 *  bring their OWN frame from app/(redesign)/layout.tsx — including the
 *  trading preview, whose rail stays an icon strip to give the chart room. */
const FULL_BLEED_ROUTES = ["/trade", "/vivid"]
const AUTH_ROUTES = ["/login", "/register"]

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))
  const isFullBleed =
    isRedesignPath(pathname) || FULL_BLEED_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))

  /* Warm the spot registry once the app has finished its own work. It is the
     slowest thing /trade waits on — 9,000+ rows — and fetching it only when
     that screen mounts is what makes the market rail open as skeletons. Idle
     time is free, the cache is shared, and a failure here is silent because
     nobody asked for it yet. */
  React.useEffect(() => {
    if (isAuthRoute) return
    const idle = window.requestIdleCallback
    if (typeof idle === "function") {
      const handle = idle(() => prefetchSpotMarkets(), { timeout: 4000 })
      return () => window.cancelIdleCallback?.(handle)
    }
    const timer = window.setTimeout(prefetchSpotMarkets, 1500)
    return () => window.clearTimeout(timer)
  }, [isAuthRoute])


  // Scroll-adaptive chrome: content moving beneath the nav pills firms
  // their glass up ([data-ws-scrolled] .ws-nav-glass). Attribute toggled
  // directly — a per-scroll-event React state would re-render the shell.
  const rootRef = React.useRef<HTMLDivElement>(null)
  const handleMainScroll = React.useCallback((e: React.UIEvent<HTMLElement>) => {
    rootRef.current?.toggleAttribute("data-ws-scrolled", (e.target as HTMLElement).scrollTop > 8)
  }, [])
  if (isAuthRoute) return <>{children}</>
  // The gold "silk" atmosphere that sat behind the dashboard and wallet hero
  // (components/ui/silk-backdrop.tsx) was removed at the lead's request, in
  // favour of the redesign frame's static gold bloom (below).

  if (isFullBleed) {
    return (
      <IncomingCallProvider>
        <MoneyFlowProvider>
          <div className="flex h-dvh flex-col overflow-hidden">
            <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
          </div>
          {/* Full-bleed drops the sidebar and the navbar, and it used to drop
              the bottom bar with them — which on a phone left /trade and
              /vivid with no way out but the browser's back gesture and the
              one back arrow in the page's own header. The bar is the only
              navigation a phone has here, so it stays. These routes own their
              full height, so each reserves its own clearance for the floating
              capsule (see the trade workspace's bottom padding).
              The redesigned previews are the exception: their frame's drawer
              (the menu button in its top bar) carries the phone's navigation. */}
          {!isRedesignPath(pathname) && <MobileBottomNav />}
        </MoneyFlowProvider>
      </IncomingCallProvider>
    )
  }

  return (
    <IncomingCallProvider>
      <MoneyFlowProvider>
        <div ref={rootRef} className="relative flex flex-col h-screen overflow-hidden">
          <LiquidGlassPointer />
          {/* Atmosphere: the redesign frame's low gold bloom behind the top of
              the page (components/redesign/shell.tsx). A wide radial set off
              the top edge, so only its lower half shows — well under any text.
              Gold from --primary; fixed and non-interactive. */}
          <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
            <div className="absolute -top-40 left-[18%] h-[520px] w-[820px] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--primary)_7.5%,transparent),transparent)]" />
          </div>
          {/* The redesign's frame: top bar across the page, rail on the left
              (components/chrome/frame.tsx). It replaced AppSidebar + Navbar,
              which are kept in the repo, unused. */}
          <AppFrame onMainScroll={handleMainScroll}>{children}</AppFrame>
          <MobileBottomNav />
          {/* Spec §2 — the legacy-wallet migration message, shown once per
              user as an announcement. It lives on afterwards in the navbar's
              notification centre (MigrationNotice variant="notification"),
              which is reachable on mobile and desktop alike. */}
          <MigrationNoticePopup />
        </div>
      </MoneyFlowProvider>
    </IncomingCallProvider>
  )
}

"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Navbar } from "@/components/navbar"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"
import { IncomingCallProvider } from "@/components/community/incoming-call-provider"
import { MoneyFlowProvider } from "@/components/flows/money-flow-modal"
import { SilkBackdrop } from "@/components/ui/silk-backdrop"
import { LiquidGlassPointer } from "@/components/liquid-glass"
import { prefetchSpotMarkets } from "@/lib/spot-markets"
import { MigrationNoticePopup } from "@/components/crypto/MigrationNotice"

/** Routes that render full-bleed (no sidebar / top-nav / navbar). */
const FULL_BLEED_ROUTES = ["/trade", "/vivid"]
const AUTH_ROUTES = ["/login", "/register"]

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))
  const isFullBleed = FULL_BLEED_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))

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
  // The silk atmosphere belongs to the hero pages only — the dashboard and
  // the wallet home (both lead with a Balance hero; DS §atmosphere) — but it
  // must live HERE, under the z-10 content layer, so the translucent sidebar
  // and navbar blur it through — inside <main> it could never reach behind
  // the rail.
  const isDashboard = pathname === "/" || pathname === "/wallet/modern"

  if (isFullBleed) {
    return (
      <IncomingCallProvider>
        <MoneyFlowProvider>
          <div className="flex h-dvh flex-col overflow-hidden">
            <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
          </div>
        </MoneyFlowProvider>
      </IncomingCallProvider>
    )
  }

  return (
    <IncomingCallProvider>
      <MoneyFlowProvider>
        <div ref={rootRef} className="relative flex flex-col h-screen overflow-hidden">
          <LiquidGlassPointer />
          {/* Desktop atmosphere — the rail's warm bloom spilling into the page.
              Fixed and non-interactive so it never intercepts a click. */}
          <div
            aria-hidden
            className="pointer-events-none fixed inset-y-0 left-0 z-0 hidden w-[42rem] bg-[radial-gradient(60%_50%_at_0%_18%,var(--sidebar-bleed)_0%,transparent_72%)] md:block"
          />
          {/* Dashboard atmosphere — full viewport width so the field runs
              behind the sidebar too and shows through its translucency.
              Dark gets the WebGL silk; light gets the warm paper wash. */}
          {isDashboard && (
            <>
              <div
                aria-hidden
                className="pointer-events-none fixed inset-x-0 top-0 z-0 hidden h-[60vh] dark:block"
              >
                <SilkBackdrop />
              </div>
              <div
                aria-hidden
                className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[60vh] bg-[radial-gradient(90%_75%_at_25%_0%,rgba(234,179,8,0.10)_0%,rgba(234,179,8,0.035)_45%,transparent_75%)] dark:hidden"
              />
            </>
          )}
          <div className="relative z-10 flex flex-1 overflow-hidden">
            <SidebarProvider>
              {/* Sidebar hidden on mobile — bottom nav replaces it */}
              <div className="hidden md:flex">
                <AppSidebar />
              </div>
              <div className="flex flex-1 flex-col w-full overflow-hidden">
                <Navbar />
                <div className="relative flex min-h-0 flex-1 flex-col">
                  {/* iOS scroll-edge: content frosts progressively as it
                      slides under the chrome instead of hitting a line. */}
                  <div aria-hidden className="ws-scroll-edge pointer-events-none absolute inset-x-0 top-0 z-20 h-16" />
                  {/* pb-28: the floating capsule tab bar needs clearance on
                      mobile; desktop has no bar. */}
                  <main onScroll={handleMainScroll} className="flex-1 overflow-y-auto w-full pb-28 md:pb-0">
                    {children}
                  </main>
                </div>
              </div>
            </SidebarProvider>
          </div>
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

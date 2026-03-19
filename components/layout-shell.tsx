"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Navbar } from "@/components/navbar"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"

/** Routes that render full-bleed (no sidebar / top-nav / navbar). */
const FULL_BLEED_ROUTES = ["/spot", "/futures", "/forex", "/binary", "/vivid"]

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isFullBleed = FULL_BLEED_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))

  if (isFullBleed) {
    return (
      <div className="flex h-dvh flex-col overflow-hidden">
        <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        <SidebarProvider>
          <AppSidebar />
          <div className="flex flex-1 flex-col w-full overflow-hidden">
            <Navbar />
            <main className="flex-1 overflow-y-auto w-full pb-16 md:pb-0">
              {children}
            </main>
          </div>
        </SidebarProvider>
      </div>
      <MobileBottomNav />
    </div>
  )
}

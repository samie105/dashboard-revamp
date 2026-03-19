"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  DashboardSquare01Icon,
  ChartCandlestickIcon,
  Exchange01Icon,
  Chart01Icon,
  Menu01Icon,
} from "@hugeicons/core-free-icons"
import { useTradeSelector } from "@/components/trade-selector"
import { useSidebar } from "@/components/ui/sidebar"

/* ── Bottom nav items ── */
const NAV_ITEMS = [
  { label: "Home", href: "/", icon: DashboardSquare01Icon },
  { label: "Trade", href: "__trade_selector__", icon: ChartCandlestickIcon },
  { label: "Swap", href: "/swap", icon: Exchange01Icon },
  { label: "Portfolio", href: "/portfolio", icon: Chart01Icon },
] as const

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname === "/dashboard"
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function MobileBottomNav() {
  const pathname = usePathname()
  const { openTradeSelector } = useTradeSelector()
  const { toggleSidebar } = useSidebar()

  return (
    <>
      {/* ── Bottom Nav Bar ── */}
      <nav className="fixed inset-x-0 bottom-0 z-50 md:hidden border-t border-border/15 bg-background/90 backdrop-blur-2xl safe-area-bottom">
        <div className="flex w-full items-center justify-around py-1.5">
          {NAV_ITEMS.map((item) => {
            const isTrade = item.href === "__trade_selector__"
            const active = !isTrade && isActivePath(pathname, item.href)

            if (isTrade) {
              return (
                <button
                  key={item.label}
                  onClick={() => openTradeSelector()}
                  className="flex flex-col items-center gap-1 py-1 min-w-14 text-muted-foreground"
                >
                  <HugeiconsIcon icon={item.icon} className="h-5.5 w-5.5" />
                  <span className="text-[11px] font-medium">{item.label}</span>
                </button>
              )
            }

            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 py-1 min-w-14",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <HugeiconsIcon
                  icon={item.icon}
                  className={cn("h-5.5 w-5.5", active && "text-primary")}
                />
                <span className={cn(
                  "text-[11px] font-medium",
                  active ? "text-foreground" : "text-muted-foreground",
                )}>
                  {item.label}
                </span>
              </Link>
            )
          })}

          {/* Menu button — toggles the AppSidebar drawer */}
          <button
            onClick={toggleSidebar}
            className="flex flex-col items-center gap-1 py-1 min-w-14 text-muted-foreground"
          >
            <HugeiconsIcon icon={Menu01Icon} className="h-5.5 w-5.5" />
            <span className="text-[11px] font-medium">Menu</span>
          </button>
        </div>
      </nav>
    </>
  )
}

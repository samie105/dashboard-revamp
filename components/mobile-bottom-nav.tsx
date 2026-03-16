"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  DashboardSquare01Icon,
  Chart01Icon,
  Exchange01Icon,
  ChartCandlestickIcon,
  Menu01Icon,
} from "@hugeicons/core-free-icons"
import { useTradeSelector } from "@/components/trade-selector"
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Store01Icon,
  Book01Icon,
  UserGroup02Icon,
  Video01Icon,
  Brain01Icon,
  UserIcon,
  Shield01Icon,
  Settings01Icon,
  ArrowUpRight01Icon,
} from "@hugeicons/core-free-icons"

const NAV_ITEMS = [
  { label: "Home", href: "/", icon: DashboardSquare01Icon, center: false },
  { label: "Trade", href: "__trade_selector__", icon: ChartCandlestickIcon, center: false },
  { label: "Swap", href: "/swap", icon: Exchange01Icon, center: true },
  { label: "Portfolio", href: "/portfolio", icon: Chart01Icon, center: false },
] as const

const MORE_LINKS = [
  { label: "Store", href: "https://shop.worldstreetgold.com", icon: Store01Icon, external: true },
  { label: "Academy", href: "https://academy.worldstreetgold.com", icon: Book01Icon, external: true },
  { label: "Social", href: "https://social.worldstreetgold.com", icon: UserGroup02Icon, external: true },
  { label: "Xstream", href: "https://xtreme.worldstreetgold.com", icon: Video01Icon, external: true },
  { label: "Vivid AI", href: "/vivid", icon: Brain01Icon },
  { label: "Profile", href: "/profile", icon: UserIcon },
  { label: "Security", href: "/security", icon: Shield01Icon },
  { label: "Settings", href: "/settings", icon: Settings01Icon },
]

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function MobileBottomNav() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = React.useState(false)
  const { openTradeSelector } = useTradeSelector()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex md:hidden border-t border-border/10 bg-background/80 backdrop-blur-2xl safe-area-bottom">
      <div className="flex w-full items-end justify-around px-1 pt-1.5 pb-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href)
          const isTradeSelector = item.href === "__trade_selector__"

          if (isTradeSelector) {
            return (
              <button
                key={item.label}
                onClick={() => openTradeSelector()}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-w-0",
                  "text-muted-foreground"
                )}
              >
                <HugeiconsIcon icon={item.icon} className="h-5 w-5" />
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
              </button>
            )
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-w-0",
                item.center && "relative -mt-3",
                active
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              {item.center ? (
                <div className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-full shadow-lg transition-colors",
                  active
                    ? "bg-primary text-white"
                    : "bg-primary/10 text-primary"
                )}>
                  <HugeiconsIcon icon={item.icon} className="h-5 w-5" />
                </div>
              ) : (
                <HugeiconsIcon icon={item.icon} className="h-5 w-5" />
              )}
              <span className={cn(
                "text-[10px] font-medium leading-none",
                item.center && "mt-0.5"
              )}>
                {item.label}
              </span>
            </Link>
          )
        })}

        {/* More button with bottom sheet */}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger
            render={
              <button className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-w-0",
                moreOpen ? "text-primary" : "text-muted-foreground"
              )} />
            }
          >
            <HugeiconsIcon icon={Menu01Icon} className="h-5 w-5" />
            <span className="text-[10px] font-medium leading-none">More</span>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[60vh] rounded-t-2xl">
            <SheetHeader>
              <SheetTitle className="text-sm">More</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-4 gap-3 px-2 pb-6 pt-2">
              {MORE_LINKS.map((link) => {
                const LinkComponent = link.external ? "a" : Link
                const extraProps = link.external
                  ? { target: "_blank" as const, rel: "noreferrer" as const }
                  : {}

                return (
                  <LinkComponent
                    key={link.label}
                    href={link.href}
                    onClick={() => setMoreOpen(false)}
                    className="flex flex-col items-center gap-1.5 rounded-xl p-3 transition-colors hover:bg-accent/50"
                    {...extraProps}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/60">
                      <HugeiconsIcon icon={link.icon} className="h-5 w-5 text-foreground" />
                    </div>
                    <span className="text-[10px] font-medium text-foreground/80 text-center leading-tight">
                      {link.label}
                    </span>
                    {link.external && (
                      <HugeiconsIcon icon={ArrowUpRight01Icon} className="h-2.5 w-2.5 text-muted-foreground/40 -mt-1" />
                    )}
                  </LinkComponent>
                )
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  )
}

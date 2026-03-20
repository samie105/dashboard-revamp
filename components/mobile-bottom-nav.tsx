"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  DashboardSquare01Icon,
  ChartCandlestickIcon,
  Exchange01Icon,
  Chart01Icon,
  Menu01Icon,
  Store01Icon,
  Book01Icon,
  UserGroup02Icon,
  Video01Icon,
  Brain01Icon,
  UserIcon,
  Shield01Icon,
  Settings01Icon,
  ArrowUpRight01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  Wallet01Icon,
  CreditCardIcon,
  File01Icon,
  Activity01Icon,
  GlobeIcon,
  RepeatIcon,
  Link01Icon,
  Copy01Icon,
  BarChartIcon,
  ComputerTerminal01Icon,
  Cancel01Icon,
  DollarCircleIcon,
  Rocket01Icon,
} from "@hugeicons/core-free-icons"
import { useTradeSelector } from "@/components/trade-selector"
import {
  Sheet,
  SheetTrigger,
  SheetContent,
} from "@/components/ui/sheet"

/* ── Bottom nav items ── */
const NAV_ITEMS = [
  { label: "Home", href: "/", icon: DashboardSquare01Icon },
  { label: "Trade", href: "__trade_selector__", icon: ChartCandlestickIcon },
  { label: "Swap", href: "/swap", icon: Exchange01Icon },
  { label: "Portfolio", href: "/portfolio", icon: Chart01Icon },
] as const

/* ── Sidebar nav groups (mirrors app-sidebar) ── */
interface SidebarItem {
  name: string
  url: string
  icon: typeof Activity01Icon
  external?: boolean
}

interface SidebarGroup {
  label: string
  icon: typeof Activity01Icon
  items: readonly SidebarItem[]
}

const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: "Overview",
    icon: DashboardSquare01Icon,
    items: [
      { name: "Dashboard", url: "/", icon: DashboardSquare01Icon },
      { name: "Portfolio", url: "/portfolio", icon: ChartCandlestickIcon },
      { name: "Assets", url: "/assets", icon: Wallet01Icon },
      { name: "Transactions", url: "/transactions", icon: File01Icon },
    ],
  },
  {
    label: "Community",
    icon: UserGroup02Icon,
    items: [
      { name: "Community", url: "/community", icon: UserGroup02Icon },
    ],
  },
  {
    label: "Trading",
    icon: Activity01Icon,
    items: [
      { name: "Markets", url: "/trading/markets", icon: BarChartIcon },
      { name: "Spot Trading", url: "/spot", icon: Activity01Icon },
      { name: "Futures", url: "/futures", icon: Chart01Icon },
      { name: "Forex", url: "/forex", icon: GlobeIcon },
      { name: "Binary", url: "/binary", icon: Exchange01Icon },
      { name: "Swap", url: "/swap", icon: RepeatIcon },
      { name: "Bridge", url: "/bridge", icon: Link01Icon },
      { name: "Copy Trading", url: "/copy-trading", icon: Copy01Icon },
      { name: "P2P Trading", url: "/p2p", icon: Store01Icon },
    ],
  },
  {
    label: "Account",
    icon: UserIcon,
    items: [
      { name: "Profile", url: "/profile", icon: UserIcon },
      { name: "Security", url: "/security", icon: Shield01Icon },
      { name: "Verification", url: "/verification", icon: File01Icon },
      { name: "API Management", url: "/api-management", icon: ComputerTerminal01Icon },
      { name: "Referrals", url: "/referrals", icon: UserGroup02Icon },
    ],
  },
  {
    label: "Worldstreet",
    icon: Rocket01Icon,
    items: [
      { name: "Store", url: "https://shop.worldstreetgold.com", icon: Store01Icon, external: true },
      { name: "Academy", url: "https://academy.worldstreetgold.com", icon: Book01Icon, external: true },
      { name: "Social", url: "https://social.worldstreetgold.com", icon: UserGroup02Icon, external: true },
      { name: "Xstream", url: "https://xtreme.worldstreetgold.com", icon: Video01Icon, external: true },
      { name: "Forex Trading", url: "https://trader.worldstreetgold.com", icon: DollarCircleIcon, external: true },
      { name: "Vivid AI", url: "/vivid", icon: Brain01Icon },
    ],
  },
]

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname === "/dashboard"
  return pathname === href || pathname.startsWith(`${href}/`)
}

function isExternal(url: string) {
  return url.startsWith("http://") || url.startsWith("https://")
}

function groupHasActive(pathname: string, items: readonly SidebarItem[]) {
  return items.some((item) => !isExternal(item.url) && isActivePath(pathname, item.url))
}

/* ── Collapsible sidebar group ── */
function CollapsibleGroup({
  group,
  pathname,
  onNavigate,
}: {
  group: SidebarGroup
  pathname: string
  onNavigate: () => void
}) {
  const hasActive = groupHasActive(pathname, group.items)
  const [open, setOpen] = React.useState(hasActive)

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors",
          hasActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <HugeiconsIcon icon={group.icon} className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">{group.label}</span>
        <HugeiconsIcon
          icon={open ? ArrowUp01Icon : ArrowDown01Icon}
          className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50"
        />
      </button>
      {open && (
        <div className="flex flex-col gap-px px-2 pb-1">
          {group.items.map((item) => {
            const ext = isExternal(item.url)
            const active = !ext && isActivePath(pathname, item.url)
            const Component = ext ? "a" : Link
            const extraProps = ext
              ? { target: "_blank" as const, rel: "noopener noreferrer" as const }
              : {}

            return (
              <Component
                key={item.name}
                href={item.url}
                onClick={() => !ext && onNavigate()}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-foreground/70 hover:bg-accent/50 hover:text-foreground",
                )}
                {...extraProps}
              >
                <HugeiconsIcon icon={item.icon} className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.name}</span>
                {ext && (
                  <HugeiconsIcon icon={ArrowUpRight01Icon} className="h-3 w-3 text-muted-foreground/40" />
                )}
              </Component>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function MobileBottomNav() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = React.useState(false)
  const { openTradeSelector } = useTradeSelector()

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

          {/* Menu button — opens sidebar sheet */}
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger
              render={
                <button
                  className={cn(
                    "flex flex-col items-center gap-1 py-1 min-w-14",
                    menuOpen ? "text-foreground" : "text-muted-foreground",
                  )}
                />
              }
            >
              <HugeiconsIcon icon={Menu01Icon} className="h-5.5 w-5.5" />
              <span className="text-[11px] font-medium">Menu</span>
            </SheetTrigger>

            {/* ── Mobile Sidebar Sheet ── */}
            <SheetContent
              side="left"
              className="w-70 p-0 bg-background border-r border-border/20"
              showCloseButton={false}
            >
              <div className="flex h-full flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-4 border-b border-border/20">
                  <div className="flex items-center gap-2">
                    <Image
                      src="/worldstreet-logo/WorldStreet1x.png"
                      alt="Worldstreet"
                      width={96}
                      height={24}
                      className="h-6 w-auto object-contain"
                    />
                    <span className="font-semibold text-sm">Worldstreet</span>
                  </div>
                  <button
                    onClick={() => setMenuOpen(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  >
                    <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
                  </button>
                </div>

                {/* Quick actions */}
                <div className="px-4 py-3 border-b border-border/20">
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { label: "Deposit", href: "/deposit", icon: Exchange01Icon, accent: true },
                      { label: "Withdraw", href: "/withdraw", icon: CreditCardIcon },
                      { label: "Swap", href: "/swap", icon: RepeatIcon },
                      { label: "Transfer", href: "/transactions", icon: ArrowDown01Icon },
                    ].map((action) => (
                      <Link
                        key={action.label}
                        href={action.href}
                        onClick={() => setMenuOpen(false)}
                        className={cn(
                          "flex flex-col items-center gap-1.5 rounded-xl py-2.5 text-center transition-colors",
                          action.accent
                            ? "bg-primary/10 text-primary"
                            : "bg-accent/40 text-foreground/70 hover:bg-accent hover:text-foreground",
                        )}
                      >
                        <HugeiconsIcon icon={action.icon} className="h-4.5 w-4.5" />
                        <span className="text-[10px] font-medium leading-none">{action.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Navigation groups — collapsible */}
                <div className="flex-1 overflow-y-auto py-1">
                  {SIDEBAR_GROUPS.map((group) => (
                    <CollapsibleGroup
                      key={group.label}
                      group={group}
                      pathname={pathname}
                      onNavigate={() => setMenuOpen(false)}
                    />
                  ))}
                </div>

                {/* Footer */}
                <div className="border-t border-border/20 px-4 py-3">
                  <Link
                    href="/settings"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
                  >
                    <HugeiconsIcon icon={Settings01Icon} className="h-4.5 w-4.5" />
                    Settings
                  </Link>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </>
  )
}

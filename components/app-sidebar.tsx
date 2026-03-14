"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Activity01Icon,
  Exchange01Icon,
  ChartCandlestickIcon,
  CreditCardIcon,
  File01Icon,
  DashboardSquare01Icon,
  Link01Icon,
  RepeatIcon,
  Shield01Icon,
  ComputerTerminal01Icon,
  Chart01Icon,
  UserIcon,
  UserGroup02Icon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
  SidebarTrigger,
} from "@/components/ui/sidebar"

const navigation = {
  overview: [
    { name: "Dashboard", description: "Account snapshot", url: "/", icon: DashboardSquare01Icon },
    { name: "Portfolio", description: "Market activity", url: "/portfolio", icon: ChartCandlestickIcon },
    { name: "Assets", description: "Wallet balances", url: "/assets", icon: Wallet01Icon },
    { name: "Swap", description: "Fast token swap", url: "/swap", icon: Exchange01Icon },
    { name: "Bridge", description: "Cross-chain transfers", url: "/bridge", icon: Link01Icon },
    { name: "Deposits", description: "Fund account", url: "/deposit", icon: Exchange01Icon },
    { name: "Withdrawal", description: "Send out funds", url: "/withdraw", icon: CreditCardIcon },
    { name: "Transactions", description: "History and receipts", url: "/transactions", icon: File01Icon },
  ],
  trading: [
    { name: "Spot Trading", description: "Orderbook execution", url: "/spot", icon: Activity01Icon },
    { name: "Futures", description: "Perpetual contracts", url: "/futures", icon: Chart01Icon },
    { name: "Swap", description: "One-tap conversion", url: "/swap", icon: RepeatIcon, badge: "New" },
  ],
  account: [
    { name: "Profile", description: "Personal details", url: "/profile", icon: UserIcon },
    { name: "Security", description: "2FA and password", url: "/security", icon: Shield01Icon },
    { name: "Verification", description: "KYC Status", url: "/verification", icon: File01Icon },
    { name: "API Management", description: "Keys and access", url: "/api-management", icon: ComputerTerminal01Icon },
    { name: "Referrals", description: "Invite and earn", url: "/referrals", icon: UserGroup02Icon },
  ],
}

function isActiveRoute(pathname: string, url: string) {
  if (url.startsWith("http://") || url.startsWith("https://")) return false
  if (url === "/") return pathname === "/"
  return pathname === url || pathname.startsWith(`${url}/`)
}

export function AppSidebar() {
  const pathname = usePathname()
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"
  
  return (
    <Sidebar collapsible="icon" className="border-r border-border/50">
      <SidebarHeader className="flex flex-col gap-2 pt-4 pb-4">
        <div className="flex items-center justify-between gap-2 px-2">
          <div className="flex items-center gap-2">
            <Image
              src="/worldstreet-logo/WorldStreet1x.png"
              alt="Worldstreet"
              width={96}
              height={24}
              className={cn("h-6 w-auto object-contain", isCollapsed && "h-5")}
              priority
            />
            {!isCollapsed && (
              <span className="font-semibold leading-none">Worldstreet</span>
            )}
          </div>
          <SidebarTrigger className="h-8 w-8 text-muted-foreground hover:bg-accent hover:text-foreground shrink-0" />
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0 py-3">
        {/* OVERVIEW */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2">Overview</SidebarGroupLabel>
          <SidebarMenu className="gap-1">
            {navigation.overview.map((item) => (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton 
                  tooltip={item.description || item.name}
                  isActive={isActiveRoute(pathname, item.url)}
                  render={<Link href={item.url} />}
                  className={cn(
                    "transition-colors text-sm",
                    isCollapsed ? "items-center" : "min-h-9 h-auto py-2 items-center",
                    isActiveRoute(pathname, item.url)
                      ? "bg-accent/80"
                      : "text-foreground/80 hover:text-foreground hover:bg-accent/50"
                  )}
                >
                  <HugeiconsIcon icon={item.icon} className={cn(
                    "size-4.5 shrink-0",
                    "[&_path:not(:first-child)]:stroke-primary"
                  )} />
                  {!isCollapsed && (
                    <span className={cn("truncate text-foreground", isActiveRoute(pathname, item.url) && "text-primary font-semibold")}>
                      {item.name}
                    </span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {isCollapsed && <SidebarSeparator className="mx-3 my-1" />}

        {/* TRADING */}
        <SidebarGroup className="mt-2">
          <SidebarGroupLabel className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2">Trading</SidebarGroupLabel>
          <SidebarMenu className="gap-1">
            {navigation.trading.map((item) => (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton
                  tooltip={item.description || item.name}
                  isActive={isActiveRoute(pathname, item.url)}
                  render={<Link href={item.url} />}
                  className={cn(
                    "text-sm text-foreground/80 hover:text-foreground hover:bg-accent/50 transition-colors",
                    isCollapsed ? "items-center" : "min-h-9 h-auto py-2 items-center",
                    isActiveRoute(pathname, item.url) && "bg-accent/80"
                  )}
                >
                  <HugeiconsIcon icon={item.icon} className={cn(
                    "size-4.5 shrink-0",
                    "[&_path:not(:first-child)]:stroke-primary"
                  )} />
                  {!isCollapsed && (
                    <span className={cn("truncate flex-1 text-foreground", isActiveRoute(pathname, item.url) && "text-primary font-semibold")}>
                      {item.name}
                    </span>
                  )}
                  {!isCollapsed && item.badge && (
                    <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary leading-none">
                      {item.badge}
                    </span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {isCollapsed && <SidebarSeparator className="mx-3 my-1" />}

        {/* ACCOUNT */}
        <SidebarGroup className="mt-2">
          <SidebarGroupLabel className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2">Account</SidebarGroupLabel>
          <SidebarMenu className="gap-1">
            {navigation.account.map((item) => (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton 
                  tooltip={item.description || item.name} 
                  isActive={isActiveRoute(pathname, item.url)}
                  render={<Link href={item.url} />}
                  className={cn(
                    "text-sm text-foreground/80 hover:text-foreground hover:bg-accent/50 transition-colors",
                    isCollapsed ? "items-center" : "min-h-9 h-auto py-2 items-center",
                    isActiveRoute(pathname, item.url) && "bg-accent/80"
                  )}
                >
                  <HugeiconsIcon icon={item.icon} className={cn(
                    "size-4.5 shrink-0",
                    "[&_path:not(:first-child)]:stroke-primary"
                  )} />
                  {!isCollapsed && (
                    <span className={cn("truncate text-foreground", isActiveRoute(pathname, item.url) && "text-primary font-semibold")}>
                      {item.name}
                    </span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}

"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useVividOptional } from "@worldstreet/vivid-voice"
import gsap from "gsap"
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Activity01Icon,
  Exchange01Icon,
  ChartCandlestickIcon,
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
  Copy01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  Store01Icon,
  BarChartIcon,
  GlobeIcon,
  Book01Icon,
  Brain01Icon,
  Video01Icon,
  DollarCircleIcon,
  Rocket01Icon,
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

// ── Navigation data ──────────────────────────────────────────────────────

interface NavItem {
  name: string
  description: string
  url: string
  icon: typeof Activity01Icon
  badge?: string
}

interface NavGroup {
  label: string
  icon: typeof Activity01Icon
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    icon: DashboardSquare01Icon,
    items: [
      { name: "Dashboard", description: "Account snapshot", url: "/", icon: DashboardSquare01Icon },
      { name: "Portfolio", description: "Market activity", url: "/portfolio", icon: ChartCandlestickIcon },
      { name: "Assets", description: "Wallet balances", url: "/assets", icon: Wallet01Icon },
      { name: "Transactions", description: "History and receipts", url: "/transactions", icon: File01Icon },
    ],
  },
  {
    label: "Community",
    icon: UserGroup02Icon,
    items: [
      { name: "Community", description: "Chat & connect", url: "/community", icon: UserGroup02Icon },
    ],
  },
  {
    label: "Trading",
    icon: Activity01Icon,
    items: [
      { name: "Markets", description: "Full market screener", url: "/trading/markets", icon: BarChartIcon },
      { name: "Spot Trading", description: "Multi-chain DEX trading", url: "/spotv2", icon: Exchange01Icon },
      { name: "Futures", description: "Perpetual contracts", url: "/futures", icon: Chart01Icon },
      { name: "Forex", description: "Currency pair trading", url: "/forex", icon: GlobeIcon },
      { name: "Binary", description: "Binary options trading", url: "/binary", icon: Exchange01Icon },
      { name: "Swap", description: "One-tap conversion", url: "/swap", icon: RepeatIcon },
      { name: "Bridge", description: "Cross-chain transfers", url: "/bridge", icon: Link01Icon },
      { name: "Copy Trading", description: "Mirror top traders", url: "/copy-trading", icon: Copy01Icon },
      { name: "P2P Trading", description: "Peer-to-peer exchange", url: "/p2p", icon: Store01Icon },
    ],
  },
  {
    label: "Account",
    icon: UserIcon,
    items: [
      { name: "Profile", description: "Personal details", url: "/profile", icon: UserIcon },
      { name: "Security", description: "2FA and password", url: "/security", icon: Shield01Icon },
      { name: "Verification", description: "KYC Status", url: "/verification", icon: File01Icon },
      { name: "API Management", description: "Keys and access", url: "/api-management", icon: ComputerTerminal01Icon },
      { name: "Referrals", description: "Invite and earn", url: "/referrals", icon: UserGroup02Icon },
    ],
  },
  {
    label: "Worldstreet",
    icon: Rocket01Icon,
    items: [
      { name: "Store", description: "Official merchandise", url: "https://shop.worldstreetgold.com", icon: Store01Icon },
      { name: "Academy", description: "Learn trading & crypto", url: "https://academy.worldstreetgold.com", icon: Book01Icon },
      { name: "Social", description: "Community hub", url: "https://social.worldstreetgold.com", icon: UserGroup02Icon },
      { name: "Xstream", description: "Live streaming", url: "https://xtreme.worldstreetgold.com", icon: Video01Icon },
      { name: "Forex Trading", description: "Currency pairs", url: "https://trader.worldstreetgold.com", icon: DollarCircleIcon },
      { name: "Vivid AI", description: "AI-powered insights", url: "/vivid", icon: Brain01Icon },
    ],
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────

function isActiveRoute(pathname: string, url: string) {
  if (url.startsWith("http://") || url.startsWith("https://")) return false
  if (url === "/") return pathname === "/"
  return pathname === url || pathname.startsWith(`${url}/`)
}

function groupHasActiveRoute(pathname: string, items: NavItem[]) {
  return items.some((item) => isActiveRoute(pathname, item.url))
}

// ── Collapsible Nav Group ────────────────────────────────────────────────

function CollapsibleNavGroup({
  group,
  pathname,
  isCollapsed,
}: {
  group: NavGroup
  pathname: string
  isCollapsed: boolean
}) {
  const hasActive = groupHasActiveRoute(pathname, group.items)
  const [open, setOpen] = React.useState(hasActive)
  const contentRef = React.useRef<HTMLDivElement>(null)

  // auto-expand when a child becomes active
  React.useEffect(() => {
    if (hasActive && !open) setOpen(true)
  }, [hasActive]) // eslint-disable-line react-hooks/exhaustive-deps

  // GSAP expand/collapse animation
  React.useEffect(() => {
    const el = contentRef.current
    if (!el) return
    if (open) {
      gsap.set(el, { display: "block", overflow: "hidden" })
      gsap.fromTo(
        el,
        { height: 0, opacity: 0 },
        { height: "auto", opacity: 1, duration: 0.25, ease: "power2.out" },
      )
      // stagger children
      gsap.fromTo(
        el.children[0]?.children ?? [],
        { x: -6, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.2, stagger: 0.03, ease: "power2.out", delay: 0.05 },
      )
    } else {
      gsap.to(el, {
        height: 0,
        opacity: 0,
        duration: 0.2,
        ease: "power2.in",
        onComplete: () => { gsap.set(el, { display: "none" }) },
      })
    }
  }, [open])

  const isExternal = (url: string) => url.startsWith("http://") || url.startsWith("https://")

  if (isCollapsed) {
    // In collapsed mode show items flat with tooltips
    return (
      <>
        {group.items.map((item) => {
          const ext = isExternal(item.url)
          return (
            <SidebarMenuItem key={item.name}>
              <SidebarMenuButton
                tooltip={item.name}
                isActive={!ext && isActiveRoute(pathname, item.url)}
                render={ext ? <a href={item.url} target="_blank" rel="noopener noreferrer" /> : <Link href={item.url} />}
                className={cn(
                  "transition-colors text-sm items-center",
                  !ext && isActiveRoute(pathname, item.url)
                    ? "bg-accent/80"
                    : "text-foreground/80 hover:text-foreground hover:bg-accent/50",
                )}
              >
                <HugeiconsIcon
                  icon={item.icon}
                  className="size-4.5 shrink-0 [&_path:not(:first-child)]:stroke-primary"
                />
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Group toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-all hover:bg-accent/40 hover:text-foreground",
          hasActive && "text-yellow-400",
        )}
      >
        <HugeiconsIcon
          icon={group.icon}
          className={cn(
            "size-4 shrink-0 [&_path:not(:first-child)]:stroke-primary",
            hasActive && "text-yellow-400",
          )}
        />
        <span className="flex-1 text-left text-[10px]">{group.label}</span>
        <HugeiconsIcon
          icon={open ? ArrowUp01Icon : ArrowDown01Icon}
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground/60 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {/* Sub-items with tree‐line (GSAP animated) */}
      <div ref={contentRef} style={{ display: open ? "block" : "none" }}>
        <div className="relative ml-[15px] mt-px">
          {/* Vertical tree line */}
          <div className="absolute left-0 top-0 bottom-2 w-px bg-border/60" />

          <div className="flex flex-col">
            {group.items.map((item, idx) => {
              const ext = isExternal(item.url)
              const isActive = !ext && isActiveRoute(pathname, item.url)
              const isLast = idx === group.items.length - 1
              return (
                <div key={item.name} className="relative flex items-center">
                  {/* Horizontal branch line */}
                  <div
                    className={cn(
                      "absolute left-0 top-1/2 h-px w-3 bg-border/60",
                      isLast && "after:absolute after:left-0 after:top-0 after:h-[calc(50%+1px)] after:w-px after:bg-card",
                    )}
                  />
                  <SidebarMenuButton
                    tooltip={item.description || item.name}
                    isActive={isActive}
                    render={ext ? <a href={item.url} target="_blank" rel="noopener noreferrer" /> : <Link href={item.url} />}
                    className={cn(
                      "ml-4 min-h-7 py-1 text-sm transition-all data-[active=true]:bg-transparent data-[active=true]:text-yellow-400",
                      isActive
                        ? "text-yellow-400"
                        : "text-foreground/70 hover:text-foreground hover:bg-accent/50",
                    )}
                  >
                    <HugeiconsIcon
                      icon={item.icon}
                      className="size-4 shrink-0 [&_path:not(:first-child)]:stroke-primary"
                    />
                    <span
                      className={cn(
                        "truncate flex-1 text-foreground/80",
                        isActive && "text-yellow-400 font-semibold",
                      )}
                    >
                      {item.name}
                    </span>
                    {ext && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted-foreground/40"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
                    )}
                    {item.badge && (
                      <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary leading-none">
                        {item.badge}
                      </span>
                    )}
                  </SidebarMenuButton>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Sidebar ─────────────────────────────────────────────────────────

export function AppSidebar() {
  const pathname = usePathname()
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"
  const _vivid = useVividOptional()
  const vividState = _vivid?.state ?? "idle"
  const isConnected = _vivid?.isConnected ?? false
  const startSession = _vivid?.startSession ?? (async () => {})
  const endSession = _vivid?.endSession ?? (() => {})
  const vividIsActive = vividState !== "idle" && vividState !== "error"

  const VIVID_DOT: Record<string, string> = {
    idle: "",
    connecting: "bg-yellow-400 animate-pulse",
    ready: "bg-emerald-400",
    listening: "bg-primary animate-pulse",
    processing: "bg-primary animate-pulse",
    speaking: "bg-emerald-400 animate-pulse",
    error: "bg-red-400",
  }

  return (
    <Sidebar collapsible="icon">
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

      <SidebarContent className="gap-0 py-2">
        {NAV_GROUPS.map((group, i) => (
          <React.Fragment key={group.label}>
            {isCollapsed && i > 0 && <SidebarSeparator className="mx-2.5 my-0.5" />}
            <SidebarGroup className={i > 0 ? "mt-0.5" : ""}>
              {isCollapsed && (
                <SidebarGroupLabel className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-0.5">
                  {group.label}
                </SidebarGroupLabel>
              )}
              {group.label === "Worldstreet" ? (
                /* Worldstreet items — flat with taglines, no collapsible wrapper */
                <div className="flex flex-col">
                  {!isCollapsed && (
                    <div className="px-2 py-2">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">Worldstreet</span>
                    </div>
                  )}
                  <SidebarMenu className="gap-1 px-1">
                    {group.items.map((item) => {
                      const isVivid = item.name === "Vivid AI"
                      const ext = item.url.startsWith("http://") || item.url.startsWith("https://")
                      const isActive = !ext && !isVivid && isActiveRoute(pathname, item.url)

                      if (isVivid) {
                        const vividActive = !ext && isActiveRoute(pathname, item.url)
                        return (
                          <SidebarMenuItem key={item.name}>
                            <SidebarMenuButton
                              tooltip={vividIsActive ? `Vivid AI — ${vividState}` : "Vivid AI"}
                              isActive={vividActive}
                              render={<Link href={item.url} />}
                              className={cn(
                                "min-h-10 py-2 px-2.5 text-sm transition-all rounded-md data-[active=true]:bg-transparent data-[active=true]:text-yellow-400",
                                vividActive || vividIsActive
                                  ? "text-yellow-400 bg-yellow-400/5 hover:bg-yellow-400/10"
                                  : "text-foreground/70 hover:text-foreground hover:bg-accent/50",
                              )}
                            >
                              <HugeiconsIcon
                                icon={item.icon}
                                className={cn(
                                  "size-4 shrink-0",
                                  (vividActive || vividIsActive) ? "text-yellow-400" : "[&_path:not(:first-child)]:stroke-primary"
                                )}
                              />
                              {!isCollapsed && (
                                <div className="flex flex-col gap-0.5 overflow-hidden flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className={cn("truncate text-foreground/80", (vividActive || vividIsActive) && "text-yellow-400 font-semibold")}>{item.name}</span>
                                    {vividIsActive && (
                                      <span className={cn("inline-block h-1.5 w-1.5 rounded-full shrink-0", VIVID_DOT[vividState])} />
                                    )}
                                  </div>
                                  <span className="truncate text-[10px] text-muted-foreground/55 leading-tight">
                                    {vividIsActive ? vividState.charAt(0).toUpperCase() + vividState.slice(1) + "…" : item.description}
                                  </span>
                                </div>
                              )}
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        )
                      }

                      return (
                        <SidebarMenuItem key={item.name}>
                          <SidebarMenuButton
                            tooltip={item.name}
                            isActive={isActive}
                            render={ext ? <a href={item.url} target="_blank" rel="noopener noreferrer" /> : <Link href={item.url} />}
                            className={cn(
                              "min-h-10 py-2 px-2.5 text-sm transition-all rounded-md data-[active=true]:bg-transparent data-[active=true]:text-yellow-400",
                              isActive
                                ? "text-yellow-400"
                                : "text-foreground/70 hover:text-foreground hover:bg-accent/50",
                            )}
                          >
                            <HugeiconsIcon
                              icon={item.icon}
                              className="size-4 shrink-0 [&_path:not(:first-child)]:stroke-primary"
                            />
                            {!isCollapsed && (
                              <div className="flex flex-col gap-0.5 overflow-hidden flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className={cn("truncate text-foreground/80", isActive && "text-yellow-400 font-semibold")}>{item.name}</span>
                                </div>
                                <span className="truncate text-[10px] text-muted-foreground/55 leading-tight">{item.description}</span>
                              </div>
                            )}
                            {!isCollapsed && (
                              <div className="ml-auto flex items-center gap-1.5 pl-2">
                                {ext && (
                                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted-foreground/40"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
                                )}
                              </div>
                            )}
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      )
                    })}
                  </SidebarMenu>
                </div>
              ) : (
                <SidebarMenu className="gap-0.5">
                  <CollapsibleNavGroup
                    group={group}
                    pathname={pathname}
                    isCollapsed={isCollapsed}
                  />
                </SidebarMenu>
              )}
            </SidebarGroup>
          </React.Fragment>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}

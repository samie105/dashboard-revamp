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
  RepeatIcon,
  Shield01Icon,
  Chart01Icon,
  UserIcon,
  UserGroup02Icon,
  Wallet01Icon,
  ArrowDown01Icon,
  Store01Icon,
  BarChartIcon,
  Book01Icon,
  Brain01Icon,
  Video01Icon,
  DollarCircleIcon,
  Rocket01Icon,
  EyeIcon,
  LinkSquare02Icon,
} from "@hugeicons/core-free-icons"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
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
      { name: "Spot Trading", description: "Multi-chain DEX trading", url: "/trade", icon: Exchange01Icon },
      { name: "Futures", description: "Perpetual contracts", url: "/trade?market=futures", icon: Chart01Icon },
      { name: "Swap", description: "One-tap conversion", url: "/swap", icon: RepeatIcon },
    ],
  },
  {
    label: "Account",
    icon: UserIcon,
    items: [
      { name: "Profile", description: "Personal details", url: "/profile", icon: UserIcon },
      { name: "Security", description: "2FA and password", url: "/security", icon: Shield01Icon },
      { name: "Verification", description: "KYC Status", url: "https://www.worldstreetgold.com/verification", icon: File01Icon },
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
      { name: "Forex Trading", description: "Currency pairs", url: "https://portal.worldstreetgold.com", icon: DollarCircleIcon },
      { name: "Vivid AI", description: "AI-powered insights", url: "/vivid", icon: Brain01Icon },
      { name: "Vision", description: "Vision broadcast", url: "https://vision.worldstreetgold.com", icon: EyeIcon },
    ],
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────

function isExternal(url: string) {
  return url.startsWith("http://") || url.startsWith("https://")
}

function isActiveRoute(pathname: string, url: string) {
  if (isExternal(url)) return false
  if (url === "/") return pathname === "/"
  return pathname === url || pathname.startsWith(`${url}/`)
}

function groupHasActiveRoute(pathname: string, items: NavItem[]) {
  return items.some((item) => isActiveRoute(pathname, item.url))
}

/**
 * One row height, one icon size, one gap — every nav row in the rail shares
 * these so the left edge reads as a single column instead of five.
 */
const ROW = "h-9 gap-3 rounded-xl px-2.5 text-[13.5px] [&_svg]:size-[18px]"

// ── Section eyebrow ──────────────────────────────────────────────────────

function SectionLabel({
  children,
  active,
  open,
  onToggle,
}: {
  children: React.ReactNode
  active?: boolean
  open: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors",
        active ? "text-primary" : "text-muted-foreground/70 hover:text-foreground",
      )}
    >
      <span className="flex-1 text-left">{children}</span>
      <HugeiconsIcon
        icon={ArrowDown01Icon}
        className={cn(
          "size-3.5 shrink-0 text-muted-foreground/40 transition-transform duration-200",
          open && "rotate-180",
        )}
      />
    </button>
  )
}

// ── Nav row ──────────────────────────────────────────────────────────────

function NavRow({
  item,
  isActive,
  collapsed,
  /** Products rail rows are a footnote: no icon chip, dimmer by default. */
  muted,
  trailing,
}: {
  item: NavItem
  isActive: boolean
  collapsed: boolean
  muted?: boolean
  trailing?: React.ReactNode
}) {
  const ext = isExternal(item.url)

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={collapsed ? item.name : item.description || item.name}
        isActive={isActive}
        render={
          ext ? (
            <a href={item.url} target="_blank" rel="noopener noreferrer" />
          ) : (
            <Link href={item.url} />
          )
        }
        className={cn(
          ROW,
          "relative transition-colors duration-150 data-[active=true]:bg-transparent",
          collapsed && "justify-center px-0",
          isActive
            ? "bg-foreground/[0.06] font-medium text-foreground shadow-[inset_0_1px_0_0_var(--color-border)]"
            : muted
              ? "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
              : "text-foreground/75 hover:bg-foreground/[0.04] hover:text-foreground",
        )}
      >
        {muted ? (
          <HugeiconsIcon
            icon={item.icon}
            className={cn("shrink-0", isActive ? "text-primary" : "text-muted-foreground/80")}
          />
        ) : (
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-[9px] transition-colors",
              isActive ? "bg-primary/[0.18]" : "bg-foreground/[0.05]",
            )}
          >
            <HugeiconsIcon
              icon={item.icon}
              className={cn("shrink-0", isActive ? "text-primary" : "text-muted-foreground")}
            />
          </span>
        )}

        {!collapsed && (
          <>
            <span className="flex-1 truncate">{item.name}</span>
            {trailing}
            {ext && (
              <HugeiconsIcon
                icon={LinkSquare02Icon}
                className="shrink-0 text-muted-foreground/35 [&_svg]:size-3"
              />
            )}
            {item.badge && (
              <span className="rounded-md bg-primary/12 px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary">
                {item.badge}
              </span>
            )}
          </>
        )}

        {/* Active marker — a gold tick on the rail's edge, the one place gold
            carries "you are here". */}
        {isActive && !collapsed && (
          <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

// ── Collapsible Nav Group ────────────────────────────────────────────────

function CollapsibleNavGroup({
  group,
  pathname,
  isCollapsed,
  muted,
  itemActive,
  itemTrailing,
}: {
  group: NavGroup
  pathname: string
  isCollapsed: boolean
  /** Footnote rows (the products rail): bare icon, dimmer resting state. */
  muted?: boolean
  /** Overrides "is this row lit" for rows with their own liveness (Vivid). */
  itemActive?: (item: NavItem) => boolean
  itemTrailing?: (item: NavItem) => React.ReactNode
}) {
  const isRowActive = (item: NavItem) =>
    itemActive ? itemActive(item) : isActiveRoute(pathname, item.url)
  const hasActive = group.items.some(isRowActive)
  // Open by default — a rail of collapsed labels reads as dead space, and
  // every section here is short enough to live on screen at once.
  const [open, setOpen] = React.useState(true)
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
        onComplete: () => {
          gsap.set(el, { display: "none" })
        },
      })
    }
  }, [open])

  if (isCollapsed) {
    return (
      <>
        {group.items.map((item) => (
          <NavRow
            key={item.name}
            item={item}
            isActive={isRowActive(item)}
            collapsed
            muted={muted}
            trailing={itemTrailing?.(item)}
          />
        ))}
      </>
    )
  }

  return (
    <div className="flex flex-col">
      <SectionLabel active={hasActive} open={open} onToggle={() => setOpen((v) => !v)}>
        {group.label}
      </SectionLabel>

      <div ref={contentRef} style={{ display: open ? "block" : "none" }}>
        <SidebarMenu className="gap-0.5">
          {group.items.map((item) => (
            <NavRow
              key={item.name}
              item={item}
              isActive={isRowActive(item)}
              collapsed={false}
              muted={muted}
              trailing={itemTrailing?.(item)}
            />
          ))}
        </SidebarMenu>
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

  const productGroup = NAV_GROUPS[NAV_GROUPS.length - 1]
  const navGroups = NAV_GROUPS.slice(0, -1)

  return (
    <Sidebar
      variant="floating"
      collapsible="icon"
      /* The rail floats: translucent stone over the page, one 22px corner,
         hairline ring instead of a hard border. The gradient wash below is
         atmosphere only — it never sits behind text. */
      className="py-4 pl-4 pr-1 [&_[data-slot=sidebar-inner]]:relative [&_[data-slot=sidebar-inner]]:overflow-hidden [&_[data-slot=sidebar-inner]]:rounded-[22px] [&_[data-slot=sidebar-inner]]:border [&_[data-slot=sidebar-inner]]:border-border/60 [&_[data-slot=sidebar-inner]]:bg-sidebar/72 dark:[&_[data-slot=sidebar-inner]]:bg-sidebar/40 [&_[data-slot=sidebar-inner]]:shadow-[0_8px_32px_-12px_rgb(0_0_0/0.28)] [&_[data-slot=sidebar-inner]]:ring-0 [&_[data-slot=sidebar-inner]]:backdrop-blur-2xl [&_[data-slot=sidebar-inner]]:backdrop-saturate-150"
    >
      {/* Ambient wash — warm gold bloom at the crown falling into the stone,
          the desktop-only gradient. Behind everything, never interactive. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(125%_78%_at_8%_0%,var(--sidebar-glow)_0%,transparent_68%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-transparent to-background/45"
      />

      {/* Header — the ecosystem lockup, identical to Academy's: gold W mark
          26px + "WorldStreet" Poppins SemiBold 15 + gold app eyebrow. */}
      <SidebarHeader className="gap-0 px-2.5 pb-3 pt-4">
        <div className={cn("flex items-center gap-2.5", isCollapsed && "justify-center")}>
          <Link
            href="/"
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2.5 rounded-xl outline-none transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring",
              isCollapsed && "flex-none justify-center",
            )}
          >
            <Image
              src="/worldstreet-logo/WorldStreet1.png"
              alt="Worldstreet"
              width={26}
              height={26}
              className="h-[26px] w-[26px] shrink-0 object-contain"
              priority
            />
            {!isCollapsed && (
              <span className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate font-display text-[15px] font-semibold tracking-[-0.01em]">
                  WorldStreet
                </span>
                <span className="truncate font-sans text-[10px] font-semibold uppercase tracking-[2px] text-primary">
                  Dashboard
                </span>
              </span>
            )}
          </Link>
          {!isCollapsed && (
            <SidebarTrigger className="size-7 shrink-0 rounded-lg text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground" />
          )}
        </div>
        {isCollapsed && (
          <SidebarTrigger className="mx-auto mt-2 size-7 shrink-0 rounded-lg text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground" />
        )}
      </SidebarHeader>

      <SidebarContent className="gap-0 px-2.5 pb-4 pt-1">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label} className="px-0 py-2">
            <CollapsibleNavGroup group={group} pathname={pathname} isCollapsed={isCollapsed} />
          </SidebarGroup>
        ))}

        {/* Products rail — the rest of the ecosystem, one compact row each.
            Collapsible like every other section: it's the longest group and
            the least-used, so it's the one people most want to fold away. */}
        <SidebarGroup className="px-0 py-2">
          <CollapsibleNavGroup
            group={productGroup}
            pathname={pathname}
            isCollapsed={isCollapsed}
            muted
            itemActive={(item) =>
              isActiveRoute(pathname, item.url) || (item.name === "Vivid AI" && vividIsActive)
            }
            itemTrailing={(item) =>
              item.name === "Vivid AI" && vividIsActive ? (
                <span
                  className={cn("inline-block size-1.5 shrink-0 rounded-full", VIVID_DOT[vividState])}
                />
              ) : undefined
            }
          />
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}

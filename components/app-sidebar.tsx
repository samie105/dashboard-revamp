"use client"

/**
 * The rail.
 *
 * This is the treatment previewed at /dashboard-unauth, folded back into the
 * real sidebar as that preview's header always said it should be. What changed
 * from the old rail:
 *
 *  · NO icon chip per row. Every glyph used to sit on a rounded-square fill,
 *    which at twenty-odd rows read as twenty buttons stacked in a column. Bare
 *    glyphs let the LABELS carry the list.
 *  · The active row is TINTED, not grey. A neutral fill says "hovered"; gold
 *    fading out to the right says "you are here" — and gold meaning active
 *    state is exactly what the system reserves it for.
 *  · Section eyebrows are plain text, not collapse toggles. The rail is short
 *    enough not to need folding, and the chevrons added an affordance per
 *    group that nobody was asking for.
 *  · Ecosystem links sit below a rule as a quieter footnote rather than as a
 *    group of equal weight to Overview.
 *  · Venues that do not exist yet LIST but do not link — dimmed, not
 *    pressable, marked "Soon". Listing them as live links would send someone
 *    to a 404; leaving them out would hide a roadmap people already look for.
 *
 * Kept from the old rail because they are app behaviour, not styling: the
 * spot-registry prefetch on Trade hover, the Vivid AI live dot, and
 * <SidebarRail> for the drag-to-collapse edge.
 */

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useVividOptional } from "@worldstreet/vivid-voice"
import { cn } from "@/lib/utils"
import { prefetchSpotMarkets } from "@/lib/spot-markets"
import { useAuth } from "@/components/auth-provider"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Activity01Icon,
  Award01Icon,
  BalanceScaleIcon,
  BarChartIcon,
  Book01Icon,
  BotIcon,
  Brain01Icon,
  Chart01Icon,
  ChartCandlestickIcon,
  ChartUpIcon,
  Coins01Icon,
  DashboardSquare01Icon,
  DollarCircleIcon,
  Exchange01Icon,
  EyeIcon,
  File01Icon,
  GameController01Icon,
  GiftIcon,
  HelpCircleIcon,
  LinkSquare02Icon,
  Notification03Icon,
  PieChartIcon,
  RepeatIcon,
  Rocket01Icon,
  Settings02Icon,
  Shield01Icon,
  Store01Icon,
  Timer01Icon,
  UserGroup02Icon,
  UserIcon,
  UserMultipleIcon,
  Video01Icon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"

// ── Navigation data ──────────────────────────────────────────────────────

interface NavItem {
  name: string
  url: string
  icon: typeof Activity01Icon
  badge?: string
  /** The destination is not open yet: the row stays listed and readable but
   *  is not a link, because a nav item that navigates to a dead venue is
   *  worse than one that plainly says "not yet". */
  soon?: boolean
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { name: "Dashboard", url: "/", icon: DashboardSquare01Icon },
      // Points at /wallet/modern, not /wallet: on the production branch
      // /wallet is still the legacy wallet, and this row means the new one.
      { name: "Wallet", url: "/wallet/modern", icon: Wallet01Icon },
      // Assets merged into Portfolio: the two rows led to the same money in
      // two shapes, so there is one row and one page. `/assets` redirects.
      { name: "Portfolio", url: "/portfolio", icon: ChartCandlestickIcon },
      { name: "Transactions", url: "/transactions", icon: File01Icon },
    ],
  },
  {
    label: "Trading",
    items: [
      { name: "Markets", url: "/trading/markets", icon: BarChartIcon },
      { name: "Spot Trading", url: "/trade", icon: Exchange01Icon },
      { name: "Futures", url: "/trade?market=futures", icon: Chart01Icon, badge: "Live" },
      { name: "Margin Trading", url: "#", icon: BalanceScaleIcon, soon: true },
      { name: "Binary Trading", url: "#", icon: Timer01Icon, soon: true },
      { name: "Swap", url: "/swap", icon: RepeatIcon },
      { name: "Bridge", url: "/bridge", icon: Activity01Icon },
    ],
  },
  {
    label: "Automate",
    items: [
      { name: "Copy Trading", url: "#", icon: UserMultipleIcon, soon: true },
      { name: "Trading Bots", url: "#", icon: BotIcon, soon: true },
    ],
  },
  {
    label: "Earn",
    items: [
      { name: "Staking", url: "#", icon: Coins01Icon, soon: true },
      { name: "Launchpad", url: "/launchpad", icon: Rocket01Icon },
      { name: "Investments", url: "#", icon: PieChartIcon, soon: true },
      { name: "Airdrops", url: "#", icon: GiftIcon, soon: true },
      { name: "Rewards", url: "#", icon: Award01Icon, soon: true },
    ],
  },
  {
    label: "Account",
    items: [
      { name: "Profile", url: "/profile", icon: UserIcon },
      { name: "Security", url: "/security", icon: Shield01Icon },
      { name: "Verification", url: "https://www.worldstreetgold.com/verification", icon: File01Icon },
    ],
  },
]

/** The ecosystem rail — other Worldstreet properties. A footnote, not a peer
 *  of the groups above, so it renders below a rule and one step dimmer. */
const ECOSYSTEM: NavItem[] = [
  { name: "Store", url: "https://shop.worldstreetgold.com", icon: Store01Icon },
  { name: "Academy", url: "https://academy.worldstreetgold.com", icon: Book01Icon },
  { name: "Social", url: "https://social.worldstreetgold.com", icon: UserGroup02Icon },
  { name: "Xstream", url: "https://xtreme.worldstreetgold.com", icon: Video01Icon },
  { name: "Forex Trading", url: "https://portal.worldstreetgold.com", icon: DollarCircleIcon },
  { name: "Vivid AI", url: "/vivid", icon: Brain01Icon },
  { name: "Vision", url: "https://vision.worldstreetgold.com", icon: EyeIcon },
  { name: "Arcade", url: "https://arcade.worldstreetgold.com", icon: GameController01Icon },
  { name: "Prediction", url: "https://prediction.worldstreetgold.com", icon: ChartUpIcon },
]

/** The tray above the user card. None of these have a screen yet, so all three
 *  list as "Soon" rather than as links to nowhere. */
const UTILITY: NavItem[] = [
  { name: "Settings", url: "#", icon: Settings02Icon, soon: true },
  { name: "Support", url: "#", icon: HelpCircleIcon, soon: true },
  { name: "Notifications", url: "#", icon: Notification03Icon, soon: true },
]

// ── Helpers ──────────────────────────────────────────────────────────────

function isExternal(url: string) {
  return url.startsWith("http://") || url.startsWith("https://")
}

function isActiveRoute(pathname: string, url: string) {
  if (isExternal(url) || url === "#") return false
  if (url === "/") return pathname === "/"
  // Query-string rows (Futures) point at a page another row already owns, so
  // matching on the path alone would light both. Compare the path only, and
  // let the row without a query win.
  const [path, query] = url.split("?")
  if (query) return false
  return pathname === path || pathname.startsWith(`${path}/`)
}

/* The active fill: gold at the left edge, gone by 78%. A flat tint reads as a
   pressed button; a fade reads as light falling from the marker. */
const ACTIVE_FILL =
  "bg-[linear-gradient(90deg,color-mix(in_oklab,var(--primary)_17%,transparent)_0%,color-mix(in_oklab,var(--primary)_6%,transparent)_45%,transparent_78%)]"

function NavRow({
  item,
  active,
  collapsed,
  /** Ecosystem rows are a footnote: dimmer by default. */
  muted,
  trailing,
}: {
  item: NavItem
  active: boolean
  collapsed: boolean
  muted?: boolean
  trailing?: React.ReactNode
}) {
  const ext = isExternal(item.url)

  const inner = (
    <>
      {/* The marker. It is the only gold SHAPE in the rail, which is what lets
          a glance find the current row without reading a single label. */}
      {active && !collapsed && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
        />
      )}
      <HugeiconsIcon
        icon={item.icon}
        className={cn(
          "size-[18px] shrink-0",
          item.soon
            ? "text-muted-foreground/35"
            : active
              ? "text-primary"
              : muted
                ? "text-muted-foreground/70"
                : "text-muted-foreground",
        )}
      />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.name}</span>
          {trailing}
          {ext && (
            <HugeiconsIcon icon={LinkSquare02Icon} className="size-3 shrink-0 text-muted-foreground/35" />
          )}
          {item.soon && (
            /* Neutral, never gold. Gold means brand, primary action and
               ACTIVE state; a row that cannot be reached is the opposite of
               all three, and a gold "Soon" chip is the single fastest way to
               make an unbuilt feature look like the one to click. */
            <span className="shrink-0 rounded-md bg-foreground/[0.07] px-1.5 py-px text-[10px] font-bold uppercase leading-[1.4] tracking-[0.04em] text-muted-foreground/70">
              Soon
            </span>
          )}
          {item.badge && !item.soon && (
            /* Outlined, not filled: a status marker sits beside the label, it
               does not compete with the active row's own gold. */
            <span className="shrink-0 rounded-md border border-primary/40 px-1.5 py-px text-[10px] font-bold uppercase leading-[1.4] tracking-[0.04em] text-primary">
              {item.badge}
            </span>
          )}
        </>
      )}
    </>
  )

  const cls = cn(
    // ws-icon-mono: these glyphs are single-colour by design (their tone IS
    // the state), so they opt out of the global two-tone gold treatment.
    "ws-icon-mono relative flex h-9 w-full items-center gap-3 rounded-xl px-2.5 text-[13.5px] transition-colors duration-150",
    collapsed && "justify-center px-0",
    item.soon
      // Legible enough to read as a real destination, plainly not pressable.
      // No hover fill, no pointer — the row must not pretend to respond.
      ? "cursor-not-allowed text-muted-foreground/45"
      : active
        ? cn(ACTIVE_FILL, "font-medium text-foreground")
        : muted
          ? "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
          : "text-foreground/75 hover:bg-foreground/[0.04] hover:text-foreground",
  )

  if (item.soon) {
    return (
      <SidebarMenuItem>
        <span aria-disabled="true" title={`${item.name} — coming soon`} className={cls}>
          {inner}
        </span>
      </SidebarMenuItem>
    )
  }

  return (
    <SidebarMenuItem
      // The cursor arriving on Trade is the earliest reliable sign the spot
      // registry is about to be needed; warming it here is the difference
      // between the market rail opening full and opening as skeletons.
      onPointerEnter={item.url === "/trade" ? prefetchSpotMarkets : undefined}
    >
      {ext ? (
        <a href={item.url} target="_blank" rel="noopener noreferrer" title={item.name} className={cls}>
          {inner}
        </a>
      ) : (
        <Link href={item.url} title={item.name} aria-current={active ? "page" : undefined} className={cls}>
          {inner}
        </Link>
      )}
    </SidebarMenuItem>
  )
}

function Eyebrow({ children, collapsed }: { children: React.ReactNode; collapsed: boolean }) {
  if (collapsed) {
    // Collapsed, a label would be a truncated smudge. A rule keeps the
    // grouping without pretending to be readable.
    return <span aria-hidden className="mx-auto my-2 block h-px w-5 bg-border/60" />
  }
  return (
    <span className="block px-2.5 pb-1.5 pt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60">
      {children}
    </span>
  )
}

export function AppSidebar() {
  const pathname = usePathname()
  const { state } = useSidebar()
  const collapsed = state === "collapsed"
  const { user } = useAuth()

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

  const displayName = user
    ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Trader"
    : "Trader"
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <Sidebar
      variant="floating"
      collapsible="icon"
      /* The rail floats: translucent stone over the page, one 22px corner,
         hairline ring instead of a hard border. The gradient wash below is
         atmosphere only — it never sits behind text. */
      className="py-4 pl-4 pr-1 [&_[data-slot=sidebar-inner]]:relative [&_[data-slot=sidebar-inner]]:overflow-hidden [&_[data-slot=sidebar-inner]]:rounded-[22px] [&_[data-slot=sidebar-inner]]:border [&_[data-slot=sidebar-inner]]:border-border/60 [&_[data-slot=sidebar-inner]]:bg-sidebar/58 dark:[&_[data-slot=sidebar-inner]]:bg-sidebar/28 [&_[data-slot=sidebar-inner]]:shadow-[0_8px_32px_-12px_rgb(0_0_0/0.28)] [&_[data-slot=sidebar-inner]]:ring-0 [&_[data-slot=sidebar-inner]]:backdrop-blur-2xl [&_[data-slot=sidebar-inner]]:backdrop-saturate-150"
    >
      {/* Ambient wash — warm gold bloom at the crown falling into the stone.
          Behind everything, never interactive. */}
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
      <SidebarHeader className="gap-0 px-2.5 pb-2 pt-4">
        <div className={cn("flex items-center gap-2.5", collapsed && "justify-center")}>
          <Link
            href="/"
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2.5 rounded-xl outline-none transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring",
              collapsed && "flex-none justify-center",
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
            {!collapsed && (
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
          {!collapsed && (
            <SidebarTrigger className="size-7 shrink-0 rounded-lg text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground" />
          )}
        </div>
        {collapsed && (
          <SidebarTrigger className="mx-auto mt-2 size-7 shrink-0 rounded-lg text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground" />
        )}
      </SidebarHeader>

      <SidebarContent className="slim-scroll gap-0 px-2.5 pb-4">
        {NAV_GROUPS.map((group) => (
          <React.Fragment key={group.label}>
            <Eyebrow collapsed={collapsed}>{group.label}</Eyebrow>
            <SidebarMenu className="gap-0.5">
              {group.items.map((item) => (
                <NavRow
                  key={item.name}
                  item={item}
                  active={isActiveRoute(pathname, item.url)}
                  collapsed={collapsed}
                />
              ))}
            </SidebarMenu>
          </React.Fragment>
        ))}

        {/* Everything below this rule leaves this app, so it looks like it
            does. */}
        <span aria-hidden className="mx-2.5 my-3 block h-px bg-border/50" />

        <SidebarMenu className="gap-0.5">
          {ECOSYSTEM.map((item) => (
            <NavRow
              key={item.name}
              item={item}
              active={
                isActiveRoute(pathname, item.url) || (item.name === "Vivid AI" && vividIsActive)
              }
              collapsed={collapsed}
              muted
              trailing={
                item.name === "Vivid AI" && vividIsActive ? (
                  <span className={cn("inline-block size-1.5 shrink-0 rounded-full", VIVID_DOT[vividState])} />
                ) : undefined
              }
            />
          ))}
        </SidebarMenu>

        <span aria-hidden className="mx-2.5 my-3 block h-px bg-border/50" />

        <SidebarMenu className="gap-0.5">
          {UTILITY.map((item) => (
            <NavRow key={item.name} item={item} active={false} collapsed={collapsed} />
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="bg-sidebar/80 px-2.5 pb-4 pt-0 backdrop-blur-xl">
        <span aria-hidden className="mb-2 block h-px bg-border/50" />
        <Link
          href="/profile"
          className={cn(
            "flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-foreground/[0.04]",
            collapsed && "justify-center px-0",
          )}
        >
          <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/[0.15] text-[13px] font-semibold text-primary">
            {user?.imageUrl ? (
              <Image
                src={user.imageUrl}
                alt=""
                width={32}
                height={32}
                className="size-8 object-cover"
                unoptimized
              />
            ) : (
              initial
            )}
          </span>
          {!collapsed && (
            <span className="grid min-w-0 flex-1 text-left leading-tight">
              <span className="truncate text-[13px] font-medium">{displayName}</span>
              <span className="truncate text-[11px] text-muted-foreground">
                {user?.email || "Your account"}
              </span>
            </span>
          )}
        </Link>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

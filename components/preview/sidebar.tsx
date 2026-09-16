"use client"

/**
 * PreviewSidebar — the rail for the design-preview routes (/dashboard-unauth,
 * /wallet-unauth).
 *
 * It is a SEPARATE component from <AppSidebar> on purpose: this is a design
 * preview, and the live app's rail must not change underneath people who are
 * using it. LayoutShell swaps the two by pathname. If this treatment is
 * adopted, the move is to fold it back INTO app-sidebar.tsx and delete this
 * file — not to keep two rails in step by hand.
 *
 * Same navigation, same routes, same tokens as the real rail. What changes is
 * the row treatment:
 *
 *  · NO icon chip per row. The live rail puts a rounded-square fill behind
 *    every glyph, which at fifteen rows reads as fifteen buttons stacked in a
 *    column. Bare glyphs let the LABELS carry the list.
 *  · The active row is TINTED, not grey. A neutral fill says "hovered"; gold
 *    fading out to the right says "you are here" — and gold meaning active
 *    state is exactly what the system reserves it for.
 *  · Section eyebrows are plain text, not collapse toggles. A rail this short
 *    does not need to fold, and the chevrons added fifteen affordances that
 *    nobody was asking for.
 *  · Ecosystem links sit below a rule as a quieter footnote, rather than as a
 *    fourth group of equal weight.
 */

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import Image from "next/image"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Activity01Icon,
  Award01Icon,
  BalanceScaleIcon,
  BarChartIcon,
  BotIcon,
  Coins01Icon,
  Book01Icon,
  Brain01Icon,
  ChartCandlestickIcon,
  Chart01Icon,
  DollarCircleIcon,
  Exchange01Icon,
  EyeIcon,
  File01Icon,
  GameController01Icon,
  GiftIcon,
  HelpCircleIcon,
  Notification03Icon,
  PieChartIcon,
  Rocket01Icon,
  Settings02Icon,
  Timer01Icon,
  UserMultipleIcon,
  ChartUpIcon,
  LinkSquare02Icon,
  RepeatIcon,
  Shield01Icon,
  Store01Icon,
  UserIcon,
  UserGroup02Icon,
  Video01Icon,
  Wallet01Icon,
  DashboardSquare01Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { PREVIEW_ROUTES } from "@/components/preview/routes"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"

export { PREVIEW_ROUTES }

type Item = {
  name: string
  url: string
  icon: typeof Activity01Icon
  badge?: string
  external?: boolean
  /**
   * The venue does not exist yet. The row still LISTS — people have already
   * seen these on other exchanges and look for them — but it is not a link
   * and it does not pretend to be one: dimmed, not pressable, and carrying a
   * "Soon" marker that says why. Listing it as a live link would send someone
   * to a 404; leaving it out would hide a roadmap.
   */
  soon?: boolean
}

type Group = { label: string; items: Item[] }

const GROUPS: Group[] = [
  {
    label: "Overview",
    items: [
      { name: "Dashboard", url: PREVIEW_ROUTES.dashboard, icon: DashboardSquare01Icon },
      { name: "Wallet", url: PREVIEW_ROUTES.wallet, icon: Wallet01Icon },
      { name: "Portfolio", url: "/portfolio", icon: ChartCandlestickIcon },
      { name: "Transactions", url: PREVIEW_ROUTES.transactions, icon: File01Icon },
    ],
  },
  {
    label: "Trade",
    items: [
      { name: "Markets", url: PREVIEW_ROUTES.markets, icon: BarChartIcon },
      { name: "Spot Trading", url: PREVIEW_ROUTES.trade, icon: Exchange01Icon },
      { name: "Futures", url: "/trade?market=futures", icon: Chart01Icon, badge: "Live" },
      { name: "Margin Trading", url: "#", icon: BalanceScaleIcon, soon: true },
      { name: "Binary Trading", url: "#", icon: Timer01Icon, soon: true },
      { name: "Swap", url: PREVIEW_ROUTES.swap, icon: RepeatIcon },
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
      { name: "Launchpad", url: "#", icon: Rocket01Icon, soon: true },
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
      { name: "Verification", url: "https://www.worldstreetgold.com/verification", icon: File01Icon, external: true },
    ],
  },
]

/** The tray above the user card — the reference's Settings/Support/Notifications
 *  block. None of these have a screen yet, so all three list as "Soon". */
const UTILITY: Item[] = [
  { name: "Settings", url: "#", icon: Settings02Icon, soon: true },
  { name: "Support", url: "#", icon: HelpCircleIcon, soon: true },
  { name: "Notifications", url: "#", icon: Notification03Icon, soon: true },
]

/** The ecosystem rail — other Worldstreet properties. A footnote, not a peer
 *  of the groups above, so it renders below a rule and one step dimmer. */
const ECOSYSTEM: Item[] = [
  { name: "Store", url: "https://shop.worldstreetgold.com", icon: Store01Icon, external: true },
  { name: "Academy", url: "https://academy.worldstreetgold.com", icon: Book01Icon, external: true },
  { name: "Social", url: "https://social.worldstreetgold.com", icon: UserGroup02Icon, external: true },
  { name: "Xstream", url: "https://xtreme.worldstreetgold.com", icon: Video01Icon, external: true },
  { name: "Forex", url: "https://portal.worldstreetgold.com", icon: DollarCircleIcon, external: true },
  { name: "Vivid AI", url: "/vivid", icon: Brain01Icon },
  { name: "Vision", url: "https://vision.worldstreetgold.com", icon: EyeIcon, external: true },
  { name: "Arcade", url: "https://arcade.worldstreetgold.com", icon: GameController01Icon, external: true },
  { name: "Prediction", url: "https://prediction.worldstreetgold.com", icon: ChartUpIcon, external: true },
]

/* The active fill: gold at the left edge, gone by 70%. A flat tint reads as a
   pressed button; a fade reads as light falling from the marker. */
const ACTIVE_FILL =
  "bg-[linear-gradient(90deg,color-mix(in_oklab,var(--primary)_17%,transparent)_0%,color-mix(in_oklab,var(--primary)_6%,transparent)_45%,transparent_78%)]"

function NavRow({
  item,
  active,
  collapsed,
  muted,
}: {
  item: Item
  active: boolean
  collapsed: boolean
  muted?: boolean
}) {
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
          {item.external && (
            <HugeiconsIcon
              icon={LinkSquare02Icon}
              className="size-3 shrink-0 text-muted-foreground/35"
            />
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
    <SidebarMenuItem>
      {item.external ? (
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

export function PreviewSidebar() {
  const { state } = useSidebar()
  const pathname = usePathname()
  const collapsed = state === "collapsed"

  return (
    <Sidebar
      variant="floating"
      collapsible="icon"
      /* Identical pane to the live rail — floating translucent stone, one 22px
         corner, hairline ring. Only the CONTENTS are being previewed. */
      className="py-4 pl-4 pr-1 [&_[data-slot=sidebar-inner]]:relative [&_[data-slot=sidebar-inner]]:overflow-hidden [&_[data-slot=sidebar-inner]]:rounded-[22px] [&_[data-slot=sidebar-inner]]:border [&_[data-slot=sidebar-inner]]:border-border/60 [&_[data-slot=sidebar-inner]]:bg-sidebar/58 dark:[&_[data-slot=sidebar-inner]]:bg-sidebar/28 [&_[data-slot=sidebar-inner]]:shadow-[0_8px_32px_-12px_rgb(0_0_0/0.28)] [&_[data-slot=sidebar-inner]]:ring-0 [&_[data-slot=sidebar-inner]]:backdrop-blur-2xl [&_[data-slot=sidebar-inner]]:backdrop-saturate-150"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(125%_78%_at_8%_0%,var(--sidebar-glow)_0%,transparent_68%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-transparent to-background/45"
      />

      <SidebarHeader className="gap-0 px-2.5 pb-2 pt-4">
        <div className={cn("flex items-center gap-2.5", collapsed && "justify-center")}>
          <Link
            href={PREVIEW_ROUTES.dashboard}
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
        {GROUPS.map((group) => (
          <React.Fragment key={group.label}>
            <Eyebrow collapsed={collapsed}>{group.label}</Eyebrow>
            <SidebarMenu className="gap-0.5">
              {group.items.map((item) => (
                <NavRow
                  key={item.name}
                  item={item}
                  active={item.url === pathname}
                  collapsed={collapsed}
                />
              ))}
            </SidebarMenu>
          </React.Fragment>
        ))}

        {/* The rule the live rail is missing: everything below it leaves this
            app, so it should look like it does. */}
        <span aria-hidden className="mx-2.5 my-3 block h-px bg-border/50" />

        <SidebarMenu className="gap-0.5">
          {ECOSYSTEM.map((item) => (
            <NavRow key={item.name} item={item} active={false} collapsed={collapsed} muted />
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
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-foreground/[0.04]",
            collapsed && "justify-center px-0",
          )}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/[0.15] text-[13px] font-semibold text-primary">
            R
          </span>
          {!collapsed && (
            <span className="grid min-w-0 flex-1 text-left leading-tight">
              <span className="truncate text-[13px] font-medium">Raphael Tomiwa Jesse</span>
              <span className="truncate text-[11px] text-muted-foreground">Demo account</span>
            </span>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

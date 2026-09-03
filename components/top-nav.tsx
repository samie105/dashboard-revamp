"use client"

import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Activity01Icon,
  Exchange01Icon,
  ChartLineData02Icon,
  RepeatIcon,
  Link01Icon,
  Copy01Icon,
  BarChartIcon,
} from "@hugeicons/core-free-icons"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"

type MegaMenuItem = {
  name: string
  description: string
  href: string
  icon: typeof Activity01Icon
  tag?: string
  /** Listed, but not open yet — rendered as a plain row, not a link. */
  soon?: boolean
}

type NavItem = {
  label: string
  href?: string
  mega?: {
    columns: number
    items: MegaMenuItem[]
  }
}

const navItems: NavItem[] = [
  {
    label: "Trading",
    mega: {
      columns: 2,
      items: [
        {
          name: "Markets",
          description: "Full market screener",
          href: "/trading/markets",
          icon: BarChartIcon,
        },
        {
          name: "Spot Trading",
          description: "Multi-chain DEX trading",
          href: "/trade",
          icon: Exchange01Icon,
        },
        {
          name: "Futures",
          description: "Perpetual contracts",
          href: "/trade?market=futures",
          icon: ChartLineData02Icon,
          tag: "Live",
        },
        {
          name: "Swap",
          description: "One-tap conversion",
          href: "/swap",
          icon: RepeatIcon,
        },
        {
          name: "Buy USDT",
          description: "Buy with your dollars",
          href: "/buy",
          icon: Link01Icon,
        },
        {
          name: "Auto Trading",
          description: "Let the agent trade for you",
          href: "/auto-trade",
          icon: Copy01Icon,
        },
      ],
    },
  },
]

export function TopNav() {
  return (
    <div className="hidden md:flex items-center shrink-0">
      <NavigationMenu>
        <NavigationMenuList>
          {navItems.map((item) => (
            <NavigationMenuItem key={item.label}>
              {/* Glass-pill grammar — matches the navbar's search field and
                  utility cluster so the three instruments read as one set. */}
              <NavigationMenuTrigger className="ws-nav-glass h-10 rounded-full bg-card/35 px-4 text-[13px] font-medium text-muted-foreground ring-1 ring-border/50 backdrop-blur-xl hover:bg-card/80 hover:text-foreground focus:bg-card/80 data-open:bg-card/80 data-open:text-foreground data-popup-open:bg-card/80 data-popup-open:text-foreground">
                {item.label}
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <div
                  className={cn(
                    "grid gap-1",
                    item.mega?.columns === 1 && "w-80 grid-cols-1",
                    item.mega?.columns === 2 && "w-105 grid-cols-2",
                  )}
                >
                      {item.mega?.items.map((subItem) => (
                        <NavigationMenuLink
                          key={subItem.name}
                          render={<a href={subItem.href} />}
                          className="group flex items-start gap-3 rounded-lg p-2.5 transition-all hover:bg-white/10 hover:backdrop-blur-xl"
                        >
                          <div className="mt-0.5 shrink-0">
                            <HugeiconsIcon icon={subItem.icon} className="h-4 w-4 [&_path:not(:first-child)]:stroke-primary" />
                          </div>
                          <div className="flex flex-col gap-0.5 overflow-hidden">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium text-foreground">{subItem.name}</span>
                              {subItem.tag && (
                                <span
                                  className={cn(
                                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none",
                                    // Gold means active/primary here; "Soon" is
                                    // the opposite, so it stays neutral.
                                    subItem.soon
                                      ? "bg-foreground/[0.08] text-muted-foreground"
                                      : "bg-primary/10 text-primary",
                                  )}
                                >
                                  {subItem.tag}
                                </span>
                              )}
                            </div>
                            <span className="truncate whitespace-nowrap text-xs text-muted-foreground">
                              {subItem.description}
                            </span>
                          </div>
                        </NavigationMenuLink>
                      ))}
                    </div>
                  </NavigationMenuContent>
            </NavigationMenuItem>
          ))}
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  )
}

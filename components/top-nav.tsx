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
  Store01Icon,
  BarChartIcon,
  GlobeIcon,
  BinaryCodeIcon,
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
          name: "Spot",
          description: "Spot trading markets",
          href: "/spot",
          icon: Exchange01Icon,
        },
        {
          name: "Spot V2",
          description: "Multi-chain DEX trading",
          href: "/spotv2",
          icon: Exchange01Icon,
        },
        {
          name: "Futures",
          description: "Perpetual futures trading",
          href: "/futures",
          icon: ChartLineData02Icon,
        },
        {
          name: "Forex",
          description: "Currency pair trading",
          href: "/forex",
          icon: GlobeIcon,
        },
        {
          name: "Binary",
          description: "Binary options trading",
          href: "/binary",
          icon: BinaryCodeIcon,
        },
        {
          name: "Swap",
          description: "One-tap conversion",
          href: "/swap",
          icon: RepeatIcon,
        },
        {
          name: "Bridge",
          description: "Cross-chain transfers",
          href: "/bridge",
          icon: Link01Icon,
        },
        {
          name: "Copy Trading",
          description: "Mirror top traders",
          href: "/copy-trading",
          icon: Copy01Icon,
        },
        {
          name: "P2P Trading",
          description: "Peer-to-peer exchange",
          href: "/p2p",
          icon: Store01Icon,
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
              <NavigationMenuTrigger className="text-muted-foreground hover:text-foreground">
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
                                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none text-primary">
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

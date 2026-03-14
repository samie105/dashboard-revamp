"use client"

import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Book01Icon,
  Brain01Icon,
  Store01Icon,
  UserGroup02Icon,
  Video01Icon,
  DollarCircleIcon,
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
  icon: typeof Book01Icon
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
    label: "Discover",
    mega: {
      columns: 1,
      items: [
        {
          name: "Store",
          description: "Shop exclusive merch & gear",
          href: "https://shop.worldstreetgold.com",
          icon: Store01Icon,
        },
        {
          name: "Academy",
          description: "Learn trading from experts",
          href: "https://academy.worldstreetgold.com",
          icon: Book01Icon,
        },
        {
          name: "Social",
          description: "Connect with the community",
          href: "https://social.worldstreetgold.com",
          icon: UserGroup02Icon,
        },
        {
          name: "Xstream",
          description: "Live streams & broadcasts",
          href: "https://xtreme.worldstreetgold.com",
          icon: Video01Icon,
        },
        {
          name: "Forex Trading",
          description: "Trade global currency pairs",
          href: "https://trader.worldstreetgold.com",
          icon: DollarCircleIcon,
        },
        {
          name: "Vivid AI",
          description: "AI-powered trading insights",
          href: "/vivid",
          icon: Brain01Icon,
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
